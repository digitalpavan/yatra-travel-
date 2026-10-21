import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type Db } from "./harness";

let db: Db;
let customer: string;
let staff: string;
let driverUser: string;
let packageId: string;

const DAY = (d: number) => ({
  start_at: `2030-03-${String(d).padStart(2, "0")}T04:00:00+05:30`,
  end_at: `2030-03-${String(d).padStart(2, "0")}T20:00:00+05:30`,
});

async function createBooking(overrides: Record<string, unknown> = {}, couponId: string | null = null) {
  const payload = {
    customer_id: customer,
    booking_type: "package",
    trip_type: "package",
    package_id: packageId,
    vehicle_class: "muv",
    pickup_location: "Tirupati Railway Station",
    ...DAY(1),
    passengers: 4,
    contact_name: "Test Customer",
    contact_phone: "+919999999999",
    contact_email: "test@example.com",
    price_breakdown: {},
    subtotal_paise: 340000,
    tax_paise: 17000,
    total_paise: 357000,
    ...overrides,
  };
  const { rows } = await db.query<{ id: string; status: string; reference: string }>(
    "select id, status, reference from public.create_booking($1::jsonb, $2::uuid)",
    [JSON.stringify(payload), couponId],
  );
  return rows[0];
}

async function addOrder(bookingId: string, orderId: string, amount = 357000) {
  await db.query("insert into public.payments (booking_id, provider_order_id, amount_paise) values ($1, $2, $3)", [
    bookingId,
    orderId,
    amount,
  ]);
}

async function status(bookingId: string) {
  const { rows } = await db.query<{ status: string }>("select status from public.bookings where id = $1", [bookingId]);
  return rows[0].status;
}

async function ids(sql: string) {
  return (await db.query<{ id: string }>(sql)).rows.map((r) => r.id);
}

beforeEach(async () => {
  db = await createTestDb();
  customer = await db.createUser("customer@example.com");
  staff = await db.createUser("staff@example.com");
  driverUser = await db.createUser("driver@example.com");
  await db.makeStaff(staff, "booking_staff");
  await db.makeStaff(driverUser, "driver");
  packageId = (await ids("select id from public.packages where slug = 'tirumala-hill-transfer-same-day'"))[0];
});

describe("capacity", () => {
  it("rejects bookings once all vehicles of a class are committed for overlapping times", async () => {
    // Seed fleet has 2 MUVs.
    await createBooking();
    await createBooking();
    await expect(createBooking()).rejects.toThrow(/No vehicle of this type is available/);
  });

  it("allows bookings on non-overlapping dates", async () => {
    await createBooking();
    await createBooking();
    await expect(createBooking(DAY(2))).resolves.toBeTruthy();
  });

  it("releases capacity when an unpaid hold expires", async () => {
    const a = await createBooking();
    await createBooking();
    await db.query("update public.bookings set payment_due_by = now() - interval '1 minute' where id = $1", [a.id]);
    const { rows } = await db.query<{ n: number }>("select public.expire_pending_bookings() as n");
    expect(rows[0].n).toBe(1);
    expect(await status(a.id)).toBe("cancelled");
    await expect(createBooking()).resolves.toBeTruthy();
  });

  it("is idempotent for retried requests with the same idempotency key", async () => {
    const first = await createBooking({ idempotency_key: "client-key-123" });
    const second = await createBooking({ idempotency_key: "client-key-123" });
    expect(second.id).toBe(first.id);
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.bookings");
    expect(rows[0].n).toBe(1);
  });
});

