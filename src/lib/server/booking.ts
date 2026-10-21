import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { istCalendarDays, istDateString, istDateTime } from "@/lib/dates";
import { computeQuote, PricingError, type Coupon, type PricingRule, type Quote, type VehicleRate } from "@/lib/pricing";
import { mergeSettings } from "@/lib/data/catalog";
import type { BookingRequest, QuoteRequest } from "@/lib/validation";
import type { SiteSettings } from "@/lib/types";

/** A user-facing validation problem, optionally tied to a form field. */
export class BookingError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
  }
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface PreparedQuote {
  quote: Quote;
  start: Date;
  end: Date;
  days: number;
  rate: VehicleRate;
  available: boolean;
  packageId: string | null;
  routeId: string | null;
  tripType: "package" | "one_way" | "round_trip";
  coupon: Coupon | null;
  settings: SiteSettings;
  summary: string;
}

/**
 * Validate a trip request and price it from FRESH database values (not cached,
 * never from client input). Used for both live quotes and booking creation.
 */
export async function prepareQuote(req: QuoteRequest, now = new Date()): Promise<PreparedQuote> {
  const db = createSupabaseAdminClient();

  const [{ data: settingRows }, { data: rate }, { data: ruleRows }] = await Promise.all([
    db.from("site_settings").select("key, value"),
    db.from("vehicle_rates").select("*").eq("vehicle_class", req.vehicle_class).eq("is_active", true).maybeSingle<VehicleRate>(),
    db.from("pricing_rules").select("name, starts_on, ends_on, adjustment_bps, applies_to").eq("is_active", true).gte("ends_on", istDateString(now)),
  ]);
  const settings = mergeSettings(settingRows ?? []);
  if (!rate) throw new BookingError("This vehicle type is not available.", "vehicle_class");

  let start: Date;
  try {
    start = istDateTime(req.trip_date, req.pickup_time);
  } catch {
    throw new BookingError("Choose a valid date and time.", "trip_date");
  }
  const { min_lead_hours, max_advance_days } = settings.booking;
  if (start.getTime() < now.getTime() + min_lead_hours * 3_600_000) {
    throw new BookingError(`Online bookings need at least ${min_lead_hours} hours' notice. For urgent trips, please contact us.`, "trip_date");
  }
  if (start.getTime() > now.getTime() + max_advance_days * 86_400_000) {
    throw new BookingError(`Bookings can be made up to ${max_advance_days} days in advance.`, "trip_date");
  }
  if (req.passengers > rate.seats) {
    throw new BookingError(`A ${rate.label} seats up to ${rate.seats} passengers. Please choose a larger vehicle.`, "passengers");
  }
  if (req.luggage_bags > rate.luggage_bags) {
    throw new BookingError(`A ${rate.label} fits about ${rate.luggage_bags} bags. Please choose a larger vehicle.`, "luggage_bags");
  }

  let end: Date;
  let days = 1;
  let packageId: string | null = null;
  let routeId: string | null = null;
  let tripType: PreparedQuote["tripType"];
  let summary: string;
  let base: Parameters<typeof computeQuote>[0]["base"];

  if (req.booking_type === "package") {
    const { data: pkg } = await db
      .from("packages")
      .select("id, title, duration_days, min_passengers, max_passengers, package_prices(vehicle_class, price_paise)")
      .eq("slug", req.package_slug)
      .eq("is_published", true)
      .maybeSingle<{
        id: string;
        title: string;
        duration_days: number;
        min_passengers: number;
        max_passengers: number;
        package_prices: { vehicle_class: string; price_paise: number }[];
      }>();
    if (!pkg) throw new BookingError("This package is no longer available.", "package_slug");
    if (req.passengers < pkg.min_passengers || req.passengers > pkg.max_passengers) {
      throw new BookingError(`This package is for ${pkg.min_passengers}–${pkg.max_passengers} passengers.`, "passengers");
    }
    const price = pkg.package_prices.find((p) => p.vehicle_class === req.vehicle_class);
    if (!price) throw new BookingError("This package is not offered with the selected vehicle.", "vehicle_class");
    packageId = pkg.id;
    tripType = "package";
    days = pkg.duration_days;
    end = istDateTime(addDays(req.trip_date, pkg.duration_days - 1), "23:59");
    summary = pkg.title;
    base = { kind: "package", packageTitle: pkg.title, vehiclePricePaise: price.price_paise };
  } else {
    const { data: route } = await db
      .from("cab_routes")
      .select("id, origin, destination, distance_km, typical_duration_minutes")
      .eq("slug", req.route_slug)
      .eq("is_active", true)
      .maybeSingle<{ id: string; origin: string; destination: string; distance_km: number; typical_duration_minutes: number }>();
    if (!route) throw new BookingError("This route is not available. Request a custom itinerary instead.", "route_slug");
    routeId = route.id;
    tripType = req.trip_type;
    const legMs = (route.typical_duration_minutes + 60) * 60_000; // + buffer for traffic/ghat checks
    if (req.trip_type === "one_way") {
      end = new Date(start.getTime() + legMs);
    } else {
      if (!req.return_date) throw new BookingError("Choose a return date for a round trip.", "return_date");
      if (req.return_date < req.trip_date) throw new BookingError("Return date must be on or after the trip date.", "return_date");
      let returnEnd: Date;
      try {
        returnEnd = istDateTime(req.return_date, "23:59");
      } catch {
        throw new BookingError("Choose a valid return date.", "return_date");
      }
      end = new Date(Math.max(returnEnd.getTime(), start.getTime() + 2 * legMs));
      days = istCalendarDays(start, end);
      if (days > 30) throw new BookingError("Round trips can be booked online for up to 30 days.", "return_date");
    }
    summary = `${route.origin} → ${route.destination}${req.trip_type === "round_trip" ? " (round trip)" : ""}`;
    base = { kind: "cab", tripType: req.trip_type, distanceKm: route.distance_km, days, rate };
  }

  let coupon: Coupon | null = null;
  if (req.coupon_code) {
    const { data } = await db.from("coupons").select("*").eq("code", req.coupon_code).maybeSingle<Coupon>();
    if (!data) throw new BookingError("This coupon code is not valid.", "coupon_code");
    coupon = data;
  }

  let quote: Quote;
  try {
    quote = computeQuote({
      base,
      tripStartDate: req.trip_date,
      rules: (ruleRows ?? []) as PricingRule[],
      coupon,
      tax: {
        tax_rate_bps: settings.booking.tax_rate_bps,
        tax_label: settings.booking.tax_label,
        prices_include_tax: settings.booking.prices_include_tax,
      },
      now,
    });
  } catch (error) {
    if (error instanceof PricingError) throw new BookingError(error.message);
    throw error;
  }

  const { data: availableCount, error: availabilityError } = await db.rpc("available_vehicle_count", {
    p_class: req.vehicle_class,
    p_start: start.toISOString(),
    p_end: end.toISOString(),
  });
  if (availabilityError) throw new Error(`Availability check failed: ${availabilityError.message}`);

  return {
    quote,
    start,
    end,
    days,
    rate,
    available: (availableCount as number) > 0,
    packageId,
    routeId,
    tripType,
    coupon,
    settings,
    summary,
  };
}

