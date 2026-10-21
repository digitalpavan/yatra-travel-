import { z } from "zod";
import { assertUser } from "@/lib/server/auth";
import { errorResponse, isSameOrigin, json, readJson } from "@/lib/server/http";
import { createPaymentOrder } from "@/lib/server/payments";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({ reference: z.string().regex(/^YT[0-9]{6}-[A-Z2-9]{5}$/) });

/** Create (or reuse) a Razorpay order for the customer's own pending booking. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Forbidden" }, 403);
  try {
    const viewer = await assertUser();
    await enforceRateLimit("payment", viewer.id);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) return json({ ok: false, error: "Invalid booking reference" }, 400);
    return json({ ok: true, ...(await createPaymentOrder(parsed.data.reference, viewer.id)) });
  } catch (error) {
    return errorResponse(error);
  }
}