describe("vehicle allocation", () => {
  async function confirmed(day = 1, passengers = 4) {
    const b = await createBooking({ ...DAY(day), passengers });
    await addOrder(b.id, `order_${b.id}`);
    await db.query("select public.record_payment_captured($1, $2, 357000, 'upi')", [`order_${b.id}`, `pay_${b.id}`]);
    return b;
  }

  it("prevents assigning the same vehicle to overlapping trips", async () => {
    const [vehicle] = await ids("select id from public.vehicles where vehicle_class = 'muv' order by registration_number limit 1");
    const [d1, d2] = await ids("select id from public.drivers order by full_name limit 2");
    const b1 = await confirmed();
    const b2 = await confirmed();
    await db.as("authenticated", staff, () => db.query("select public.assign_vehicle($1, $2, $3)", [b1.id, vehicle, d1]));
    await expect(
      db.as("authenticated", staff, () => db.query("select public.assign_vehicle($1, $2, $3)", [b2.id, vehicle, d2])),
    ).rejects.toThrow(/already allocated/);
    expect(await status(b1.id)).toBe("assigned");
    expect(await status(b2.id)).toBe("confirmed");
  });

  it("prevents assigning the same driver to overlapping trips", async () => {
    const [v1, v2] = await ids("select id from public.vehicles where vehicle_class = 'muv' order by registration_number");
    const [driver] = await ids("select id from public.drivers order by full_name limit 1");
    const b1 = await confirmed();
    const b2 = await confirmed();
    await db.as("authenticated", staff, () => db.query("select public.assign_vehicle($1, $2, $3)", [b1.id, v1, driver]));
    await expect(
      db.as("authenticated", staff, () => db.query("select public.assign_vehicle($1, $2, $3)", [b2.id, v2, driver])),
    ).rejects.toThrow(/already allocated/);
  });

  it("enforces the exclusion constraint even on direct inserts", async () => {
    const [vehicle] = await ids("select id from public.vehicles where vehicle_class = 'muv' limit 1");
    const [d1, d2] = await ids("select id from public.drivers limit 2");
    const b1 = await confirmed();
    const b2 = await confirmed();
    await db.query(
      "insert into public.vehicle_assignments (booking_id, vehicle_id, driver_id, period) values ($1, $2, $3, tstzrange('2030-03-01 04:00+05:30', '2030-03-01 20:00+05:30'))",
      [b1.id, vehicle, d1],
    );
    await expect(
      db.query(
        "insert into public.vehicle_assignments (booking_id, vehicle_id, driver_id, period) values ($1, $2, $3, tstzrange('2030-03-01 10:00+05:30', '2030-03-01 22:00+05:30'))",
        [b2.id, vehicle, d2],
      ),
    ).rejects.toThrow(/no_vehicle_overlap/);
  });

  it("rejects assignment by customers and of unpaid bookings", async () => {
    const [vehicle] = await ids("select id from public.vehicles where vehicle_class = 'muv' limit 1");
    const [driver] = await ids("select id from public.drivers limit 1");
    const unpaid = await createBooking();
    await expect(
      db.as("authenticated", customer, () => db.query("select public.assign_vehicle($1, $2, $3)", [unpaid.id, vehicle, driver])),
    ).rejects.toThrow(/Not authorised/);
    await expect(
      db.as("authenticated", staff, () => db.query("select public.assign_vehicle($1, $2, $3)", [unpaid.id, vehicle, driver])),
    ).rejects.toThrow(/Only confirmed bookings/);
  });

  it("rejects vehicles that are too small for the group", async () => {
    const [sedan] = await ids("select id from public.vehicles where vehicle_class = 'sedan' limit 1");
    const [driver] = await ids("select id from public.drivers limit 1");
    const b = await confirmed(1, 6);
    await expect(
      db.as("authenticated", staff, () => db.query("select public.assign_vehicle($1, $2, $3)", [b.id, sedan, driver])),
    ).rejects.toThrow(/seats/);
  });

  it("lets only the assigned driver progress the trip, in order", async () => {
    const [vehicle] = await ids("select id from public.vehicles where vehicle_class = 'muv' limit 1");
    const [driverId] = await ids("select id from public.drivers limit 1");
    await db.query("update public.drivers set user_id = $1 where id = $2", [driverUser, driverId]);
    const b = await confirmed();
    await db.as("authenticated", staff, () => db.query("select public.assign_vehicle($1, $2, $3)", [b.id, vehicle, driverId]));

    await expect(
      db.as("authenticated", customer, () => db.query("select public.update_trip_status($1, 'in_progress')", [b.id])),
    ).rejects.toThrow(/Not authorised/);
    await expect(
      db.as("authenticated", driverUser, () => db.query("select public.update_trip_status($1, 'completed')", [b.id])),
    ).rejects.toThrow(/Invalid status transition/);
    await db.as("authenticated", driverUser, () => db.query("select public.update_trip_status($1, 'in_progress')", [b.id]));
    await db.as("authenticated", driverUser, () => db.query("select public.update_trip_status($1, 'completed')", [b.id]));
    expect(await status(b.id)).toBe("completed");

    const visible = await db.as("authenticated", driverUser, async () =>
      (await db.query("select id from public.bookings")).rows,
    );
    expect(visible).toHaveLength(1);
  });
});

