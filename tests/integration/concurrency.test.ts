/**
 * Real-concurrency test against a Supabase/Postgres instance (multiple connections).
 * Skipped unless TEST_SUPABASE_URL and TEST_SUPABASE_SECRET_KEY point to a
 * DISPOSABLE project or `npx supabase start` local stack with migrations + seed applied.
 *
 *   TEST_SUPABASE_URL=http://127.0.0.1:54321 TEST_SUPABASE_SECRET_KEY=... npm run test:integration
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.TEST_SUPABASE_URL;
const key = process.env.TEST_SUPABASE_SECRET_KEY;

describe.skipIf(!url || !key)("concurrent booking against real Postgres", () => {
  it("never oversells a vehicle class under parallel requests", async () => {
    const db = createClient(url!, key!, { auth: { persistSession: false } });

    // Fresh customer for this run.
    const email = `concurrency-${Date.now()}@example.test`;
    const { data: created, error: userError } = await db.auth.admin.createUser({ email, email_confirm: true, password: crypto.randomUUID() });
    if (userError) throw userError;
    const customerId = created.user!.id;

    const { data: pkg } = await db.from("packages").select("id").eq("slug", "tirumala-hill-transfer-same-day").single();
    const { count: fleet } = await db.from("vehicles").select("*", { count: "exact", head: true }).eq("vehicle_class", "muv").eq("status", "active");

    // Pick a far-future date unlikely to have other bookings.
    const day = new Date(Date.now() + 150 * 86_400_000).toISOString().slice(0, 10);
    const attempts = 12;
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, (_, i) =>
        db
          .rpc("create_booking", {
            p: {
              customer_id: customerId,
              idempotency_key: `concurrency-${Date.now()}-${i}`,
              booking_type: "package",
              trip_type: "package",
              package_id: pkg!.id,
              vehicle_class: "muv",
              pickup_location: "Concurrency test",
              start_at: `${day}T04:00:00+05:30`,
              end_at: `${day}T20:00:00+05:30`,
              passengers: 2,
              contact_name: "Concurrency Test",
              contact_phone: "+910000000000",
              contact_email: email,
              price_breakdown: { test: true },
              subtotal_paise: 1000,
              total_paise: 1000,
            },
          })
          .then(({ error }) => {
            if (error) throw error;
          }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBeLessThanOrEqual(fleet ?? 0);

    // Clean up test data.
    await db.from("bookings").update({ status: "cancelled" }).eq("customer_id", customerId);
    await db.auth.admin.deleteUser(customerId);
  });
});
