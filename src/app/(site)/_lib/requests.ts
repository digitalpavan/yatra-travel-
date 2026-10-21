import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Insert a row with a human-friendly reference derived from
 * public.generate_reference() ("YT261021-ABCDE" → "<prefix>261021-ABCDE").
 * Retries on the (unlikely) unique-reference collision.
 */
export async function insertWithReference<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  prefix: "IT" | "SR",
  row: T,
): Promise<{ id: string; reference: string } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: generated, error: refError } = await supabase.rpc("generate_reference");
    if (refError || typeof generated !== "string") {
      console.error(`[${table}] generate_reference failed`, refError?.message);
      return null;
    }
    const reference = generated.replace(/^YT/, prefix);
    const { data, error } = await supabase.from(table).insert({ ...row, reference }).select("id, reference").single();
    if (!error && data) return data as { id: string; reference: string };
    if (error?.code === "23505" && /reference/.test(error.message)) continue;
    console.error(`[${table}] insert failed`, error?.message);
    return null;
  }
  return null;
}

export const NOT_CONFIGURED_MESSAGE =
  "Online requests are temporarily unavailable. Please reach us by phone, email or WhatsApp using the details on our contact page.";

export const GENERIC_FAILURE_MESSAGE =
  "Sorry, we could not save your request right now. Please try again in a few minutes or contact us directly.";
