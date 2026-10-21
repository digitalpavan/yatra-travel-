"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, invalid, type ActionState } from "@/lib/actions";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { integrations } from "@/lib/server/env";
import { enforceRateLimit, hashIp, clientIp, RateLimitError } from "@/lib/server/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emailSchema, passwordSchema, safeNextPath, signInSchema, signUpSchema } from "@/lib/validation";

const NOT_CONFIGURED = "Accounts are not available yet — the site is still being configured. Please contact us to book.";

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return failure(NOT_CONFIGURED);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await enforceRateLimit("login");
    await enforceRateLimit("login", `email:${hashIp(parsed.data.email)}`);
  } catch (error) {
    if (error instanceof RateLimitError) return failure(error.message, formData);
    throw error;
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    // Same message for unknown email and wrong password (no account enumeration).
    const unconfirmed = /confirm/i.test(error.message);
    return failure(unconfirmed ? "Please confirm your email address first — check your inbox for the link." : "Incorrect email or password.", formData);
  }
  redirect(safeNextPath(parsed.data.next));
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return failure(NOT_CONFIGURED);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await enforceRateLimit("signup");
  } catch (error) {
    if (error instanceof RateLimitError) return failure(error.message, formData);
    throw error;
  }
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      data: { full_name: parsed.data.full_name, phone: parsed.data.phone },
    },
  });
  if (error) {
    const weak = /password/i.test(error.message);
    return failure(weak ? error.message : "We could not create your account. Please try again.", formData);
  }

  // Record consent captured at sign-up (append-only).
  if (data.user && integrations.supabaseAdmin()) {
    const admin = createSupabaseAdminClient();
    const { data: legal } = await admin.from("site_settings").select("value").eq("key", "legal").maybeSingle();
    const version = (legal?.value as { policy_version?: string } | null)?.policy_version ?? "unknown";
    const ipHash = hashIp(await clientIp());
    await admin.from("consent_records").insert([
      { user_id: data.user.id, purpose: "booking_terms", granted: true, policy_version: version, source: "signup", ip_hash: ipHash },
      { user_id: data.user.id, purpose: "marketing", granted: parsed.data.marketing_opt_in, policy_version: version, source: "signup", ip_hash: ipHash },
    ]);
    if (parsed.data.marketing_opt_in) await admin.from("profiles").update({ marketing_opt_in: true }).eq("id", data.user.id);
  }

  if (data.session) redirect(next);
  return {
    ok: true,
    message: "Almost done! We have sent a confirmation link to your email. Open it to activate your account.",
  };
}

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return failure(NOT_CONFIGURED);
  const parsed = z.object({ email: emailSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  try {
    await enforceRateLimit("passwordReset");
  } catch (error) {
    if (error instanceof RateLimitError) return failure(error.message, formData);
    throw error;
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/callback?next=/reset-password`,
  });
  // Identical response whether or not the account exists.
  return { ok: true, message: "If an account exists for that email, we have sent a password reset link." };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { error: "Passwords do not match", path: ["confirm"] })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return failure("Your reset link has expired. Please request a new one.");
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return failure(error.message);
  return { ok: true, message: "Your password has been updated." };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
