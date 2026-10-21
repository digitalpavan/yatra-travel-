/**
 * Pricing engine — pure functions over integer paise, used ONLY on the server to
 * compute the amount a customer is charged. The browser may display a quote,
 * but the server recomputes it from database values when creating a booking.
 */

export type BookingType = "package" | "cab";
export type CabTripType = "one_way" | "round_trip";
export type VehicleClass = "sedan" | "suv" | "muv" | "tempo_traveller" | "mini_bus";

export interface VehicleRate {
  vehicle_class: VehicleClass;
  label: string;
  seats: number;
  luggage_bags: number;
  base_fare_paise: number;
  per_km_paise: number;
  min_km_per_day: number;
  driver_allowance_per_day_paise: number;
}

export interface PricingRule {
  name: string;
  starts_on: string; // YYYY-MM-DD (IST)
  ends_on: string;
  adjustment_bps: number;
  applies_to: BookingType[];
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  max_discount_paise: number | null;
  min_order_paise: number;
  applies_to: BookingType[];
  valid_from: string;
  valid_until: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
}

export interface TaxConfig {
  tax_rate_bps: number;
  tax_label: string;
  prices_include_tax: boolean;
}

export type BaseFareInput =
  | { kind: "package"; packageTitle: string; vehiclePricePaise: number }
  | { kind: "cab"; tripType: CabTripType; distanceKm: number; days: number; rate: VehicleRate };

export interface QuoteInput {
  base: BaseFareInput;
  tripStartDate: string; // IST date of trip start, YYYY-MM-DD
  rules: PricingRule[];
  coupon?: Coupon | null;
  tax: TaxConfig;
  now: Date;
}

export interface QuoteLine {
  label: string;
  amount_paise: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal_paise: number;
  adjustment_paise: number;
  applied_rules: string[];
  discount_paise: number;
  coupon: { code: string; applied: boolean; reason?: string } | null;
  taxable_paise: number;
  tax_paise: number;
  tax_label: string;
  tax_rate_bps: number;
  tax_included: boolean;
  total_paise: number;
  chargeable_km?: number;
}

export class PricingError extends Error {}

function assertNonNegInt(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0) throw new PricingError(`${name} must be a non-negative integer`);
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function baseFare(input: BaseFareInput): { lines: QuoteLine[]; subtotal: number; chargeableKm?: number } {
  if (input.kind === "package") {
    assertNonNegInt(input.vehiclePricePaise, "vehiclePricePaise");
    if (input.vehiclePricePaise === 0) throw new PricingError("Package price is not set for this vehicle");
    return {
      lines: [{ label: `${input.packageTitle} (per vehicle)`, amount_paise: input.vehiclePricePaise }],
      subtotal: input.vehiclePricePaise,
    };
  }

  const { rate, distanceKm, days, tripType } = input;
  assertNonNegInt(distanceKm, "distanceKm");
  assertNonNegInt(days, "days");
  if (distanceKm < 1) throw new PricingError("Distance must be at least 1 km");
  if (days < 1) throw new PricingError("Trip must be at least 1 day");
  for (const k of ["base_fare_paise", "per_km_paise", "min_km_per_day", "driver_allowance_per_day_paise"] as const) {
    assertNonNegInt(rate[k], k);
  }

  const lines: QuoteLine[] = [];
  if (rate.base_fare_paise > 0) lines.push({ label: "Base fare", amount_paise: rate.base_fare_paise });

  if (tripType === "one_way") {
    const distanceCharge = distanceKm * rate.per_km_paise;
    lines.push({ label: `Distance: ${distanceKm} km × ${rupees(rate.per_km_paise)}/km`, amount_paise: distanceCharge });
    return { lines, subtotal: rate.base_fare_paise + distanceCharge, chargeableKm: distanceKm };
  }

  const roundTripKm = distanceKm * 2;
  const minimumKm = rate.min_km_per_day * days;
  const chargeableKm = Math.max(roundTripKm, minimumKm);
  const distanceCharge = chargeableKm * rate.per_km_paise;
  const allowance = rate.driver_allowance_per_day_paise * days;
  lines.push({
    label:
      chargeableKm > roundTripKm
        ? `Minimum ${rate.min_km_per_day} km/day × ${days} day(s) = ${chargeableKm} km × ${rupees(rate.per_km_paise)}/km`
        : `Round trip: ${chargeableKm} km × ${rupees(rate.per_km_paise)}/km`,
    amount_paise: distanceCharge,
  });
  if (allowance > 0) {
    lines.push({ label: `Driver allowance: ${days} day(s) × ${rupees(rate.driver_allowance_per_day_paise)}`, amount_paise: allowance });
  }
  return { lines, subtotal: rate.base_fare_paise + distanceCharge + allowance, chargeableKm };
}

