import { getSessionUser } from "@/lib/server/auth";
import { json } from "@/lib/server/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Minimal profile for prefilling forms. Returns 401 when signed out. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ ok: false }, 401);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("full_name, phone, email").eq("id", user.id).maybeSingle();
  return json({ full_name: data?.full_name ?? "", phone: data?.phone ?? "", email: data?.email ?? user.email ?? "" });
}
