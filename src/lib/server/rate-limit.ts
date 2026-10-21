import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { integrations, serverEnv } from "@/lib/server/env";

export async function clientIp(): Promise<string> {
  const h = await headers();
  // On Vercel, x-forwarded-for is set by the platform; the first entry is the client.
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Salted hash so raw IP addresses are not stored. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(`${serverEnv.ipHashSalt}:${ip}`).digest("hex").slice(0, 32);
}

export const LIMITS = {
  login: { max: 10, windowSeconds: 15 * 60 },
  signup: { max: 5, windowSeconds: 60 * 60 },
  passwordReset: { max: 5, windowSeconds: 60 * 60 },
  contact: { max: 5, windowSeconds: 60 * 60 },
  itinerary: { max: 5, windowSeconds: 60 * 60 },
  quote: { max: 60, windowSeconds: 60 },
  booking: { max: 10, windowSeconds: 60 * 60 },
  payment: { max: 20, windowSeconds: 60 * 60 },
  consent: { max: 30, windowSeconds: 60 * 60 },
} as const;

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Please wait a few minutes and try again.");
  }
}

/**
 * Fixed-window limiter backed by Postgres (works across serverless instances).
 * Returns true when allowed. `key` defaults to the hashed client IP.
 */
export async function rateLimit(name: keyof typeof LIMITS, key?: string): Promise<boolean> {
  if (!integrations.supabaseAdmin()) {
    console.warn("[rate-limit] SUPABASE_SECRET_KEY missing — rate limiting disabled");
    return true;
  }
  const { max, windowSeconds } = LIMITS[name];
  const subject = key ?? hashIp(await clientIp());
  const { data, error } = await createSupabaseAdminClient().rpc("check_rate_limit", {
    p_bucket: `${name}:${subject}`,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] check failed", error.message);
    return false; // fail closed on sensitive endpoints
  }
  return data === true;
}

export async function enforceRateLimit(name: keyof typeof LIMITS, key?: string): Promise<void> {
  if (!(await rateLimit(name, key))) throw new RateLimitError();
}