export function activeRules(rules: PricingRule[], tripStartDate: string, type: BookingType): PricingRule[] {
  return rules.filter(
    (r) => r.applies_to.includes(type) && r.starts_on <= tripStartDate && tripStartDate <= r.ends_on,
  );
}

export type CouponCheck = { ok: true } | { ok: false; reason: string };

export function checkCoupon(coupon: Coupon, type: BookingType, orderPaise: number, now: Date): CouponCheck {
  if (!coupon.is_active) return { ok: false, reason: "This coupon is not active." };
  if (now < new Date(coupon.valid_from)) return { ok: false, reason: "This coupon is not valid yet." };
  if (coupon.valid_until && now > new Date(coupon.valid_until)) return { ok: false, reason: "This coupon has expired." };
  if (!coupon.applies_to.includes(type)) return { ok: false, reason: "This coupon does not apply to this booking type." };
  if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
    return { ok: false, reason: "This coupon has reached its usage limit." };
  }
  if (orderPaise < coupon.min_order_paise) {
    return { ok: false, reason: `This coupon needs a minimum booking value of ${rupees(coupon.min_order_paise)}.` };
  }
  return { ok: true };
}

export function couponDiscount(coupon: Coupon, orderPaise: number): number {
  let discount =
    coupon.discount_type === "percent"
      ? Math.floor((orderPaise * coupon.discount_value) / 10_000)
      : coupon.discount_value;
  if (coupon.max_discount_paise !== null) discount = Math.min(discount, coupon.max_discount_paise);
  return Math.max(0, Math.min(discount, orderPaise));
}

export function computeQuote(input: QuoteInput): Quote {
  const type: BookingType = input.base.kind;
  const { lines, subtotal, chargeableKm } = baseFare(input.base);

  const rules = activeRules(input.rules, input.tripStartDate, type);
  const totalBps = Math.max(-5000, Math.min(10_000, rules.reduce((sum, r) => sum + r.adjustment_bps, 0)));
  const adjustment = Math.round((subtotal * totalBps) / 10_000);
  const adjusted = subtotal + adjustment;

  let discount = 0;
  let coupon: Quote["coupon"] = null;
  if (input.coupon) {
    const check = checkCoupon(input.coupon, type, adjusted, input.now);
    if (check.ok) {
      discount = couponDiscount(input.coupon, adjusted);
      coupon = { code: input.coupon.code, applied: true };
    } else {
      coupon = { code: input.coupon.code, applied: false, reason: check.reason };
    }
  }

  const taxable = adjusted - discount;
  const { tax_rate_bps: rate, prices_include_tax: included } = input.tax;
  assertNonNegInt(rate, "tax_rate_bps");
  const tax = included
    ? taxable - Math.round((taxable * 10_000) / (10_000 + rate))
    : Math.round((taxable * rate) / 10_000);
  const total = included ? taxable : taxable + tax;

  if (total <= 0) throw new PricingError("Total must be greater than zero");

  return {
    lines,
    subtotal_paise: subtotal,
    adjustment_paise: adjustment,
    applied_rules: rules.map((r) => r.name),
    discount_paise: discount,
    coupon,
    taxable_paise: taxable,
    tax_paise: tax,
    tax_label: input.tax.tax_label,
    tax_rate_bps: rate,
    tax_included: included,
    total_paise: total,
    chargeable_km: chargeableKm,
  };
}
