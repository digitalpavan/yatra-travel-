/**
 * Role → permission map. Mirrors public.role_permissions in
 * supabase/migrations/20261021000001_core.sql (tests/unit/permissions.test.ts
 * checks they agree). The database is the source of truth for RLS; this map is
 * used for server-side checks in actions/route handlers and for UI navigation.
 */
export type StaffRole = "owner" | "admin" | "booking_staff" | "driver";
export type AppRole = StaffRole | "customer";

export const PERMISSIONS = [
  "reports.read",
  "bookings.read",
  "bookings.manage",
  "catalog.manage",
  "fleet.manage",
  "payments.read",
  "refunds.manage",
  "coupons.manage",
  "content.manage",
  "reviews.manage",
  "support.manage",
  "customers.read",
  "settings.manage",
  "audit.read",
  "staff.manage",
  "trips.own",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ADMIN_PERMISSIONS: Permission[] = PERMISSIONS.filter((p) => p !== "trips.own");

export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  owner: ADMIN_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  booking_staff: ["reports.read", "bookings.read", "bookings.manage", "payments.read", "support.manage", "customers.read"],
  driver: ["trips.own"],
  customer: [],
};

export function roleHas(role: AppRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  booking_staff: "Booking staff",
  driver: "Driver",
  customer: "Customer",
};
