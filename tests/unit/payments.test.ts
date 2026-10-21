import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Isolate the webhook handler from Supabase / email side effects.
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => { throw new Error("not used in unit tests"); } }));
vi.mock("@/lib/server/notify", () => ({ notifyBookingUpdate: vi.fn(), notifyStaff: vi.fn() }));

const { handleRazorpayWebhook } = await import("@/lib/server/payments");
const { verifyCheckoutSignature, verifyWebhookSignature } = await import("@/lib/server/razorpay");
type Store = import("@/lib/server/payments").WebhookStore;

const SECRET = "whsec_test_secret";
const sign = (body: string, secret = SECRET) => createHmac("sha256", secret).update(body).digest("hex");

function fakeStore() {
  const processed = new Map<string, string | undefined>();
  const calls: string[] = [];
  let failNext: Error | null = null;
  const store: Store & { calls: string[]; failOnce(e: Error): void } = {
    calls,
    failOnce(e) {
      failNext = e;
    },
    async recordEvent(id) {
      if (processed.has(id) && !processed.get(id)) return "duplicate";
      return "new";
    },
    async markProcessed(id, error) {
      processed.set(id, error);
    },
    async paymentCaptured(orderId, paymentId, amount) {
      if (failNext) {
        const e = failNext;
        failNext = null;
        throw e;
      }
      calls.push(`captured:${orderId}:${paymentId}:${amount}`);
    },
    async paymentFailed(orderId) {
      calls.push(`failed:${orderId}`);
    },
    async refundProcessed(id, refundId) {
      calls.push(`refund:${id}:${refundId}`);
    },
    async refundFailed(id) {
      calls.push(`refund_failed:${id}`);
    },
  };
  return store;
}

const captured = JSON.stringify({
  event: "payment.captured",
  payload: { payment: { entity: { id: "pay_ABC", order_id: "order_XYZ", amount: 357000, method: "upi" } } },
});

describe("Razorpay signatures", () => {
  it("verifies checkout signatures (order_id|payment_id)", () => {
    const sig = createHmac("sha256", "key_secret").update("order_1|pay_1").digest("hex");
    expect(verifyCheckoutSignature("order_1", "pay_1", sig, "key_secret")).toBe(true);
    expect(verifyCheckoutSignature("order_1", "pay_2", sig, "key_secret")).toBe(false);
    expect(verifyCheckoutSignature("order_1", "pay_1", sig, "other_secret")).toBe(false);
    expect(verifyCheckoutSignature("order_1", "pay_1", "", "key_secret")).toBe(false);
  });

  it("verifies webhook signatures over the raw body", () => {
    expect(verifyWebhookSignature(captured, sign(captured), SECRET)).toBe(true);
    expect(verifyWebhookSignature(captured + " ", sign(captured), SECRET)).toBe(false);
    expect(verifyWebhookSignature(captured, null, SECRET)).toBe(false);
    expect(verifyWebhookSignature(captured, sign(captured), "")).toBe(false);
  });
});

describe("webhook handler", () => {
  let store: ReturnType<typeof fakeStore>;
  beforeEach(() => {
    store = fakeStore();
  });

  it("rejects bad signatures without touching state", async () => {
    const r = await handleRazorpayWebhook(captured, "deadbeef", "evt_1", store, SECRET);
    expect(r.status).toBe(401);
    expect(store.calls).toEqual([]);
  });

  it("rejects tampered amounts", async () => {
    const tampered = captured.replace("357000", "100");
    const r = await handleRazorpayWebhook(tampered, sign(captured), "evt_1", store, SECRET);
    expect(r.status).toBe(401);
  });

  it("applies a captured payment once even when delivered twice", async () => {
    const first = await handleRazorpayWebhook(captured, sign(captured), "evt_1", store, SECRET);
    const second = await handleRazorpayWebhook(captured, sign(captured), "evt_1", store, SECRET);
    expect(first).toEqual({ status: 200, body: "ok" });
    expect(second).toEqual({ status: 200, body: "duplicate" });
    expect(store.calls).toEqual(["captured:order_XYZ:pay_ABC:357000"]);
  });

  it("asks the gateway to retry on transient errors, then succeeds", async () => {
    store.failOnce(new Error("connection reset"));
    const first = await handleRazorpayWebhook(captured, sign(captured), "evt_2", store, SECRET);
    expect(first.status).toBe(500);
    const retry = await handleRazorpayWebhook(captured, sign(captured), "evt_2", store, SECRET);
    expect(retry.status).toBe(200);
    expect(store.calls).toEqual(["captured:order_XYZ:pay_ABC:357000"]);
  });

  it("acknowledges permanent data errors so the gateway stops retrying", async () => {
    store.failOnce(new Error("Unknown payment order order_XYZ"));
    const r = await handleRazorpayWebhook(captured, sign(captured), "evt_3", store, SECRET);
    expect(r.status).toBe(200);
  });

  it("routes failed payments and refunds", async () => {
    const failed = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_F", order_id: "order_F", amount: 1, error_code: "X", error_description: "declined" } } } });
    const refund = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 100, notes: { refund_id: "r-uuid" } } } } });
    await handleRazorpayWebhook(failed, sign(failed), "evt_f", store, SECRET);
    await handleRazorpayWebhook(refund, sign(refund), "evt_r", store, SECRET);
    expect(store.calls).toEqual(["failed:order_F", "refund:rfnd_1:r-uuid"]);
  });

  it("derives an idempotency key from the body when the event id header is missing", async () => {
    await handleRazorpayWebhook(captured, sign(captured), null, store, SECRET);
    const again = await handleRazorpayWebhook(captured, sign(captured), null, store, SECRET);
    expect(again.body).toBe("duplicate");
  });

  it("rejects invalid JSON with a valid signature", async () => {
    const r = await handleRazorpayWebhook("not json", sign("not json"), "evt_x", store, SECRET);
    expect(r.status).toBe(400);
  });
});
