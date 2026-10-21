import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Db } from "./harness";

let db: Db;
let alice: string; // customer
let bob: string; // customer
let staff: string; // booking_staff
let admin: string;
let owner: string;
let packageId: string;

async function createBooking(customerId: string, overrides: Record<string, unknown> = {}) {
  const payload = {
    customer_id: customerId,
    booking_type: "package",
    trip_type: "package",
    package_id: packageId,
    vehicle_class: "muv",
    pickup_location: "Tirupati Railway Station",
    start_at: "2030-01-10T04:00:00+05:30",
    end_at: "2030-01-10T20:00:00+05:30",
    passengers: 4,
    contact_name: "Test Customer",
    contact_phone: "+919999999999",
    contact_email: "test@example.com",
    price_breakdown: { demo: true },
    subtotal_paise: 340000,
    tax_paise: 17000,
    total_paise: 357000,
    ...overrides,
  };
  const { rows } = await db.query<{ id: string; reference: string; status: string }>(
    "select id, reference, status from public.create_booking($1::jsonb)",
    [JSON.stringify(payload)],
  );
  return rows[0];
}

beforeAll(async () => {
  db = await createTestDb();
  alice = await db.createUser("alice@example.com", { full_name: "Alice" });
  bob = await db.createUser("bob@example.com", { full_name: "Bob" });
  staff = await db.createUser("staff@example.com");
  admin = await db.createUser("admin@example.com");
  owner = await db.createUser("owner@example.com");
  await db.makeStaff(owner, "owner");
  await db.makeStaff(admin, "admin");
  await db.makeStaff(staff, "booking_staff");
  const { rows } = await db.query<{ id: string }>(
    "select id from public.packages where slug = 'tirumala-hill-transfer-same-day'",
  );
  packageId = rows[0].id;
});

