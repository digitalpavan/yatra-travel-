"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { failure, type ActionState } from "@/lib/actions";
import type { StaffRole } from "@/lib/permissions";
import { adminAction, dbErrorMessage, success, type DbError } from "@/lib/server/admin/errors";
import { checkbox, parseForm, uuid } from "@/lib/server/admin/forms";
import type { Viewer } from "@/lib/server/auth";
import { emailSchema } from "@/lib/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const roleSchema = z.enum(["booking_staff", "driver", "admin", "owner"], { error: "Choose a role" });
const PRIVILEGED: StaffRole[] = ["owner", "admin"];

function staffError(error: DbError): string {
  if (error.code === "23505") return "That person is already a staff member. Change their role in the list below.";
  return dbErrorMessage(error);
}

/** Friendly pre-checks (the database trigger enforces the same rules). */
function privilegeProblem(viewer: Viewer, newRole: StaffRole | null, currentRole: StaffRole | null): string | null {
  if (viewer.role === "owner") return null;
  if (newRole && PRIVILEGED.includes(newRole)) return "Only an owner can grant the owner or administrator role.";
  if (currentRole && PRIVILEGED.includes(currentRole)) return "Only an owner can change or remove owners and administrators.";
  return null;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const addSchema = z.object({
  email: emailSchema,
  role: roleSchema,
});

export async function addStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("staff.manage", async (viewer) => {
    const parsed = parseForm(addSchema, formData);
    if (!parsed.ok) return parsed.state;
    const email = parsed.data.email.trim().toLowerCase();
    const problem = privilegeProblem(viewer, parsed.data.role, null);
    if (problem) return failure(problem, formData, { role: problem });

    const supabase = await createSupabaseServerClient();
    const { data: profiles, error: lookupError } = await supabase
      .from("profiles")
      .select("id, anonymized_at")
      .ilike("email", escapeLike(email))
      .limit(2);
    if (lookupError) return failure(dbErrorMessage(lookupError), formData);
    const matches = (profiles ?? []) as { id: string; anonymized_at: string | null }[];
    if (matches.length === 0) {
      return failure("No account with that email — ask them to sign up first.", formData, { email: "No account with that email" });
    }
    if (matches.length > 1) return failure("More than one account matches that email. Contact support.", formData);
    const profile = matches[0];
    if (profile.anonymized_at) return failure("That account has been anonymised and cannot be made staff.", formData);
    if (profile.id === viewer.id) return failure("You cannot change your own staff role.", formData);

    const { error } = await supabase
      .from("staff_members")
      .insert({ user_id: profile.id, role: parsed.data.role, active: true, created_by: viewer.id });
    if (error) return failure(staffError(error), formData);
    refresh();
    return success(
      parsed.data.role === "driver"
        ? "Driver added. Link their driver record under Fleet so they can see assigned trips."
        : "Staff member added. They get access the next time they load a page.",
    );
  });
}

async function loadStaff(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("staff_members").select("user_id, role, active").eq("user_id", userId).maybeSingle();
  return { supabase, row: data as { user_id: string; role: StaffRole; active: boolean } | null, error };
}

const updateSchema = z.object({
  user_id: uuid,
  role: roleSchema,
  active: checkbox,
});

export async function updateStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("staff.manage", async (viewer) => {
    const parsed = parseForm(updateSchema, formData);
    if (!parsed.ok) return parsed.state;
    if (parsed.data.user_id === viewer.id) return failure("You cannot change your own role or status. Ask another owner.");

    const { supabase, row, error: loadError } = await loadStaff(parsed.data.user_id);
    if (loadError) return failure(dbErrorMessage(loadError));
    if (!row) return failure("Staff member not found or not permitted.");
    const problem = privilegeProblem(viewer, parsed.data.role, row.role);
    if (problem) return failure(problem);
    if (row.role === parsed.data.role && row.active === parsed.data.active) return success("No changes to save.");

    const { data, error } = await supabase
      .from("staff_members")
      .update({ role: parsed.data.role, active: parsed.data.active })
      .eq("user_id", row.user_id)
      .select("user_id");
    if (error) return failure(staffError(error));
    if (!data?.length) return failure("Staff member not found or not permitted.");
    refresh();
    return success("Staff member updated.");
  });
}

const removeSchema = z.object({ user_id: uuid });

export async function removeStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("staff.manage", async (viewer) => {
    const parsed = parseForm(removeSchema, formData);
    if (!parsed.ok) return parsed.state;
    if (parsed.data.user_id === viewer.id) return failure("You cannot remove yourself. Ask another owner.");

    const { supabase, row, error: loadError } = await loadStaff(parsed.data.user_id);
    if (loadError) return failure(dbErrorMessage(loadError));
    if (!row) return failure("Staff member not found or not permitted.");
    const problem = privilegeProblem(viewer, null, row.role);
    if (problem) return failure(problem);

    const { data, error } = await supabase.from("staff_members").delete().eq("user_id", row.user_id).select("user_id");
    if (error) return failure(staffError(error));
    if (!data?.length) return failure("Staff member not found or not permitted.");
    refresh();
    return success("Staff access removed. Their customer account is unchanged.");
  });
}
