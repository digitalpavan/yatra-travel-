import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  capturePayment,
  createOrder,
  createRefund,
  fetchPayment,
  PaymentGatewayError,
  publicKeyId,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "@/lib/server/razorpay";
import { notifyBookingUpdate, notifyStaff } from "@/lib/server/notify";
import { BookingError } from "@/lib/server/booking";

// ---------------------------------------------------------------------------
// Checkout: create order
// ---------------------------------------------------------------------------
export async function createPaymentOrder(reference: string, customerId: string) {
  const db = createSupabaseAdminClient();
  const { data: booking } = await db
    .from("bookings")
    .select("id, reference, customer_id, status, total_paise, payment_due_by, contact_name, contact_email, contact_phone")
    .eq("reference", reference)
    .eq("customer_id", customerId) // ownership check — prevents IDOR
    .maybeSingle();
  if (!booking) throw new BookingError("Booking not found.");
  if (booking.status !== "pending") throw new BookingError("This booking does not need payment.");
  if (!booking.payment_due_by || new Date(booking.payment_due_by) < new Date()) {
    throw new BookingError("The payment window for this booking has expired. Please make a new booking.");
  }

  // Reuse an open order for retries so the customer is never charged twice by accident.
  const { data: existing } = await db
    .from("payments")
    .select("provider_order_id, amount_paise")
    .eq("booking_id", booking.id)
    .eq("status", "created")
    .eq("amount_paise", booking.total_paise)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let orderId = existing?.provider_order_id as string | undefined;
  if (!orderId) {
    const order = await createOrder({
      amountPaise: booking.total_paise,
      receipt: booking.reference,
      notes: { booking_id: booking.id, reference: booking.reference },
    });
    if (order.amount !== booking.total_paise || order.currency !== "INR") {
      throw new PaymentGatewayError("Gateway returned an unexpected order amount.");
    }
    const { error } = await db
      .from("payments")
      .insert({ booking_id: booking.id, provider_order_id: order.id, amount_paise: order.amount });
    if (error) throw new Error(`Failed to store payment order: ${error.message}`);
    orderId = order.id;
  }

  return {
    keyId: publicKeyId(),
    orderId,
    amount: booking.total_paise,
    currency: "INR",
    reference: booking.reference,
    prefill: { name: booking.contact_name, email: booking.contact_email, contact: booking.contact_phone },
  };
}

// ---------------------------------------------------------------------------
// Checkout: verify the success callback (the webhook is the backstop)
// ---------------------------------------------------------------------------
export async function verifyCheckoutPayment(
  input: { orderId: string; paymentId: string; signature: string },
  customerId: string,
): Promise<{ outcome: string; reference: string }> {
  if (!verifyCheckoutSignature(input.orderId, input.paymentId, input.signature)) {
    throw new BookingError("Payment signature could not be verified.");
  }
  const db = createSupabaseAdminClient();
  const { data: payment } = await db
    .from("payments")
    .select("id, amount_paise, booking_id, bookings!inner(reference, customer_id)")
    .eq("provider_order_id", input.orderId)
    .maybeSingle<{ id: string; amount_paise: number; booking_id: string; bookings: { reference: string; customer_id: string } }>();
  if (!payment || payment.bookings.customer_id !== customerId) throw new BookingError("Payment not found.");

  // Never trust the browser for status/amount: ask the gateway.
  let gatewayPayment = await fetchPayment(input.paymentId);
  if (gatewayPayment.order_id !== input.orderId) throw new BookingError("Payment does not belong to this order.");
  if (gatewayPayment.amount !== payment.amount_paise) throw new BookingError("Payment amount mismatch.");

  if (gatewayPayment.status === "authorized") {
    gatewayPayment = await capturePayment(gatewayPayment.id, payment.amount_paise);
  }
  if (gatewayPayment.status === "failed") {
    await db.rpc("record_payment_failed", {
      p_order_id: input.orderId,
      p_payment_id: gatewayPayment.id,
      p_code: gatewayPayment.error_code ?? "failed",
      p_reason: gatewayPayment.error_description ?? "Payment failed",
    });
    return { outcome: "failed", reference: payment.bookings.reference };
  }
  if (gatewayPayment.status !== "captured") {
    return { outcome: "processing", reference: payment.bookings.reference };
  }

  const result = await applyCapture(input.orderId, gatewayPayment.id, gatewayPayment.amount, gatewayPayment.method ?? null);
  return { outcome: result.outcome, reference: payment.bookings.reference };
}

