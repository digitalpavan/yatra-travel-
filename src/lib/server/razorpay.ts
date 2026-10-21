import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { integrations, serverEnv } from "@/lib/server/env";

/**
 * Minimal Razorpay REST client (https://razorpay.com/docs/api/).
 * Secrets never leave the server. Only the public key id is sent to Checkout.
 */
const API = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 15_000;

export class PaymentGatewayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super("Online payments are not configured yet. Please contact us to complete your booking.");
  }
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  if (!integrations.razorpay()) throw new PaymentsNotConfiguredError();
  const auth = Buffer.from(`${serverEnv.razorpayKeyId}:${serverEnv.razorpayKeySecret}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    throw new PaymentGatewayError(`Payment gateway unreachable: ${(error as Error).message}`);
  }
  const json = (await res.json().catch(() => ({}))) as { error?: { description?: string; code?: string } };
  if (!res.ok) {
    throw new PaymentGatewayError(json.error?.description || `Gateway error ${res.status}`, res.status, json.error?.code);
  }
  return json as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  error_code?: string | null;
  error_description?: string | null;
}

export interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: "pending" | "processed" | "failed";
}

export function createOrder(params: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
  return request<RazorpayOrder>("POST", "/orders", {
    amount: params.amountPaise,
    currency: "INR",
    receipt: params.receipt.slice(0, 40),
    notes: params.notes,
  });
}

export function fetchPayment(paymentId: string) {
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new PaymentGatewayError("Invalid payment id");
  return request<RazorpayPayment>("GET", `/payments/${paymentId}`);
}

export function capturePayment(paymentId: string, amountPaise: number) {
  return request<RazorpayPayment>("POST", `/payments/${paymentId}/capture`, { amount: amountPaise, currency: "INR" });
}

export function createRefund(paymentId: string, amountPaise: number, notes: Record<string, string>) {
  return request<RazorpayRefund>("POST", `/payments/${paymentId}/refund`, {
    amount: amountPaise,
    speed: "normal",
    notes,
  });
}

export function publicKeyId(): string {
  return serverEnv.razorpayKeyId;
}

function safeEqualHex(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Signature returned to Checkout's success handler: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret = serverEnv.razorpayKeySecret): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret = serverEnv.razorpayWebhookSecret): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
