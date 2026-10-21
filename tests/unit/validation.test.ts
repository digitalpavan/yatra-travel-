import { describe, expect, it } from "vitest";
import { istCalendarDays, istDateString, istDateTime } from "@/lib/dates";
import { formatINR, rupeesToPaise } from "@/lib/money";
import { bookingRequestSchema, contactSchema, normalizePhone, quoteRequestSchema, safeNextPath } from "@/lib/validation";

const validBooking = {
  booking_type: "package",
  package_slug: "tirumala-hill-transfer-same-day",
  vehicle_class: "muv",
  trip_date: "2030-01-10",
  pickup_time: "05:00",
  pickup_location: "Hotel Bliss, Tirupati",
  passengers: "4",
  luggage_bags: "2",
  contact_name: "Lakshmi",
  contact_phone: "98765 43210",
  contact_email: "Lakshmi@Example.com",
  idempotency_key: "4f9c2b1e-5d6a-4b7c-8e9f-0a1b2c3d4e5f",
  accept_terms: true,
};

describe("booking validation", () => {
  it("accepts and normalises a valid booking", () => {
    const r = bookingRequestSchema.parse(validBooking);
    expect(r.contact_phone).toBe("+919876543210");
    expect(r.contact_email).toBe("lakshmi@example.com");
    expect(r.passengers).toBe(4);
  });

  it("requires accepting the terms", () => {
    expect(bookingRequestSchema.safeParse({ ...validBooking, accept_terms: false }).success).toBe(false);
  });

  it("rejects bad dates, times, passenger counts and vehicle classes", () => {
    for (const bad of [
      { trip_date: "10-01-2030" },
      { pickup_time: "25:00" },
      { passengers: "0" },
      { passengers: "61" },
      { vehicle_class: "helicopter" },
      { package_slug: "../../etc/passwd" },
      { luggage_bags: "-1" },
    ]) {
      expect(bookingRequestSchema.safeParse({ ...validBooking, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it("ignores client-sent prices (no price fields in the schema)", () => {
    const r = bookingRequestSchema.parse({ ...validBooking, total_paise: 1, price: 1 });
    expect(r).not.toHaveProperty("total_paise");
    expect(r).not.toHaveProperty("price");
  });

  it("limits free-text lengths", () => {
    expect(bookingRequestSchema.safeParse({ ...validBooking, special_requests: "x".repeat(1001) }).success).toBe(false);
  });

  it("validates cab requests", () => {
    const common = Object.fromEntries(Object.entries(validBooking).filter(([k]) => k !== "package_slug"));
    const cab = { ...common, booking_type: "cab", trip_type: "round_trip", route_slug: "tirupati-to-tirumala", return_date: "2030-01-11" };
    expect(quoteRequestSchema.safeParse(cab).success).toBe(true);
    expect(quoteRequestSchema.safeParse({ ...cab, trip_type: "teleport" }).success).toBe(false);
  });
});

describe("contact validation", () => {
  it("rejects filled honeypot fields", () => {
    const base = { name: "Ravi", email: "ravi@example.com", subject: "Trip", message: "Need a cab tomorrow morning" };
    expect(contactSchema.safeParse(base).success).toBe(true);
    expect(contactSchema.safeParse({ ...base, website: "http://spam" }).success).toBe(false);
  });
});

describe("normalizePhone", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["+14155550100", "+14155550100"],
  ])("%s → %s", (input, out) => expect(normalizePhone(input)).toBe(out));
});

describe("safeNextPath (open-redirect protection)", () => {
  it.each([
    ["/account/bookings", "/account/bookings"],
    ["https://evil.example", "/account"],
    ["//evil.example", "/account"],
    ["/\\evil.example", "/account"],
    ["javascript:alert(1)", "/account"],
    [null, "/account"],
  ])("%s → %s", (input, out) => expect(safeNextPath(input)).toBe(out));
});

describe("IST dates", () => {
  it("interprets date+time in India Standard Time", () => {
    expect(istDateTime("2030-01-10", "05:30").toISOString()).toBe("2030-01-10T00:00:00.000Z");
    expect(istDateString(new Date("2030-01-09T20:00:00Z"))).toBe("2030-01-10");
  });
  it("rejects impossible dates", () => {
    expect(() => istDateTime("2030-02-31", "10:00")).toThrow();
    expect(() => istDateTime("2030-01-10", "24:00")).toThrow();
  });
  it("counts calendar days inclusively", () => {
    expect(istCalendarDays(istDateTime("2030-01-10", "06:00"), istDateTime("2030-01-10", "23:59"))).toBe(1);
    expect(istCalendarDays(istDateTime("2030-01-10", "06:00"), istDateTime("2030-01-12", "23:59"))).toBe(3);
  });
});

describe("money", () => {
  it("formats and parses rupees", () => {
    expect(formatINR(357000)).toBe("₹3,570");
    expect(formatINR(357050)).toBe("₹3,570.50");
    expect(rupeesToPaise("3,570.50")).toBe(357050);
    expect(() => rupeesToPaise("-1")).toThrow();
  });
});
