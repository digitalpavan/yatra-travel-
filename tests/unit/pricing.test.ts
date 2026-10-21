import { describe, expect, it } from "vitest";
import { baseFare, checkCoupon, computeQuote, couponDiscount, PricingError, type Coupon, type VehicleRate } from "@/lib/pricing";

const MUV: VehicleRate = {
  vehicle_class: "muv",
  label: "Premium MUV",
  seats: 7,
  luggage_bags: 4,
  base_fare_paise: 50_000,
  per_km_paise: 1_900,
  min_km_per_day: 250,
  driver_allowance_per_day_paise: 50_000,
};
const NOW = new Date("2030-01-01T00:00:00+05:30");
const NO_TAX = { tax_rate_bps: 0, tax_label: "GST", prices_include_tax: false };
const GST5 = { tax_rate_bps: 500, tax_label: "GST", prices_include_tax: false };

function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: "c1",
    code: "SAVE10",
    discount_type: "percent",
    discount_value: 1000,
    max_discount_paise: null,
    min_order_paise: 0,
    applies_to: ["package", "cab"],
    valid_from: "2029-01-01T00:00:00Z",
    valid_until: null,
    usage_limit: null,
    used_count: 0,
    is_active: true,
    ...overrides,
  };
}

describe("baseFare", () => {
  it("prices a package per vehicle", () => {
    const r = baseFare({ kind: "package", packageTitle: "Tirumala", vehiclePricePaise: 340_000 });
    expect(r.subtotal).toBe(340_000);
  });

  it("prices a one-way cab as base fare + distance × rate", () => {
    const r = baseFare({ kind: "cab", tripType: "one_way", distanceKm: 22, days: 1, rate: MUV });
    expect(r.subtotal).toBe(50_000 + 22 * 1_900);
    expect(r.chargeableKm).toBe(22);
  });

  it("applies the minimum km per day and driver allowance on round trips", () => {
    // 2 × 36 km = 72 km < 250 km minimum for one day.
    const r = baseFare({ kind: "cab", tripType: "round_trip", distanceKm: 36, days: 1, rate: MUV });
    expect(r.chargeableKm).toBe(250);
    expect(r.subtotal).toBe(50_000 + 250 * 1_900 + 50_000);
  });

  it("charges actual distance when it exceeds the minimum", () => {
    // Tirupati → Bengaluru and back = 500 km over 1 day.
    const r = baseFare({ kind: "cab", tripType: "round_trip", distanceKm: 250, days: 1, rate: MUV });
    expect(r.chargeableKm).toBe(500);
  });

  it("scales the minimum and allowance with days", () => {
    const r = baseFare({ kind: "cab", tripType: "round_trip", distanceKm: 140, days: 3, rate: MUV });
    expect(r.chargeableKm).toBe(750);
    expect(r.subtotal).toBe(50_000 + 750 * 1_900 + 3 * 50_000);
  });

  it("rejects invalid inputs", () => {
    expect(() => baseFare({ kind: "package", packageTitle: "x", vehiclePricePaise: 0 })).toThrow(PricingError);
    expect(() => baseFare({ kind: "package", packageTitle: "x", vehiclePricePaise: 10.5 })).toThrow(PricingError);
    expect(() => baseFare({ kind: "cab", tripType: "one_way", distanceKm: 0, days: 1, rate: MUV })).toThrow(PricingError);
    expect(() => baseFare({ kind: "cab", tripType: "one_way", distanceKm: -5, days: 1, rate: MUV })).toThrow(PricingError);
  });
});

