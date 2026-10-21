import { quoteRequestSchema } from "@/lib/validation";
import { prepareQuote } from "@/lib/server/booking";
import { errorResponse, isSameOrigin, json, readJson } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

/** Live fare quote for the booking form. Prices are computed server-side from DB values. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ ok: false, error: "Forbidden" }, 403);
  try {
    await enforceRateLimit("quote");
    const parsed = quoteRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return json({ ok: false, error: issue?.message ?? "Invalid request", field: issue?.path.join(".") }, 200);
    }
    const prepared = await prepareQuote(parsed.data);
    return json({
      ok: true,
      quote: prepared.quote,
      available: prepared.available,
      summary: prepared.summary,
      vehicle_label: prepared.rate.label,
    });
  } catch (error) {
    const res = errorResponse(error);
    // Validation problems are part of the normal quote flow, not HTTP errors for the form.
    return res.status === 422 ? json(await res.json(), 200) : res;
  }
}
