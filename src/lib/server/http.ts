import "server-only";
import { NextResponse } from "next/server";
import { publicEnv } from "@/lib/env";
import { AuthorizationError } from "@/lib/server/auth";
import { BookingError } from "@/lib/server/booking";
import { RateLimitError } from "@/lib/server/rate-limit";
import { PaymentGatewayError, PaymentsNotConfiguredError } from "@/lib/server/razorpay";

/**
 * CSRF defence for cookie-authenticated JSON endpoints: the browser always
 * sends Origin on cross-site POSTs, so require it to match this site.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const allowed = new Set([publicEnv.siteUrl, new URL(request.url).origin]);
  return allowed.has(origin);
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readJson(request: Request, maxBytes = 20_000): Promise<unknown> {
  const text = await request.text();
  if (text.length > maxBytes) throw new BookingError("Request too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new BookingError("Invalid request body.");
  }
}

/** Map known errors to safe responses; log unexpected ones without leaking details. */
export function errorResponse(error: unknown) {
  if (error instanceof BookingError) return json({ ok: false, error: error.message, field: error.field, errors: error.field ? { [error.field]: error.message } : undefined }, 422);
  if (error instanceof AuthorizationError) return json({ ok: false, error: error.message }, 401);
  if (error instanceof RateLimitError) return json({ ok: false, error: error.message }, 429);
  if (error instanceof PaymentsNotConfiguredError) return json({ ok: false, error: error.message }, 503);
  if (error instanceof PaymentGatewayError) {
    console.error("[payments]", error.message, error.code);
    return json({ ok: false, error: "The payment gateway is not responding. Please try again in a moment." }, 502);
  }
  console.error("[api] unexpected error", error);
  return json({ ok: false, error: "Something went wrong. Please try again." }, 500);
}
