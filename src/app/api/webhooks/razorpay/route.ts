import { integrations } from "@/lib/server/env";
import { handleRazorpayWebhook } from "@/lib/server/payments";

/**
 * Razorpay webhook. Configure in Dashboard → Webhooks with events:
 * payment.captured, payment.failed, order.paid, refund.processed, refund.failed.
 * The signature is verified over the RAW body before anything is parsed.
 */
export async function POST(request: Request) {
  if (!integrations.razorpayWebhook()) {
    console.error("[webhook] RAZORPAY_WEBHOOK_SECRET is not configured");
    return new Response("not configured", { status: 503 });
  }
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return new Response("too large", { status: 413 });
  const result = await handleRazorpayWebhook(
    rawBody,
    request.headers.get("x-razorpay-signature"),
    request.headers.get("x-razorpay-event-id"),
  );
  return new Response(result.body, { status: result.status });
}