async function applyCapture(orderId: string, paymentId: string, amount: number, method: string | null) {
  const { data, error } = await createSupabaseAdminClient().rpc("record_payment_captured", {
    p_order_id: orderId,
    p_payment_id: paymentId,
    p_amount_paise: amount,
    p_method: method,
  });
  if (error) throw new Error(`record_payment_captured failed: ${error.message}`);
  const result = data as { outcome: string; booking_id: string };
  if (result.outcome === "confirmed") await notifyBookingUpdate(result.booking_id, "confirmed");
  if (result.outcome === "refund_required") {
    await notifyStaff("Payment received that needs a refund", [`Booking ${result.booking_id}`, `Payment ${paymentId}`]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------
export interface WebhookStore {
  /** Insert the event; returns "duplicate" if it was already fully processed. */
  recordEvent(eventId: string, type: string, payload: unknown): Promise<"new" | "duplicate">;
  markProcessed(eventId: string, error?: string): Promise<void>;
  paymentCaptured(orderId: string, paymentId: string, amount: number, method: string | null): Promise<void>;
  paymentFailed(orderId: string, paymentId: string, code: string, reason: string): Promise<void>;
  refundProcessed(providerRefundId: string, refundId: string | null): Promise<void>;
  refundFailed(providerRefundId: string, reason: string, refundId: string | null): Promise<void>;
}

interface RazorpayEvent {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; amount: number; method?: string; error_code?: string; error_description?: string } };
    refund?: { entity: { id: string; payment_id: string; amount: number; notes?: Record<string, string> | [] } };
  };
}

export type WebhookResult = { status: number; body: string };

export async function handleRazorpayWebhook(
  rawBody: string,
  signature: string | null,
  eventIdHeader: string | null,
  store: WebhookStore = supabaseWebhookStore(),
  secret?: string,
): Promise<WebhookResult> {
  if (!verifyWebhookSignature(rawBody, signature, secret)) return { status: 401, body: "invalid signature" };

  let event: RazorpayEvent;
  try {
    event = JSON.parse(rawBody) as RazorpayEvent;
  } catch {
    return { status: 400, body: "invalid json" };
  }
  const eventId = eventIdHeader || `sha256:${createHash("sha256").update(rawBody).digest("hex")}`;

  if ((await store.recordEvent(eventId, event.event, event)) === "duplicate") {
    return { status: 200, body: "duplicate" };
  }

  try {
    const payment = event.payload.payment?.entity;
    const refund = event.payload.refund?.entity;
    const refundNotes = refund && !Array.isArray(refund.notes) ? refund.notes : undefined;
    switch (event.event) {
      case "payment.captured":
      case "order.paid":
        if (payment) await store.paymentCaptured(payment.order_id, payment.id, payment.amount, payment.method ?? null);
        break;
      case "payment.failed":
        if (payment) {
          await store.paymentFailed(payment.order_id, payment.id, payment.error_code ?? "failed", payment.error_description ?? "Payment failed");
        }
        break;
      case "refund.processed":
        if (refund) await store.refundProcessed(refund.id, refundNotes?.refund_id ?? null);
        break;
      case "refund.failed":
        if (refund) await store.refundFailed(refund.id, "Refund failed at gateway", refundNotes?.refund_id ?? null);
        break;
      default:
        break; // acknowledged but not used
    }
    await store.markProcessed(eventId);
    return { status: 200, body: "ok" };
  } catch (error) {
    const message = (error as Error).message;
    await store.markProcessed(eventId, message).catch(() => undefined);
    // Permanent data problems are acknowledged (and visible to staff); transient ones are retried.
    const permanent = /Unknown payment order|Unknown refund|does not match/.test(message);
    if (permanent) {
      await notifyStaff("Payment webhook could not be applied", [event.event, eventId, message]);
      return { status: 200, body: "acknowledged with error" };
    }
    return { status: 500, body: "retry" };
  }
}

