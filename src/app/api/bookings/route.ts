import { bookingRequestSchema, fieldErrors } from "@/lib/validation";
import { assertUser } from "@/lib/server/auth";
import { createBooking } from "@/lib/server/booking";
import { errorResponse, isSameOrigin, json, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

/** Create a pending booking (capacity hold) for the signed-in customer. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Forbidden" }, 403);
  try {
    const viewer = await assertUser();
    await enforceRateLimit("booking", viewer.id);
    const parsed = bookingRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return json({ ok: false, error: "Please correct the highlighted fields.", errors: fieldErrors(parsed.error) }, 422);
    }
    const booking = await createBooking(parsed.data, viewer.id);
    return json({ ok: true, reference: booking.reference }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
