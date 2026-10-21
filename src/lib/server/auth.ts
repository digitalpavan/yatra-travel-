import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLE_PERMISSIONS, type AppRole, type Permission } from "@/lib/permissions";

export interface SessionUser {
  id: string;
  email: string | null;
}

export interface Viewer extends SessionUser {
  role: AppRole;
  permissions: readonly Permission[];
}

/** The authenticated user, verified via the Supabase JWT (not just decoded). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null };
});

/** The user plus their role, read from the database (never from client input). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("staff_members")
    .select("role, active")
    .eq("user_id", user.id)
    .maybeSingle();
  const role: AppRole = data?.active ? (data.role as AppRole) : "customer";
  return { ...user, role, permissions: ROLE_PERMISSIONS[role] };
});

/** For pages: redirect to login when signed out. */
export async function requireUser(nextPath = "/account"): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return viewer;
}

/** For staff pages: redirect when the viewer lacks the permission. */
export async function requirePermission(permission: Permission, nextPath = "/admin"): Promise<Viewer> {
  const viewer = await requireUser(nextPath);
  if (!viewer.permissions.includes(permission)) redirect("/admin?denied=1");
  return viewer;
}

export async function requireAnyStaff(nextPath = "/admin"): Promise<Viewer> {
  const viewer = await requireUser(nextPath);
  if (viewer.role === "customer") redirect("/account");
  return viewer;
}

export class AuthorizationError extends Error {
  constructor(message = "You are not allowed to perform this action.") {
    super(message);
  }
}

/** For server actions / route handlers: throw instead of redirecting. */
export async function assertPermission(permission: Permission): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthorizationError("Please sign in again.");
  if (!viewer.permissions.includes(permission)) throw new AuthorizationError();
  return viewer;
}

export async function assertUser(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthorizationError("Please sign in to continue.");
  return viewer;
}