describe("computeQuote", () => {
  const pkg = { kind: "package" as const, packageTitle: "Tirumala", vehiclePricePaise: 340_000 };

  it("adds tax on top when prices exclude tax", () => {
    const q = computeQuote({ base: pkg, tripStartDate: "2030-01-10", rules: [], tax: GST5, now: NOW });
    expect(q.tax_paise).toBe(17_000);
    expect(q.total_paise).toBe(357_000);
  });

  it("extracts tax when prices include tax", () => {
    const q = computeQuote({ base: { ...pkg, vehiclePricePaise: 105_000 }, tripStartDate: "2030-01-10", rules: [], tax: { ...GST5, prices_include_tax: true }, now: NOW });
    expect(q.total_paise).toBe(105_000);
    expect(q.tax_paise).toBe(5_000);
  });

  it("applies seasonal rules only within their dates and booking type", () => {
    const rules = [
      { name: "Brahmotsavam", starts_on: "2030-01-05", ends_on: "2030-01-15", adjustment_bps: 2000, applies_to: ["package" as const] },
      { name: "Cab only", starts_on: "2030-01-01", ends_on: "2030-12-31", adjustment_bps: 5000, applies_to: ["cab" as const] },
    ];
    const inSeason = computeQuote({ base: pkg, tripStartDate: "2030-01-10", rules, tax: NO_TAX, now: NOW });
    expect(inSeason.adjustment_paise).toBe(68_000);
    expect(inSeason.applied_rules).toEqual(["Brahmotsavam"]);
    const offSeason = computeQuote({ base: pkg, tripStartDate: "2030-02-10", rules, tax: NO_TAX, now: NOW });
    expect(offSeason.adjustment_paise).toBe(0);
  });

  it("clamps combined adjustments", () => {
    const rules = Array.from({ length: 5 }, (_, i) => ({ name: `r${i}`, starts_on: "2030-01-01", ends_on: "2030-12-31", adjustment_bps: 5000, applies_to: ["package" as const] }));
    const q = computeQuote({ base: pkg, tripStartDate: "2030-06-01", rules, tax: NO_TAX, now: NOW });
    expect(q.adjustment_paise).toBe(340_000); // +100% max
  });

  it("applies percentage coupons before tax, with a cap", () => {
    const q = computeQuote({ base: pkg, tripStartDate: "2030-01-10", rules: [], coupon: coupon({ max_discount_paise: 20_000 }), tax: GST5, now: NOW });
    expect(q.discount_paise).toBe(20_000);
    expect(q.taxable_paise).toBe(320_000);
    expect(q.tax_paise).toBe(16_000);
    expect(q.total_paise).toBe(336_000);
    expect(q.coupon).toEqual({ code: "SAVE10", applied: true });
  });

  it("reports but does not apply invalid coupons", () => {
    const q = computeQuote({ base: pkg, tripStartDate: "2030-01-10", rules: [], coupon: coupon({ valid_until: "2029-06-01T00:00:00Z" }), tax: NO_TAX, now: NOW });
    expect(q.discount_paise).toBe(0);
    expect(q.coupon?.applied).toBe(false);
    expect(q.coupon?.reason).toMatch(/expired/);
  });

  it("never discounts below zero", () => {
    expect(couponDiscount(coupon({ discount_type: "flat", discount_value: 999_999 }), 50_000)).toBe(50_000);
    expect(() =>
      computeQuote({ base: pkg, tripStartDate: "2030-01-10", rules: [], coupon: coupon({ discount_type: "flat", discount_value: 999_999 }), tax: NO_TAX, now: NOW }),
    ).toThrow(/greater than zero/);
  });

  it("produces integer paise everywhere", () => {
    const q = computeQuote({
      base: { kind: "cab", tripType: "one_way", distanceKm: 37, days: 1, rate: { ...MUV, per_km_paise: 1_333 } },
      tripStartDate: "2030-01-10",
      rules: [{ name: "x", starts_on: "2030-01-01", ends_on: "2030-12-31", adjustment_bps: 333, applies_to: ["cab"] }],
      coupon: coupon({ discount_value: 777 }),
      tax: { ...GST5, tax_rate_bps: 1800 },
      now: NOW,
    });
    for (const v of [q.subtotal_paise, q.adjustment_paise, q.discount_paise, q.tax_paise, q.total_paise]) {
      expect(Number.isInteger(v)).toBe(true);
    }
    expect(q.total_paise).toBe(q.subtotal_paise + q.adjustment_paise - q.discount_paise + q.tax_paise);
  });
});

describe("checkCoupon", () => {
  it("validates activity, dates, type, usage and minimum order", () => {
    expect(checkCoupon(coupon(), "cab", 1000, NOW).ok).toBe(true);
    expect(checkCoupon(coupon({ is_active: false }), "cab", 1000, NOW).ok).toBe(false);
    expect(checkCoupon(coupon({ valid_from: "2031-01-01T00:00:00Z" }), "cab", 1000, NOW).ok).toBe(false);
    expect(checkCoupon(coupon({ applies_to: ["package"] }), "cab", 1000, NOW).ok).toBe(false);
    expect(checkCoupon(coupon({ usage_limit: 5, used_count: 5 }), "cab", 1000, NOW).ok).toBe(false);
    expect(checkCoupon(coupon({ min_order_paise: 5000 }), "cab", 1000, NOW).ok).toBe(false);
  });
});
