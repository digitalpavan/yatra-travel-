import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * Anonymous, cookie-less client for public catalog reads. Safe to call inside
 * "use cache" functions; RLS restricts it to published content.
 */
export function createSupabasePublicClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
