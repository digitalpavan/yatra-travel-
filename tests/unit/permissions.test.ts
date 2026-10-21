import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTestDb } from "../db/harness";
import { ROLE_PERMISSIONS, roleHas, type AppRole } from "@/lib/permissions";

describe("permissions", () => {
  it("TypeScript role map matches the database role_permissions table", async () => {
    const db = await createTestDb({ seed: false });
    const { rows } = await db.query<{ role: AppRole; permission: string }>("select role, permission from public.role_permissions");
    const fromDb: Record<string, string[]> = {};
    for (const r of rows) (fromDb[r.role] ??= []).push(r.permission);
    for (const role of ["owner", "admin", "booking_staff", "driver"] as const) {
      expect([...ROLE_PERMISSIONS[role]].sort(), role).toEqual((fromDb[role] ?? []).sort());
    }
    expect(fromDb.customer).toBeUndefined();
  });

  it("customers have no staff permissions and drivers only see their trips", () => {
    expect(ROLE_PERMISSIONS.customer).toHaveLength(0);
    expect(ROLE_PERMISSIONS.driver).toEqual(["trips.own"]);
    expect(roleHas("booking_staff", "refunds.manage")).toBe(false);
    expect(roleHas("booking_staff", "staff.manage")).toBe(false);
    expect(roleHas("admin", "refunds.manage")).toBe(true);
  });

  it("migration source declares the same permission names", () => {
    const sql = readFileSync(join(__dirname, "../../supabase/migrations/20261021000001_core.sql"), "utf8");
    for (const p of ROLE_PERMISSIONS.owner) expect(sql).toContain(`'${p}'`);
  });
});
