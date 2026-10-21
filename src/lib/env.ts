/**
 * Environment access. Public values (NEXT_PUBLIC_*) are inlined at build time and
 * safe for the browser. Everything else is read only by server modules.
 *
 * Integrations report whether they are configured instead of silently faking
 * success; callers must handle the "not configured" case explicitly.
 */

export const publicEnv = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "",
  googleSiteVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabasePublishableKey);
}