describe("profiles", () => {
  it("are created automatically on sign-up", async () => {
    const { rows } = await db.query<{ full_name: string }>("select full_name from public.profiles where id = $1", [alice]);
    expect(rows[0].full_name).toBe("Alice");
  });

  it("customers can only see their own profile", async () => {
    const rows = await db.as("authenticated", alice, async () =>
      (await db.query<{ id: string }>("select id from public.profiles")).rows,
    );
    expect(rows.map((r) => r.id)).toEqual([alice]);
  });

  it("customers cannot change another customer's profile", async () => {
    await db.as("authenticated", alice, () =>
      db.query("update public.profiles set full_name = 'Hacked' where id = $1", [bob]),
    );
    const { rows } = await db.query<{ full_name: string }>("select full_name from public.profiles where id = $1", [bob]);
    expect(rows[0].full_name).toBe("Bob");
  });

  it("customers cannot write privileged columns (email, anonymized_at)", async () => {
    await expect(
      db.as("authenticated", alice, () => db.query("update public.profiles set email = 'x@y.z' where id = $1", [alice])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("privilege escalation", () => {
  it("customers cannot grant themselves a staff role", async () => {
    await expect(
      db.as("authenticated", alice, () =>
        db.query("insert into public.staff_members (user_id, role) values ($1, 'owner')", [alice]),
      ),
    ).rejects.toThrow();
  });

  it("admins cannot create owners or admins", async () => {
    await expect(
      db.as("authenticated", admin, () =>
        db.query("insert into public.staff_members (user_id, role) values ($1, 'admin')", [bob]),
      ),
    ).rejects.toThrow(/Only an owner/);
  });

  it("admins can add booking staff", async () => {
    const carol = await db.createUser("carol@example.com");
    await db.as("authenticated", admin, () =>
      db.query("insert into public.staff_members (user_id, role) values ($1, 'booking_staff')", [carol]),
    );
    const { rows } = await db.query("select 1 from public.staff_members where user_id = $1", [carol]);
    expect(rows).toHaveLength(1);
  });

  it("booking staff cannot manage staff", async () => {
    const dave = await db.createUser("dave@example.com");
    await expect(
      db.as("authenticated", staff, () =>
        db.query("insert into public.staff_members (user_id, role) values ($1, 'booking_staff')", [dave]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("staff cannot change their own role", async () => {
    await expect(
      db.as("authenticated", owner, () =>
        db.query("update public.staff_members set role = 'admin' where user_id = $1", [owner]),
      ),
    ).rejects.toThrow(/own role/);
  });
});

describe("catalog visibility", () => {
  it("anonymous visitors see only published packages", async () => {
    await db.query("update public.packages set is_published = false where slug = 'tirupati-sightseeing-talakona'");
    const rows = await db.as("anon", null, async () =>
      (await db.query<{ slug: string }>("select slug from public.packages")).rows,
    );
    expect(rows.map((r) => r.slug)).not.toContain("tirupati-sightseeing-talakona");
    await db.query("update public.packages set is_published = true where slug = 'tirupati-sightseeing-talakona'");
  });

  it("anonymous visitors cannot modify catalog data", async () => {
    await expect(
      db.as("anon", null, () => db.query("update public.packages set title = 'x'")),
    ).rejects.toThrow(/permission denied/);
  });

  it("customers cannot modify prices", async () => {
    await db.as("authenticated", alice, () => db.query("update public.package_prices set price_paise = 1"));
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.package_prices where price_paise = 1");
    expect(rows[0].n).toBe(0);
  });

  it("anonymous visitors cannot read private settings, coupons or pricing rules", async () => {
    await db.query("insert into public.site_settings (key, value, is_public) values ('secret_thing', '{}', false)");
    const settings = await db.as("anon", null, async () =>
      (await db.query<{ key: string }>("select key from public.site_settings")).rows.map((r) => r.key),
    );
    expect(settings).not.toContain("secret_thing");
    await expect(db.as("anon", null, () => db.query("select * from public.coupons"))).rejects.toThrow(/permission denied/);
  });
});

describe("booking data isolation", () => {
  let aliceBooking: { id: string; reference: string };

  beforeAll(async () => {
    aliceBooking = await createBooking(alice);
  });

  it("customers see only their own bookings", async () => {
    const bobsView = await db.as("authenticated", bob, async () =>
      (await db.query("select id from public.bookings where id = $1", [aliceBooking.id])).rows,
    );
    expect(bobsView).toHaveLength(0);
    const alicesView = await db.as("authenticated", alice, async () =>
      (await db.query("select id from public.bookings where id = $1", [aliceBooking.id])).rows,
    );
    expect(alicesView).toHaveLength(1);
  });

  it("customers cannot insert bookings directly (forged prices)", async () => {
    await expect(
      db.as("authenticated", alice, () =>
        db.query(
          `insert into public.bookings (reference, customer_id, booking_type, trip_type, package_id, vehicle_class,
             pickup_location, start_at, end_at, passengers, contact_name, contact_phone, contact_email,
             price_breakdown, subtotal_paise, total_paise)
           values ('YT300101-AAAAA', $1, 'package', 'package', $2, 'muv', 'x', now(), now() + interval '1 hour',
             1, 'A', '9999999999', 'a@b.c', '{}', 1, 1)`,
          [alice, packageId],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("customers cannot change booking status or amounts", async () => {
    await expect(
      db.as("authenticated", alice, () =>
        db.query("update public.bookings set status = 'confirmed' where id = $1", [aliceBooking.id]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as("authenticated", alice, () =>
        db.query("update public.bookings set total_paise = 1 where id = $1", [aliceBooking.id]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("customers cannot call privileged RPCs", async () => {
    await expect(
      db.as("authenticated", alice, () => db.query("select public.create_booking('{}'::jsonb)")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as("authenticated", alice, () =>
        db.query("select public.record_payment_captured('order_x', 'pay_x', 100)"),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("customers cannot see other customers' payments or booking events", async () => {
    await db.query(
      "insert into public.payments (booking_id, provider_order_id, amount_paise) values ($1, 'order_iso_test', 357000)",
      [aliceBooking.id],
    );
    const payments = await db.as("authenticated", bob, async () => (await db.query("select * from public.payments")).rows);
    expect(payments).toHaveLength(0);
    const events = await db.as("authenticated", bob, async () => (await db.query("select * from public.booking_events")).rows);
    expect(events).toHaveLength(0);
  });

  it("booking staff can read all bookings", async () => {
    const rows = await db.as("authenticated", staff, async () =>
      (await db.query("select id from public.bookings where id = $1", [aliceBooking.id])).rows,
    );
    expect(rows).toHaveLength(1);
  });

  it("admin overview requires reports permission", async () => {
    await expect(db.as("authenticated", alice, () => db.query("select public.admin_overview()"))).rejects.toThrow(
      /Not authorised/,
    );
    const rows = await db.as("authenticated", admin, async () => (await db.query("select public.admin_overview() as o")).rows);
    expect(rows[0]).toHaveProperty("o");
  });
});

describe("reviews", () => {
  it("customers cannot review a booking that is not completed", async () => {
    const b = await createBooking(alice, { start_at: "2030-02-01T04:00:00+05:30", end_at: "2030-02-01T20:00:00+05:30" });
    await expect(
      db.as("authenticated", alice, () =>
        db.query(
          "insert into public.reviews (booking_id, customer_id, display_name, rating, body) values ($1, $2, 'Alice', 5, 'Wonderful trip, thank you!')",
          [b.id, alice],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("customers cannot review someone else's completed booking", async () => {
    const b = await createBooking(bob, { start_at: "2030-02-02T04:00:00+05:30", end_at: "2030-02-02T20:00:00+05:30" });
    await db.query("update public.bookings set status = 'completed' where id = $1", [b.id]);
    await expect(
      db.as("authenticated", alice, () =>
        db.query(
          "insert into public.reviews (booking_id, customer_id, display_name, rating, body) values ($1, $2, 'Alice', 5, 'Fake review text here')",
          [b.id, alice],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("customers cannot self-approve reviews and pending reviews are not public", async () => {
    const b = await createBooking(alice, { start_at: "2030-02-03T04:00:00+05:30", end_at: "2030-02-03T20:00:00+05:30" });
    await db.query("update public.bookings set status = 'completed' where id = $1", [b.id]);
    await expect(
      db.as("authenticated", alice, () =>
        db.query(
          "insert into public.reviews (booking_id, customer_id, display_name, rating, body, status) values ($1, $2, 'Alice', 5, 'Great driver and car', 'approved')",
          [b.id, alice],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await db.as("authenticated", alice, () =>
      db.query(
        "insert into public.reviews (booking_id, customer_id, display_name, rating, body) values ($1, $2, 'Alice', 5, 'Great driver and car')",
        [b.id, alice],
      ),
    );
    const publicRows = await db.as("anon", null, async () => (await db.query("select * from public.public_testimonials")).rows);
    expect(publicRows).toHaveLength(0);
  });
});

describe("audit log", () => {
  it("records changes with the acting user and is append-only", async () => {
    await db.as("authenticated", admin, () =>
      db.query("update public.packages set summary = summary || ' ' where slug = 'tirupati-local-temples-tour'"),
    );
    const { rows } = await db.query<{ actor_id: string }>(
      "select actor_id from public.audit_logs where entity_type = 'packages' order by id desc limit 1",
    );
    expect(rows[0].actor_id).toBe(admin);
    await expect(db.query("delete from public.audit_logs")).rejects.toThrow(/append-only/);
  });

  it("is not readable by customers", async () => {
    const rows = await db.as("authenticated", alice, async () => (await db.query("select * from public.audit_logs")).rows);
    expect(rows).toHaveLength(0);
  });
});