describe("payments", () => {
  it("confirms the booking once and is idempotent on duplicate events", async () => {
    const b = await createBooking();
    await addOrder(b.id, "order_A");
    const first = await db.query<{ r: { outcome: string } }>(
      "select public.record_payment_captured('order_A', 'pay_A', 357000, 'upi') as r",
    );
    const second = await db.query<{ r: { outcome: string } }>(
      "select public.record_payment_captured('order_A', 'pay_A', 357000, 'upi') as r",
    );
    expect(first.rows[0].r.outcome).toBe("confirmed");
    expect(second.rows[0].r.outcome).toBe("already_processed");
    const { rows } = await db.query<{ amount_paid_paise: number; status: string }>(
      "select amount_paid_paise, status from public.bookings where id = $1",
      [b.id],
    );
    expect(rows[0]).toEqual({ amount_paid_paise: 357000, status: "confirmed" });
  });

  it("rejects a captured amount that differs from the order amount", async () => {
    const b = await createBooking();
    await addOrder(b.id, "order_B");
    await expect(db.query("select public.record_payment_captured('order_B', 'pay_B', 100)")).rejects.toThrow(/does not match/);
    expect(await status(b.id)).toBe("pending");
  });

  it("rejects unknown orders", async () => {
    await expect(db.query("select public.record_payment_captured('order_nope', 'pay', 100)")).rejects.toThrow(/Unknown payment order/);
  });

  it("records failures without changing the booking, and does not overwrite a capture", async () => {
    const b = await createBooking();
    await addOrder(b.id, "order_C");
    await db.query("select public.record_payment_failed('order_C', 'pay_C1', 'BAD_REQUEST_ERROR', 'Card declined')");
    expect(await status(b.id)).toBe("pending");
    await db.query("select public.record_payment_captured('order_C', 'pay_C2', 357000)");
    await db.query("select public.record_payment_failed('order_C', 'pay_C1', 'X', 'late failure event')");
    const { rows } = await db.query<{ status: string }>("select status from public.payments where provider_order_id = 'order_C'");
    expect(rows[0].status).toBe("captured");
  });

  it("reinstates an expired booking on late payment when capacity remains", async () => {
    const b = await createBooking();
    await addOrder(b.id, "order_D");
    await db.query("update public.bookings set payment_due_by = now() - interval '1 minute' where id = $1", [b.id]);
    await db.query("select public.expire_pending_bookings()");
    const r = await db.query<{ r: { outcome: string } }>("select public.record_payment_captured('order_D', 'pay_D', 357000) as r");
    expect(r.rows[0].r.outcome).toBe("confirmed");
    expect(await status(b.id)).toBe("confirmed");
  });

  it("queues a full refund for a late payment when the vehicle was taken", async () => {
    const b = await createBooking();
    await addOrder(b.id, "order_E");
    await db.query("update public.bookings set payment_due_by = now() - interval '1 minute' where id = $1", [b.id]);
    await db.query("select public.expire_pending_bookings()");
    await createBooking();
    await createBooking(); // both MUVs now taken
    const r = await db.query<{ r: { outcome: string } }>("select public.record_payment_captured('order_E', 'pay_E', 357000) as r");
    expect(r.rows[0].r.outcome).toBe("refund_required");
    expect(await status(b.id)).toBe("refund_pending");
    const { rows } = await db.query<{ amount_paise: number; status: string }>(
      "select amount_paise, status from public.refunds where booking_id = $1",
      [b.id],
    );
    expect(rows).toEqual([{ amount_paise: 357000, status: "approved" }]);
  });

  it("queues a refund for a duplicate payment on an already-paid booking", async () => {
    const b = await createBooking();
    await addOrder(b.id, "order_F1");
    await addOrder(b.id, "order_F2");
    await db.query("select public.record_payment_captured('order_F1', 'pay_F1', 357000)");
    const r = await db.query<{ r: { outcome: string } }>("select public.record_payment_captured('order_F2', 'pay_F2', 357000) as r");
    expect(r.rows[0].r.outcome).toBe("refund_required");
    expect(await status(b.id)).toBe("confirmed");
  });
});

