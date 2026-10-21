import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/server/auth";
import { integrations } from "@/lib/server/env";
import { isSameOrigin, json, readJson } from "@/lib/server/http";
import { clientIp, hashIp, rateLimit } from "@/lib/server/rate-limit";

const schema = z.object({
  anonymous_id: z.string().max(64),
  analytics: z.boolean(),
});

/** Records the cookie-banner choice (append-only consent log, IP stored only as a salted hash). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json({ ok: false }, 403);
  if (!integrations.supabaseAdmin()) return json({ ok: false }, 503);
  if (!(await rateLimit("consent"))) return json({ ok: false }, 429);
  const parsed = schema.safeParse(await readJson(request, 2_000).catch(() => null));
  if (!parsed.success) return json({ ok: false }, 400);

  const user = await getSessionUser();
  const db = createSupabaseAdminClient();
  const { data: legal } = await db.from("site_settings").select("value").eq("key", "legal").maybeSingle();
  const { error } = await db.from("consent_records").insert({
    user_id: user?.id ?? null,
    anonymous_id: parsed.data.anonymous_id,
    purpose: "analytics",
    granted: parsed.data.analytics,
    policy_version: (legal?.value as { policy_version?: string } | null)?.policy_version ?? "unknown",
    source: "cookie_banner",
    ip_hash: hashIp(await clientIp()),
    user_agent: request.headers.get("user-agent")?.slice(0, 400) ?? null,
  });
  if (error) console.error("[consent] insert failed", error.message);
  return json({ ok: !error });
}