/** Create a pending booking (capacity hold) for an authenticated customer. */
export async function createBooking(req: BookingRequest, customerId: string, now = new Date()) {
  const prepared = await prepareQuote(req, now);
  const { quote } = prepared;

  if (prepared.coupon && !quote.coupon?.applied) {
    throw new BookingError(quote.coupon?.reason ?? "This coupon cannot be applied.", "coupon_code");
  }
  if (!prepared.available) {
    throw new BookingError("Sorry — no vehicle of this type is available for those dates. Try another vehicle or date.", "vehicle_class");
  }

  const db = createSupabaseAdminClient();
  const { data, error } = await db
    .rpc("create_booking", {
      p: {
        customer_id: customerId,
        idempotency_key: req.idempotency_key,
        booking_type: req.booking_type,
        trip_type: prepared.tripType,
        package_id: prepared.packageId,
        cab_route_id: prepared.routeId,
        vehicle_class: req.vehicle_class,
        pickup_location: req.pickup_location,
        drop_location: req.drop_location ?? null,
        start_at: prepared.start.toISOString(),
        end_at: prepared.end.toISOString(),
        trip_days: prepared.days,
        passengers: req.passengers,
        luggage_bags: req.luggage_bags,
        special_requests: req.special_requests ?? "",
        contact_name: req.contact_name,
        contact_phone: req.contact_phone,
        contact_email: req.contact_email,
        price_breakdown: { ...quote, summary: prepared.summary, vehicle_label: prepared.rate.label },
        subtotal_paise: quote.subtotal_paise,
        adjustment_paise: quote.adjustment_paise,
        discount_paise: quote.discount_paise,
        tax_paise: quote.tax_paise,
        total_paise: quote.total_paise,
        hold_minutes: prepared.settings.booking.hold_minutes,
      },
      p_coupon_id: prepared.coupon && quote.coupon?.applied ? prepared.coupon.id : null,
    })
    .single<{ id: string; reference: string }>();

  if (error) {
    const hint = (error as { hint?: string }).hint;
    if (hint === "NO_AVAILABILITY") throw new BookingError(error.message, "vehicle_class");
    if (hint?.startsWith("COUPON")) throw new BookingError(error.message, "coupon_code");
    throw new Error(`create_booking failed: ${error.message}`);
  }

  // Record consent captured at checkout (append-only) and the WhatsApp preference.
  const consents = [
    { user_id: customerId, purpose: "booking_terms", granted: true },
    { user_id: customerId, purpose: "whatsapp_updates", granted: req.whatsapp_opt_in },
  ].map((c) => ({ ...c, policy_version: prepared.settings.legal.policy_version, source: "booking" }));
  await db.from("consent_records").insert(consents);
  if (req.whatsapp_opt_in) await db.from("profiles").update({ whatsapp_opt_in: true }).eq("id", customerId);

  return data!;
}