describe("cancellation and refunds", () => {
  async function paidBooking() {
    const b = await createBooking();
    await addOrder(b.id, `order_${b.id}`);
    await db.query("select public.record_payment_captured($1, $2, 357000)", [`order_${b.id}`, `pay_${b.id}`]);
    return b;
  }

  it("cancels unpaid bookings without a refund and releases the coupon", async () => {
    const { rows } = await db.query<{ id: string }>(
      "insert into public.coupons (code, discount_type, discount_value, usage_limit) values ('TEST10', 'percent', 1000, 1) returning id",
    );
    const b = await createBooking({}, rows[0].id);
    const used = await db.query<{ used_count: number }>("select used_count from public.coupons where code = 'TEST10'");
    expect(used.rows[0].used_count).toBe(1);
    await db.query("select public.cancel_booking($1, $2, 'Change of plans', 0)", [b.id, customer]);
    expect(await status(b.id)).toBe("cancelled");
    const after = await db.query<{ used_count: number }>("select used_count from public.coupons where code = 'TEST10'");
    expect(after.rows[0].used_count).toBe(0);
  });

  it("enforces coupon usage limits", async () => {
    const { rows } = await db.query<{ id: string }>(
      "insert into public.coupons (code, discount_type, discount_value, usage_limit, per_customer_limit) values ('ONCE', 'flat', 10000, 1, 5) returning id",
    );
    await createBooking({}, rows[0].id);
    await expect(createBooking(DAY(2), rows[0].id)).rejects.toThrow(/Coupon is no longer valid/);
  });

  it("creates a refund request for paid bookings and completes it on gateway confirmation", async () => {
    const b = await paidBooking();
    await db.query("select public.cancel_booking($1, $2, 'Unable to travel', 321300)", [b.id, customer]);
    expect(await status(b.id)).toBe("refund_pending");

    const refund = await db.query<{ id: string; status: string }>("select id, status from public.refunds where booking_id = $1", [b.id]);
    expect(refund.rows[0].status).toBe("requested");

    await db.query("select public.mark_refund_processing($1, 'rfnd_1', $2)", [refund.rows[0].id, staff]);
    const r1 = await db.query<{ r: { outcome: string } }>("select public.record_refund_processed('rfnd_1') as r");
    const r2 = await db.query<{ r: { outcome: string } }>("select public.record_refund_processed('rfnd_1') as r");
    expect(r1.rows[0].r.outcome).toBe("processed");
    expect(r2.rows[0].r.outcome).toBe("already_processed");

    const { rows } = await db.query<{ status: string; amount_refunded_paise: number }>(
      "select status, amount_refunded_paise from public.bookings where id = $1",
      [b.id],
    );
    expect(rows[0]).toEqual({ status: "refunded", amount_refunded_paise: 321300 });
    const pay = await db.query<{ status: string }>("select status from public.payments where booking_id = $1", [b.id]);
    expect(pay.rows[0].status).toBe("partially_refunded");
  });

  it("rejects refunds larger than the amount paid", async () => {
    const b = await paidBooking();
    await expect(db.query("select public.cancel_booking($1, $2, 'x', 999999999)", [b.id, customer])).rejects.toThrow(
      /Invalid refund amount/,
    );
  });

  it("does not allow cancelling a trip that is in progress or completed", async () => {
    const b = await paidBooking();
    await db.query("update public.bookings set status = 'completed' where id = $1", [b.id]);
    await expect(db.query("select public.cancel_booking($1, $2, 'x', 0)", [b.id, customer])).rejects.toThrow(
      /cannot be cancelled/,
    );
  });

  it("releases vehicle assignments on cancellation", async () => {
    const [vehicle] = await ids("select id from public.vehicles where vehicle_class = 'muv' limit 1");
    const [driver] = await ids("select id from public.drivers limit 1");
    const b = await paidBooking();
    await db.as("authenticated", staff, () => db.query("select public.assign_vehicle($1, $2, $3)", [b.id, vehicle, driver]));
    await db.query("select public.cancel_booking($1, $2, 'x', 0)", [b.id, customer]);
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.vehicle_assignments where booking_id = $1 and is_active",
      [b.id],
    );
    expect(rows[0].n).toBe(0);
  });

  it("lets only one caller claim a refund for processing", async () => {
    const b = await paidBooking();
    await db.query("select public.cancel_booking($1, $2, 'x', 100000)", [b.id, customer]);
    const [refundId] = await ids(`select id from public.refunds where booking_id = '${b.id}'`);
    const first = await db.query<{ ok: boolean }>("select public.mark_refund_processing($1, null, $2) as ok", [refundId, staff]);
    const second = await db.query<{ ok: boolean }>("select public.mark_refund_processing($1, null, $2) as ok", [refundId, staff]);
    expect(first.rows[0].ok).toBe(true);
    expect(second.rows[0].ok).toBe(false);
  });

  it("declining a refund returns the booking to cancelled", async () => {
    const b = await paidBooking();
    await db.query("select public.cancel_booking($1, $2, 'x', 100000)", [b.id, customer]);
    const [refundId] = await ids(`select id from public.refunds where booking_id = '${b.id}'`);
    await db.query("select public.reject_refund($1, $2, 'Outside policy')", [refundId, staff]);
    expect(await status(b.id)).toBe("cancelled");
  });

  it("records refund failures and allows a retry", async () => {
    const b = await paidBooking();
    await db.query("select public.cancel_booking($1, $2, 'x', 100000)", [b.id, customer]);
    const [refundId] = await ids(`select id from public.refunds where booking_id = '${b.id}'`);
    await db.query("select public.mark_refund_processing($1, 'rfnd_fail', $2)", [refundId, staff]);
    await db.query("select public.record_refund_failed('rfnd_fail', 'Insufficient balance')");
    const failed = await db.query<{ status: string }>("select status from public.refunds where id = $1", [refundId]);
    expect(failed.rows[0].status).toBe("failed");
    await db.query("select public.mark_refund_processing($1, 'rfnd_retry', $2)", [refundId, staff]);
    const retry = await db.query<{ status: string }>("select status from public.refunds where id = $1", [refundId]);
    expect(retry.rows[0].status).toBe("processing");
  });
});

describe("rate limiting", () => {
  it("allows up to the limit within a window", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const { rows } = await db.query<{ ok: boolean }>("select public.check_rate_limit('login:1.2.3.4', 3, 60) as ok");
      results.push(rows[0].ok);
    }
    expect(results).toEqual([true, true, true, false]);
  });
});
