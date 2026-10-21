import { describe, expect, it } from "vitest";
import { createTestDb } from "./harness";

describe("migrations", () => {
  it("apply cleanly with demo seed", async () => {
    const db = await createTestDb();
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.packages where is_published");
    expect(rows[0].n).toBe(5);
  });

  it("enable row-level security on every public table", async () => {
    const db = await createTestDb({ seed: false });
    const { rows } = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and not rowsecurity",
    );
    expect(rows.map((r) => r.tablename)).toEqual([]);
  });

  it("generate references in the expected format", async () => {
    const db = await createTestDb({ seed: false });
    const { rows } = await db.query<{ r: string }>("select public.generate_reference() as r");
    expect(rows[0].r).toMatch(/^YT\d{6}-[A-Z2-9]{5}$/);
  });
});
