import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

/**
 * Handles links from Supabase auth emails (sign-up confirmation, password reset,
 * magic link). Supports both PKCE (?code=) and token-hash (?token_hash=&type=) templates.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(url.searchParams.get("next"), "/account");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createSupabaseServerClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  const target = new URL(ok ? next : "/login?error=link", url.origin);
  return NextResponse.redirect(target);
}
