import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server/env";

let client: SupabaseClient | null = null;

/**
 * Service-role client — BYPASSES row-level security. Use only in trusted
 * server code after authenticating and authorising the caller (booking
 * creation, payment webhooks, notifications). Never expose to the browser.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  if (!publicEnv.supabaseUrl || !serverEnv.supabaseSecretKey) {
    throw new Error("Supabase service credentials are not configured (SUPABASE_SECRET_KEY).");
  }
  client ??= createClient(publicEnv.supabaseUrl, serverEnv.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
