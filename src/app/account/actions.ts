"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { failure, invalid, type ActionState } from "@/lib/actions";
import { computeRefund } from "@/lib/cancellation";
import { mergeSettings } from "@/lib/data/catalog";
import { formatINR } from "@/lib/money";
import { assertUser, AuthorizationError } from "@/lib/server/auth";
import { notifyBookingUpdate, notifyStaff } from "@/lib/server/notify";
import { enforceRateLimit, RateLimitError } from "@/lib/server/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileSchema, reviewSchema } from "@/lib/validation";

const referenceSchema = z.string().regex(/^YT[0-9]{6}-[A-Z2-9]{5}$/);

async function viewerOrFailure() {
  try {
    return { viewer: await assertUser() };
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: failure(error.message) };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Cancellation — the refund amount is computed here from the published policy;
// nothing from the client influences it.
// ---------------------------------------------------------------------------
export async function cancelMyBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, error } = await viewerOrFailure();
  if (!viewer) return error!;
  const parsed = z
    .object({ reference: referenceSchema, reason: z.string().trim().max(500).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  const supabase = await createSupabaseServerClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, start_at, amount_paid_paise, amount_refunded_paise")
    .eq("reference", parsed.data.reference)
    .eq("customer_id", viewer.id)
    .maybeSingle();
  if (!booking) return failure("Booking not found.");

  const admin = createSupabaseAdminClient();
  const { data: settingRows } = await admin.from("site_settings").select("key, value").eq("key", "cancellation_policy");
  const policy = mergeSettings(settingRows ?? []).cancellation_policy;
  const decision = computeRefund({
    policy,
    status: booking.status,
    startAt: new Date(booking.start_at),
    now: new Date(),
    amountPaidPaise: booking.amount_paid_paise,
    amountRefundedPaise: booking.amount_refunded_paise,
  });
  if (!decision.can_cancel) return failure(decision.reason ?? "This booking cannot be cancelled online.");

  const { error: rpcError } = await admin.rpc("cancel_booking", {
    p_booking_id: booking.id,
    p_actor: viewer.id,
    p_reason: parsed.data.reason || "Cancelled by customer",
    p_refund_paise: booking.amount_paid_paise > 0 ? decision.refundable_paise : 0,
  });
  if (rpcError) {
    console.error("[cancel] rpc failed", rpcError.message);
    return failure("We could not cancel this booking. Please contact support.");
  }

  await notifyBookingUpdate(booking.id, "cancelled");
  if (decision.refundable_paise > 0) {
    await notifyStaff("Refund requested after customer cancellation", [parsed.data.reference, `Refund ${formatINR(decision.refundable_paise)}`]);
  }
  refresh();
  return {
    ok: true,
    message:
      decision.refundable_paise > 0
        ? `Your booking has been cancelled. A refund of ${formatINR(decision.refundable_paise)} has been requested and will go back to your original payment method.`
        : "Your booking has been cancelled.",
  };
}

export async function submitReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, error } = await viewerOrFailure();
  if (!viewer) return error!;
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const supabase = await createSupabaseServerClient();
  // RLS only allows reviews for the customer's own COMPLETED bookings; status starts as pending moderation.
  const { error: insertError } = await supabase.from("reviews").insert({ ...parsed.data, customer_id: viewer.id });
  if (insertError) {
    return failure(insertError.code === "23505" ? "You have already reviewed this trip." : "Reviews can be added after a completed trip.", formData);
  }
  refresh();
  return { ok: true, message: "Thank you! Your review will appear after a quick moderation check." };
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, error } = await viewerOrFailure();
  if (!viewer) return error!;
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase.from("profiles").select("whatsapp_opt_in, marketing_opt_in").eq("id", viewer.id).single();
  const { error: updateError } = await supabase.from("profiles").update(parsed.data).eq("id", viewer.id);
  if (updateError) return failure("Could not save your profile. Please try again.", formData);

  // Log consent changes (append-only).
  const changes = (
    [
      ["whatsapp_updates", before?.whatsapp_opt_in, parsed.data.whatsapp_opt_in],
      ["marketing", before?.marketing_opt_in, parsed.data.marketing_opt_in],
    ] as const
  ).filter(([, was, now]) => was !== now);
  if (changes.length) {
    const admin = createSupabaseAdminClient();
    const { data: legal } = await admin.from("site_settings").select("value").eq("key", "legal").maybeSingle();
    await admin.from("consent_records").insert(
      changes.map(([purpose, , granted]) => ({
        user_id: viewer.id,
        purpose,
        granted,
        policy_version: (legal?.value as { policy_version?: string } | null)?.policy_version ?? "unknown",
        source: "account_settings",
      })),
    );
  }
  refresh();
  return { ok: true, message: "Profile saved." };
}

