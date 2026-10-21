import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/server/env";

function authorized(request: Request): boolean {
  const expected = `Bearer ${serverEnv.cronSecret}`;
  const received = request.headers.get("authorization") ?? "";
  if (!serverEnv.cronSecret || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

/** Releases unpaid booking holds. Scheduled via vercel.json (Vercel sends CRON_SECRET as a bearer token). */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response("unauthorized", { status: 401 });
  const { data, error } = await createSupabaseAdminClient().rpc("expire_pending_bookings");
  if (error) {
    console.error("[cron] expire_pending_bookings failed", error.message);
    return new Response("error", { status: 500 });
  }
  return Response.json({ expired: data });
}