export function supabaseWebhookStore(): WebhookStore {
  const db = createSupabaseAdminClient();
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
  };
  return {
    async recordEvent(eventId, type, payload) {
      const { error } = await db
        .from("payment_webhook_events")
        .insert({ provider: "razorpay", event_id: eventId, event_type: type, payload });
      if (!error) return "new";
      if (error.code !== "23505") throw new Error(error.message);
      const { data } = await db
        .from("payment_webhook_events")
        .select("processed_at, processing_error")
        .eq("provider", "razorpay")
        .eq("event_id", eventId)
        .single();
      // Re-process deliveries whose earlier attempt failed transiently.
      return data?.processed_at && !data.processing_error ? "duplicate" : "new";
    },
    async markProcessed(eventId, error) {
      await db
        .from("payment_webhook_events")
        .update({ processed_at: new Date().toISOString(), processing_error: error ?? null })
        .eq("provider", "razorpay")
        .eq("event_id", eventId);
    },
    async paymentCaptured(orderId, paymentId, amount, method) {
      await applyCapture(orderId, paymentId, amount, method);
    },
    async paymentFailed(orderId, paymentId, code, reason) {
      await rpc("record_payment_failed", { p_order_id: orderId, p_payment_id: paymentId, p_code: code, p_reason: reason });
    },
    async refundProcessed(providerRefundId, refundId) {
      const result = (await rpc("record_refund_processed", { p_provider_refund_id: providerRefundId, p_refund_id: refundId })) as {
        outcome: string;
      };
      if (result.outcome === "processed") {
        const byProvider = await db.from("refunds").select("booking_id").eq("provider_refund_id", providerRefundId).maybeSingle();
        const row =
          byProvider.data ??
          (refundId ? (await db.from("refunds").select("booking_id").eq("id", refundId).maybeSingle()).data : null);
        if (row) await notifyBookingUpdate(row.booking_id, "refund_processed");
      }
    },
    async refundFailed(providerRefundId, reason, refundId) {
      await rpc("record_refund_failed", { p_provider_refund_id: providerRefundId, p_reason: reason, p_refund_id: refundId });
      await notifyStaff("Refund failed at the payment gateway", [providerRefundId, reason]);
    },
  };
}

// ---------------------------------------------------------------------------
// Refund execution (staff with refunds.manage — checked by the caller)
// ---------------------------------------------------------------------------
export async function executeRefund(refundId: string, actorId: string): Promise<{ providerRefundId: string }> {
  const db = createSupabaseAdminClient();
  const { data: refund } = await db
    .from("refunds")
    .select("id, booking_id, amount_paise, status, payments!inner(provider_payment_id, status)")
    .eq("id", refundId)
    .single<{
      id: string;
      booking_id: string;
      amount_paise: number;
      status: string;
      payments: { provider_payment_id: string | null; status: string };
    }>();
  if (!refund) throw new BookingError("Refund not found.");
  if (!refund.payments.provider_payment_id) throw new BookingError("The original payment has no gateway id.");

  // Claim first so concurrent clicks / retries cannot refund twice.
  const { data: claimed, error: claimError } = await db.rpc("mark_refund_processing", {
    p_refund_id: refundId,
    p_provider_refund_id: null,
    p_actor: actorId,
  });
  if (claimError) throw new Error(claimError.message);
  if (!claimed) throw new BookingError("This refund is already being processed.");

  try {
    const gatewayRefund = await createRefund(refund.payments.provider_payment_id, refund.amount_paise, { refund_id: refundId });
    await db.rpc("set_refund_provider_id", { p_refund_id: refundId, p_provider_refund_id: gatewayRefund.id });
    if (gatewayRefund.status === "processed") {
      await db.rpc("record_refund_processed", { p_provider_refund_id: gatewayRefund.id, p_refund_id: refundId });
      await notifyBookingUpdate(refund.booking_id, "refund_processed");
    }
    return { providerRefundId: gatewayRefund.id };
  } catch (error) {
    await db.rpc("record_refund_failed", {
      p_provider_refund_id: null,
      p_reason: (error as Error).message,
      p_refund_id: refundId,
    });
    throw error;
  }
}
