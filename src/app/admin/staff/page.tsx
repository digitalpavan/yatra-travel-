import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import { ROLE_LABELS, type StaffRole } from "@/lib/permissions";
import { Badge, Checkbox, EmptyState, Field, Input, Select } from "@/components/ui";
import { AdminHeader, LoadError, Panel, TableWrap, Td, Th } from "@/components/admin/AdminUI";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { addStaff, removeStaff, updateStaff } from "./actions";

export const metadata: Metadata = { title: "Staff", robots: { index: false, follow: false } };

const ALL_ROLES: StaffRole[] = ["booking_staff", "driver", "admin", "owner"];
const PRIVILEGED: StaffRole[] = ["owner", "admin"];
const ROLE_ORDER: Record<StaffRole, number> = { owner: 0, admin: 1, booking_staff: 2, driver: 3 };

const ROLE_HELP: Record<StaffRole, string> = {
  owner: "Everything, including granting owner/administrator roles.",
  admin: "Everything except managing owners and administrators.",
  booking_staff: "Bookings, payments (view), support and customers.",
  driver: "Only their own assigned trips.",
};

interface StaffRow {
  user_id: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
  profiles: { email: string | null; full_name: string | null } | null;
}

export default async function StaffPage() {
  const viewer = await requirePermission("staff.manage", "/admin/staff");
  const isOwner = viewer.role === "owner";
  const grantable = isOwner ? ALL_ROLES : ALL_ROLES.filter((r) => !PRIVILEGED.includes(r));

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("staff_members")
    .select("user_id, role, active, created_at, profiles!staff_members_user_id_fkey(email, full_name)")
    .order("created_at", { ascending: true });
  const rows = ((data ?? []) as unknown as StaffRow[]).sort(
    (a, b) => Number(b.active) - Number(a.active) || ROLE_ORDER[a.role] - ROLE_ORDER[b.role],
  );

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Staff"
        back={{ href: "/admin", label: "Overview" }}
        intro="Who can sign in to the admin dashboard and what they can do. Changes take effect on their next page load."
      />

      <Panel
        title="Add a staff member"
        description="The person must already have a Yatra Travel account (they can sign up on the website first)."
      >
        <ActionForm action={addStaff} resetOnSuccess labels={{ email: "Email", role: "Role" }}>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
            <Field label="Account email" name="email" required>
              <Input name="email" type="email" autoComplete="off" required maxLength={254} />
            </Field>
            <Field label="Role" name="role" required>
              <Select name="role" defaultValue="booking_staff" required>
                {grantable.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <AdminSubmit pendingLabel="Adding…">Add staff</AdminSubmit>
          </div>
        </ActionForm>
        <ul className="mt-4 space-y-1 text-xs text-muted">
          {ALL_ROLES.map((r) => (
            <li key={r}>
              <strong className="text-charcoal">{ROLE_LABELS[r]}:</strong> {ROLE_HELP[r]}
            </li>
          ))}
          <li>
            For drivers, also link their driver record under{" "}
            <Link className="text-forest-800 underline" href="/admin/fleet">
              Fleet
            </Link>{" "}
            so assigned trips appear for them.
          </li>
          {!isOwner && <li>Only an owner can grant or change owner and administrator roles.</li>}
        </ul>
      </Panel>

      <Panel title="Team" description="You cannot change your own role. At least one active owner is always required.">
        {error ? (
          <LoadError what="staff" />
        ) : rows.length === 0 ? (
          <EmptyState title="No staff members" />
        ) : (
          <TableWrap label="Staff members">
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Since</Th>
                <Th>Manage</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const self = s.user_id === viewer.id;
                const locked = !isOwner && PRIVILEGED.includes(s.role);
                const name = s.profiles?.full_name || s.profiles?.email || "Unknown account";
                return (
                  <tr key={s.user_id}>
                    <Td>
                      <span className="block font-medium">
                        {name}
                        {self && <span className="ml-1 text-xs text-muted">(you)</span>}
                      </span>
                      {s.profiles?.full_name && s.profiles.email && <span className="block text-xs break-all text-muted">{s.profiles.email}</span>}
                    </Td>
                    <Td>{ROLE_LABELS[s.role]}</Td>
                    <Td>{s.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}</Td>
                    <Td className="whitespace-nowrap">{formatDate(s.created_at)}</Td>
                    <Td className="min-w-[18rem]">
                      {self ? (
                        <span className="text-xs text-muted">Another owner must change your access.</span>
                      ) : locked ? (
                        <span className="text-xs text-muted">Only an owner can change this person.</span>
                      ) : (
                        <div className="space-y-2">
                          <ActionForm
                            action={updateStaff}
                            confirm={`Save role and status changes for ${name}?`}
                            labels={{ role: "Role" }}
                          >
                            <input type="hidden" name="user_id" value={s.user_id} />
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="sr-only" htmlFor={`role-${s.user_id}`}>
                                Role for {name}
                              </label>
                              <Select name="role" id={`role-${s.user_id}`} defaultValue={s.role} className="w-auto py-1.5">
                                {(grantable.includes(s.role) ? grantable : [s.role, ...grantable]).map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABELS[r]}
                                  </option>
                                ))}
                              </Select>
                              <Checkbox name="active" id={`active-${s.user_id}`} label="Active" defaultChecked={s.active} />
                              <AdminSubmit size="sm" variant="outline">
                                Save
                              </AdminSubmit>
                            </div>
                          </ActionForm>
                          <ActionForm
                            action={removeStaff}
                            confirm={`Remove ${name} from staff? They keep their customer account but lose all admin access.`}
                          >
                            <input type="hidden" name="user_id" value={s.user_id} />
                            <AdminSubmit size="sm" variant="ghost" pendingLabel="Removing…" className="text-red-700">
                              Remove from staff
                            </AdminSubmit>
                          </ActionForm>
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
