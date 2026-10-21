"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Alert, Button, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { formatINR } from "@/lib/money";
import type { Quote } from "@/lib/pricing";

type VehicleOption = { vehicle_class: string; label: string; seats: number; luggage_bags: number };
type RouteOption = { slug: string; label: string };

type Props =
  | {
      mode: "package";
      packageSlug: string;
      defaultTime: string;
      vehicles: VehicleOption[];
      minPassengers: number;
      maxPassengers: number;
    }
  | {
      mode: "cab";
      routes: RouteOption[];
      vehicles: VehicleOption[];
      defaultRoute?: string;
    };

type QuoteResponse =
  | { ok: true; quote: Quote; available: boolean; summary: string; vehicle_label: string }
  | { ok: false; error: string; field?: string };

const QUOTE_FIELDS = ["vehicle_class", "trip_date", "pickup_time", "passengers", "luggage_bags", "coupon_code", "route_slug", "trip_type", "return_date"];

const noopSubscribe = () => () => {};

function todayInIndia(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}

export function BookingForm(props: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [values, setValues] = useState<Record<string, string>>(() => ({
    vehicle_class: props.vehicles[0]?.vehicle_class ?? "",
    trip_date: "",
    pickup_time: props.mode === "package" ? props.defaultTime : "06:00",
    passengers: String(props.mode === "package" ? Math.max(1, props.minPassengers) : 2),
    luggage_bags: "0",
    pickup_location: "",
    drop_location: "",
    special_requests: "",
    coupon_code: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    ...(props.mode === "cab" ? { route_slug: props.defaultRoute ?? props.routes[0]?.slug ?? "", trip_type: "one_way", return_date: "" } : {}),
  }));
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Today's date in India, known only in the browser (undefined during server render).
  const minDate = useSyncExternalStore(noopSubscribe, () => todayInIndia(), () => undefined);
  const idempotencyKey = useRef<string>("");

  useEffect(() => {
    idempotencyKey.current = crypto.randomUUID();
    // Prefill contact details for signed-in customers.
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((me: { full_name?: string; phone?: string; email?: string } | null) => {
        if (!me) return;
        setValues((v) => ({
          ...v,
          contact_name: v.contact_name || me.full_name || "",
          contact_phone: v.contact_phone || me.phone || "",
          contact_email: v.contact_email || me.email || "",
        }));
      })
      .catch(() => undefined);
  }, []);

  const set = (name: string) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    setErrors((errs) => ({ ...errs, [name]: "" }));
  };

  const payloadBase = useMemo(() => {
    const base: Record<string, unknown> = { ...values, booking_type: props.mode === "package" ? "package" : "cab" };
    if (props.mode === "package") base.package_slug = props.packageSlug;
    if (base.trip_type !== "round_trip") delete base.return_date;
    return base;
  }, [values, props]);

  const quoteKey = QUOTE_FIELDS.map((f) => values[f] ?? "").join("|");
  const canQuote =
    Boolean(values.trip_date && values.vehicle_class) &&
    !(props.mode === "cab" && values.trip_type === "round_trip" && !values.return_date);
  const visibleQuote = canQuote ? quote : null;

  useEffect(() => {
    if (!canQuote) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoting(true);
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payloadBase, pickup_location: values.pickup_location || "TBD" }),
          signal: controller.signal,
        });
        setQuote((await res.json()) as QuoteResponse);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setQuote({ ok: false, error: "Could not fetch a price right now. Please try again." });
      } finally {
        setQuoting(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  async function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setMessage(null);
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payloadBase,
          accept_terms: acceptTerms,
          whatsapp_opt_in: whatsappOptIn,
          idempotency_key: idempotencyKey.current,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { reference?: string; error?: string; errors?: Record<string, string> };
      if (res.status === 401) {
        setMessage("Please sign in or create an account to complete your booking. Your trip details will be kept on this page.");
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!res.ok || !json.reference) {
        setErrors(json.errors ?? {});
        setMessage(json.error ?? "We could not create your booking. Please check the form and try again.");
        return;
      }
      router.push(`/account/bookings/${json.reference}?new=1`);
    } catch {
      setMessage("Network error — your booking was not created. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedVehicle = props.vehicles.find((v) => v.vehicle_class === values.vehicle_class);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {props.mode === "cab" && (
        <>
          <Field label="Route" name="route_slug" required error={errors.route_slug}>
            <Select name="route_slug" value={values.route_slug} onChange={set("route_slug")} required>
              {props.routes.map((r) => (
                <option key={r.slug} value={r.slug}>{r.label}</option>
              ))}
            </Select>
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-forest-900">Trip type</legend>
            <div className="flex gap-4 text-sm">
              {[
                ["one_way", "One way"],
                ["round_trip", "Round trip"],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input type="radio" name="trip_type" value={value} checked={values.trip_type === value} onChange={set("trip_type")} className="accent-forest-800" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <Field label="Vehicle" name="vehicle_class" required error={errors.vehicle_class}>
        <Select name="vehicle_class" value={values.vehicle_class} onChange={set("vehicle_class")} required error={errors.vehicle_class}>
          {props.vehicles.map((v) => (
            <option key={v.vehicle_class} value={v.vehicle_class}>{v.label}</option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={props.mode === "cab" && values.trip_type === "round_trip" ? "Departure date" : "Trip date"} name="trip_date" required error={errors.trip_date}>
          <Input type="date" name="trip_date" min={minDate} value={values.trip_date} onChange={set("trip_date")} required error={errors.trip_date} />
        </Field>
        <Field label="Pickup time" name="pickup_time" required error={errors.pickup_time}>
          <Input type="time" name="pickup_time" value={values.pickup_time} onChange={set("pickup_time")} required error={errors.pickup_time} />
        </Field>
      </div>

      {props.mode === "cab" && values.trip_type === "round_trip" && (
        <Field label="Return date" name="return_date" required error={errors.return_date}>
          <Input type="date" name="return_date" min={values.trip_date || minDate} value={values.return_date} onChange={set("return_date")} required error={errors.return_date} />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Passengers" name="passengers" required error={errors.passengers} hint={selectedVehicle ? `Up to ${selectedVehicle.seats}` : undefined}>
          <Input
            type="number"
            inputMode="numeric"
            name="passengers"
            min={props.mode === "package" ? props.minPassengers : 1}
            max={selectedVehicle?.seats ?? 60}
            value={values.passengers}
            onChange={set("passengers")}
            required
            error={errors.passengers}
          />
        </Field>
        <Field label="Luggage (bags)" name="luggage_bags" error={errors.luggage_bags} hint={selectedVehicle ? `Fits about ${selectedVehicle.luggage_bags}` : undefined}>
          <Input type="number" inputMode="numeric" name="luggage_bags" min={0} max={60} value={values.luggage_bags} onChange={set("luggage_bags")} error={errors.luggage_bags} />
        </Field>
      </div>

      <Field label="Pickup address" name="pickup_location" required error={errors.pickup_location} hint="Hotel, railway station, airport or address in Tirupati">
        <Input name="pickup_location" autoComplete="street-address" value={values.pickup_location} onChange={set("pickup_location")} required maxLength={200} error={errors.pickup_location} />
      </Field>
      <Field label="Drop-off address (optional)" name="drop_location" error={errors.drop_location}>
        <Input name="drop_location" value={values.drop_location} onChange={set("drop_location")} maxLength={200} error={errors.drop_location} />
      </Field>
      <Field label="Special requests (optional)" name="special_requests" error={errors.special_requests} hint="E.g. senior citizens, child seat, wheelchair">
        <Textarea name="special_requests" value={values.special_requests} onChange={set("special_requests")} maxLength={1000} rows={3} error={errors.special_requests} />
      </Field>

      <fieldset className="space-y-3 rounded-xl border border-line p-3">
        <legend className="px-1 text-sm font-semibold text-forest-900">Contact details</legend>
        <Field label="Full name" name="contact_name" required error={errors.contact_name}>
          <Input name="contact_name" autoComplete="name" value={values.contact_name} onChange={set("contact_name")} required error={errors.contact_name} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mobile number" name="contact_phone" required error={errors.contact_phone}>
            <Input type="tel" name="contact_phone" autoComplete="tel" value={values.contact_phone} onChange={set("contact_phone")} required error={errors.contact_phone} />
          </Field>
          <Field label="Email" name="contact_email" required error={errors.contact_email}>
            <Input type="email" name="contact_email" autoComplete="email" value={values.contact_email} onChange={set("contact_email")} required error={errors.contact_email} />
          </Field>
        </div>
      </fieldset>

      <Field label="Coupon code (optional)" name="coupon_code" error={errors.coupon_code}>
        <Input name="coupon_code" value={values.coupon_code} onChange={set("coupon_code")} autoCapitalize="characters" maxLength={30} error={errors.coupon_code} />
      </Field>

      <QuotePanel quote={visibleQuote} loading={canQuote && quoting} />

      <Checkbox
        name="whatsapp_opt_in"
        checked={whatsappOptIn}
        onChange={(e) => setWhatsappOptIn(e.target.checked)}
        label="Send booking updates on WhatsApp (optional). You can turn this off any time in your account."
      />
      <Checkbox
        name="accept_terms"
        checked={acceptTerms}
        onChange={(e) => setAcceptTerms(e.target.checked)}
        error={errors.accept_terms}
        label={
          <>
            I agree to the <Link className="underline" href="/terms" target="_blank">terms</Link> and{" "}
            <Link className="underline" href="/cancellation-refund-policy" target="_blank">cancellation &amp; refund policy</Link>, and understand that darshan tickets are not included.
          </>
        }
      />

      {message && <Alert tone="error">{message}</Alert>}

      <Button type="submit" variant="gold" size="lg" className="w-full" disabled={submitting || (visibleQuote?.ok === true && !visibleQuote.available)}>
        {submitting ? "Creating booking…" : "Continue to payment"}
      </Button>
      <p className="text-center text-xs text-muted">You will be asked to sign in. Your vehicle is held for a limited time while you pay.</p>
    </form>
  );
}

function QuotePanel({ quote, loading }: { quote: QuoteResponse | null; loading: boolean }) {
  if (!quote && !loading) {
    return <p className="rounded-xl bg-ivory-dark px-3 py-2 text-sm text-muted">Choose a date to see your fare.</p>;
  }
  return (
    <div aria-live="polite" className="rounded-xl border border-gold-200 bg-gold-50 p-3 text-sm">
      {loading && !quote && <p>Calculating fare…</p>}
      {quote && !quote.ok && <p className="text-red-800">{quote.error}</p>}
      {quote?.ok && (
        <div className={loading ? "opacity-60" : ""}>
          <p className="mb-2 font-semibold text-forest-900">{quote.summary} · {quote.vehicle_label}</p>
          <dl className="space-y-1">
            {quote.quote.lines.map((l) => (
              <div key={l.label} className="flex justify-between gap-3">
                <dt className="text-muted">{l.label}</dt>
                <dd>{formatINR(l.amount_paise)}</dd>
              </div>
            ))}
            {quote.quote.adjustment_paise !== 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Seasonal adjustment ({quote.quote.applied_rules.join(", ")})</dt>
                <dd>{formatINR(quote.quote.adjustment_paise)}</dd>
              </div>
            )}
            {quote.quote.coupon && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Coupon {quote.quote.coupon.code}</dt>
                <dd>{quote.quote.coupon.applied ? `−${formatINR(quote.quote.discount_paise)}` : <span className="text-red-800">{quote.quote.coupon.reason}</span>}</dd>
              </div>
            )}
            {quote.quote.tax_paise > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">
                  {quote.quote.tax_label} ({quote.quote.tax_rate_bps / 100}%){quote.quote.tax_included ? " included" : ""}
                </dt>
                <dd>{formatINR(quote.quote.tax_paise)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 border-t border-gold-200 pt-2 text-base font-semibold text-forest-900">
              <dt>Total</dt>
              <dd>{formatINR(quote.quote.total_paise)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">Tolls, parking and interstate permits are extra unless stated.</p>
          {!quote.available && (
            <p className="mt-2 font-semibold text-red-800">No vehicle of this type is free for these dates. Try another vehicle or date.</p>
          )}
        </div>
      )}
    </div>
  );
}