// ---------------------------------------------------------------------------
// Support
// ---------------------------------------------------------------------------
const ticketSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  category: z.enum(["general", "booking", "payment", "cancellation", "feedback", "privacy"]),
  booking_reference: z.preprocess((v) => (v === "" ? undefined : v), referenceSchema.optional()),
  message: z.string().trim().min(10, { error: "Please describe your request (at least 10 characters)" }).max(5000),
});

export async function createTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, error } = await viewerOrFailure();
  if (!viewer) return error!;
  const parsed = ticketSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await enforceRateLimit("contact", viewer.id);
  } catch (e) {
    if (e instanceof RateLimitError) return failure(e.message, formData);
    throw e;
  }
  const supabase = await createSupabaseServerClient();
  const [{ data: profile }, { data: booking }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone").eq("id", viewer.id).single(),
    parsed.data.booking_reference
      ? supabase.from("bookings").select("id").eq("reference", parsed.data.booking_reference).eq("customer_id", viewer.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const admin = createSupabaseAdminClient();
  const { data: ref } = await admin.rpc("generate_reference");
  const reference = String(ref).replace(/^YT/, "SR");
  const { data: ticket, error: insertError } = await admin
    .from("support_tickets")
    .insert({
      reference,
      customer_id: viewer.id,
      booking_id: booking?.id ?? null,
      name: profile?.full_name || "Customer",
      email: profile?.email || viewer.email || "unknown@invalid.local",
      phone: profile?.phone ?? null,
      category: parsed.data.category,
      subject: parsed.data.subject,
    })
    .select("id")
    .single();
  if (insertError || !ticket) return failure("Could not create your request. Please try again.", formData);
  await admin.from("ticket_messages").insert({ ticket_id: ticket.id, author_id: viewer.id, is_staff: false, body: parsed.data.message });
  await notifyStaff("New support request", [reference, parsed.data.subject]);
  refresh();
  return { ok: true, message: `Request ${reference} received. Our team will reply here and by email.` };
}

export async function replyToTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, error } = await viewerOrFailure();
  if (!viewer) return error!;
  const parsed = z
    .object({ ticket_id: z.uuid(), body: z.string().trim().min(1).max(5000) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const supabase = await createSupabaseServerClient();
  // RLS: only the ticket owner can post, and only while the ticket is not closed.
  const { error: insertError } = await supabase
    .from("ticket_messages")
    .insert({ ticket_id: parsed.data.ticket_id, author_id: viewer.id, is_staff: false, body: parsed.data.body });
  if (insertError) return failure("Could not send your message.", formData);
  refresh();
  return { ok: true, message: "Message sent." };
}

// ---------------------------------------------------------------------------
// Privacy (DPDP Act rights)
// ---------------------------------------------------------------------------
export async function createDataRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { viewer, error } = await viewerOrFailure();
  if (!viewer) return error!;
  const parsed = z
    .object({
      request_type: z.enum(["access", "correction", "deletion", "withdraw_consent"]),
      details: z.string().trim().max(2000).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const supabase = await createSupabaseServerClient();
  const { error: insertError } = await supabase
    .from("data_requests")
    .insert({ user_id: viewer.id, request_type: parsed.data.request_type, details: parsed.data.details ?? null });
  if (insertError) return failure("Could not submit your request.", formData);
  await notifyStaff("New privacy request", [parsed.data.request_type, viewer.id]);
  refresh();
  return { ok: true, message: "Your request has been received. We will respond within the timelines described in our privacy policy." };
}
