import { z } from "zod";
import { assertUser } from "@/lib/server/auth";
import { errorResponse, isSameOrigin, json, readJson } from "@/lib/server/http";
import { verifyCheckoutPayment } from "@/lib/server/payments";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});

/** Called by Checkout's success handler. Verifies the signature and confirms with the gateway. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Forbidden" }, 403);
  try {
    const viewer = await assertUser();
    await enforceRateLimit("payment", viewer.id);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) return json({ ok: false, error: "Invalid payment response" }, 400);
    const result = await verifyCheckoutPayment(
      {
        orderId: parsed.data.razorpay_order_id,
        paymentId: parsed.data.razorpay_payment_id,
        signature: parsed.data.razorpay_signature,
      },
      viewer.id,
    );
    return json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
