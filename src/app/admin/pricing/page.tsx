import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAnyStaff } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Badge, Checkbox, EmptyState, Field, Input, Select, Textarea } from "@/components/ui";
import { AdminHeader, LoadError, Panel } from "@/components/admin/AdminUI";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import {
  createCoupon,
  createRoute,
  createRule,
  deleteCoupon,
  deleteRoute,
  deleteRule,
  updateCoupon,
  updateRoute,
  updateRule,
} from "./actions";

export const metadata: Metadata = { title: "Pricing & coupons", robots: { index: false, follow: false } };

type BookingType = "package" | "cab";

interface RouteRow {
  id: string;
  slug: string;
  origin: string;
  destination: string;
  distance_km: number;
  typical_duration_minutes: number;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
}

interface RuleRow {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  adjustment_bps: number;
  applies_to: BookingType[];
  is_active: boolean;
}

interface CouponRow {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "flat";
  discount_value: number;
  max_discount_paise: number | null;
  min_order_paise: number;
  applies_to: BookingType[];
  valid_from: string;
  valid_until: string | null;
  usage_limit: number | null;
  per_customer_limit: number;
  used_count: number;
  is_active: boolean;
}

const ROUTE_LABELS = {
  slug: "Slug",
  origin: "Origin",
  destination: "Destination",
  distance_km: "Distance",
  typical_duration_minutes: "Typical duration",
  notes: "Notes",
  sort_order: "Sort order",
};
const RULE_LABELS = { name: "Name", starts_on: "Start date", ends_on: "End date", adjustment: "Adjustment", applies_to: "Applies to" };
const COUPON_LABELS = {
  code: "Code",
  description: "Description",
  discount_type: "Discount type",
  discount_value: "Discount",
  max_discount: "Maximum discount",
  min_order: "Minimum order",
  applies_to: "Applies to",
  valid_from: "Valid from",
  valid_until: "Valid until",
  usage_limit: "Total usage limit",
  per_customer_limit: "Per-customer limit",
};

/** ISO instant → value for <input type="datetime-local"> in IST. */
function istLocal(iso: string): string {
  return new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 16);
}
const pct = (bps: number) => (bps / 100).toString();
const rupees = (paise: number) => (paise / 100).toString();
const dateLabel = (d: string) => formatDate(`${d}T00:00:00+05:30`);
const appliesLabel = (a: BookingType[]) => a.map((t) => (t === "package" ? "Packages" : "Cabs")).join(" + ");

export default async function PricingPage() {
  const viewer = await requireAnyStaff("/admin/pricing");
  const canRoutes = viewer.permissions.includes("catalog.manage");
  const canCoupons = viewer.permissions.includes("coupons.manage");
  if (!canRoutes && !canCoupons) redirect("/admin?denied=1");

  const supabase = await createSupabaseServerClient();
  const [routesRes, rulesRes, couponsRes] = await Promise.all([
    canRoutes
      ? supabase
          .from("cab_routes")
          .select("id, slug, origin, destination, distance_km, typical_duration_minutes, notes, is_active, sort_order")
          .order("sort_order")
          .order("origin")
      : null,
    canCoupons
      ? supabase
          .from("pricing_rules")
          .select("id, name, starts_on, ends_on, adjustment_bps, applies_to, is_active")
          .order("starts_on", { ascending: false })
      : null,
    canCoupons
      ? supabase
          .from("coupons")
          .select(
            "id, code, description, discount_type, discount_value, max_discount_paise, min_order_paise, applies_to, valid_from, valid_until, usage_limit, per_customer_limit, used_count, is_active",
          )
          .order("created_at", { ascending: false })
      : null,
  ]);
  const routes = (routesRes?.data ?? []) as unknown as RouteRow[];
  const rules = (rulesRes?.data ?? []) as unknown as RuleRow[];
  const coupons = (couponsRes?.data ?? []) as unknown as CouponRow[];
  const nowLocal = istLocal(new Date().toISOString());

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Pricing & coupons"
        back={{ href: "/admin", label: "Overview" }}
        intro="Cab routes, seasonal pricing rules and discount coupons. Vehicle per-km rates live on the fleet rate card."
      />

      {canRoutes && (
        <Panel title="Cab routes" id="routes" description="Fixed routes with known distances used for instant cab quotes.">
          {routesRes?.error ? (
            <LoadError what="cab routes" />
          ) : (
            <div className="space-y-3">
              {routes.length === 0 && <EmptyState title="No cab routes yet">Add the first route below.</EmptyState>}
              {routes.map((r) => (
                <details key={r.id} className="rounded-xl border border-line bg-white p-4">
                  <summary className="cursor-pointer">
                    <span className="font-medium text-forest-900">
                      {r.origin} → {r.destination}
                    </span>{" "}
                    <span className="text-sm text-muted">
                      {r.distance_km} km · ~{Math.floor(r.typical_duration_minutes / 60)}h {r.typical_duration_minutes % 60}m
                    </span>{" "}
                    {r.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}
                  </summary>
                  <div className="mt-4 space-y-4">
                    <ActionForm action={updateRoute} labels={ROUTE_LABELS}>
                      <input type="hidden" name="id" value={r.id} />
                      <RouteFields prefix={`r-${r.id}`} route={r} />
                      <div className="mt-4">
                        <AdminSubmit>Save route</AdminSubmit>
                      </div>
                    </ActionForm>
                    <ActionForm action={deleteRoute} confirm={`Delete route ${r.origin} → ${r.destination}?`}>
                      <input type="hidden" name="id" value={r.id} />
                      <AdminSubmit variant="danger" size="sm" pendingLabel="Deleting…">
                        Delete route
                      </AdminSubmit>
                    </ActionForm>
                  </div>
                </details>
              ))}
              <details className="rounded-xl border border-dashed border-forest-300 bg-forest-50/40 p-4" open={routes.length === 0}>
                <summary className="cursor-pointer font-semibold text-forest-800">+ Add a route</summary>
                <div className="mt-4">
                  <ActionForm action={createRoute} labels={ROUTE_LABELS} resetOnSuccess>
                    <RouteFields prefix="new-route" />
                    <div className="mt-4">
                      <AdminSubmit>Add route</AdminSubmit>
                    </div>
                  </ActionForm>
                </div>
              </details>
            </div>
          )}
        </Panel>
      )}

      {canCoupons && (
        <Panel
          title="Seasonal pricing rules"
          id="rules"
          description="Percentage adjustments applied to quotes for trips on the rule's dates (e.g. +20% during Brahmotsavam, −10% off-season)."
        >
          {rulesRes?.error ? (
            <LoadError what="pricing rules" />
          ) : (
            <div className="space-y-3">
              {rules.length === 0 && <EmptyState title="No pricing rules">Standard rates apply on all dates.</EmptyState>}
              {rules.map((r) => (
                <details key={r.id} className="rounded-xl border border-line bg-white p-4">
                  <summary className="cursor-pointer">
                    <span className="font-medium text-forest-900">{r.name}</span>{" "}
                    <span className="text-sm text-muted">
                      {dateLabel(r.starts_on)} – {dateLabel(r.ends_on)} · {appliesLabel(r.applies_to)}
                    </span>{" "}
                    <Badge tone={r.adjustment_bps >= 0 ? "gold" : "blue"}>
                      {r.adjustment_bps > 0 ? "+" : ""}
                      {pct(r.adjustment_bps)}%
                    </Badge>{" "}
                    {!r.is_active && <Badge tone="gray">Inactive</Badge>}
                  </summary>
                  <div className="mt-4 space-y-4">
                    <ActionForm action={updateRule} labels={RULE_LABELS}>
                      <input type="hidden" name="id" value={r.id} />
                      <RuleFields prefix={`pr-${r.id}`} rule={r} />
                      <div className="mt-4">
                        <AdminSubmit>Save rule</AdminSubmit>
                      </div>
                    </ActionForm>
                    <ActionForm action={deleteRule} confirm={`Delete pricing rule “${r.name}”?`}>
                      <input type="hidden" name="id" value={r.id} />
                      <AdminSubmit variant="danger" size="sm" pendingLabel="Deleting…">
                        Delete rule
                      </AdminSubmit>
                    </ActionForm>
                  </div>
                </details>
              ))}
              <details className="rounded-xl border border-dashed border-forest-300 bg-forest-50/40 p-4">
                <summary className="cursor-pointer font-semibold text-forest-800">+ Add a pricing rule</summary>
                <div className="mt-4">
                  <ActionForm action={createRule} labels={RULE_LABELS} resetOnSuccess>
                    <RuleFields prefix="new-rule" />
                    <div className="mt-4">
                      <AdminSubmit>Add rule</AdminSubmit>
                    </div>
                  </ActionForm>
                </div>
              </details>
            </div>
          )}
        </Panel>
      )}

      {canCoupons && (
        <Panel title="Coupons" id="coupons" description="Discount codes customers enter at checkout. Times are in IST.">
          {couponsRes?.error ? (
            <LoadError what="coupons" />
          ) : (
            <div className="space-y-3">
              {coupons.length === 0 && <EmptyState title="No coupons yet" />}
              {coupons.map((c) => (
                <details key={c.id} className="rounded-xl border border-line bg-white p-4">
                  <summary className="cursor-pointer">
                    <span className="font-mono font-semibold text-forest-900">{c.code}</span>{" "}
                    <span className="text-sm text-muted">
                      {c.discount_type === "percent" ? `${pct(c.discount_value)}% off` : `${formatINR(c.discount_value)} off`} · used{" "}
                      {c.used_count}
                      {c.usage_limit ? ` / ${c.usage_limit}` : ""}
                      {c.valid_until ? ` · until ${formatDateTime(c.valid_until)}` : ""}
                    </span>{" "}
                    {c.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}
                  </summary>
                  <div className="mt-4 space-y-4">
                    <p className="text-sm text-muted">
                      Redeemed <strong className="text-charcoal">{c.used_count}</strong> time{c.used_count === 1 ? "" : "s"} (read-only).
                    </p>
                    <ActionForm action={updateCoupon} labels={COUPON_LABELS}>
                      <input type="hidden" name="id" value={c.id} />
                      <CouponFields prefix={`c-${c.id}`} coupon={c} nowLocal={nowLocal} />
                      <div className="mt-4">
                        <AdminSubmit>Save coupon</AdminSubmit>
                      </div>
                    </ActionForm>
                    <ActionForm action={deleteCoupon} confirm={`Delete coupon ${c.code}?`}>
                      <input type="hidden" name="id" value={c.id} />
                      <AdminSubmit variant="danger" size="sm" pendingLabel="Deleting…">
                        Delete coupon
                      </AdminSubmit>
                    </ActionForm>
                  </div>
                </details>
              ))}
              <details className="rounded-xl border border-dashed border-forest-300 bg-forest-50/40 p-4">
                <summary className="cursor-pointer font-semibold text-forest-800">+ Add a coupon</summary>
                <div className="mt-4">
                  <ActionForm action={createCoupon} labels={COUPON_LABELS} resetOnSuccess>
                    <CouponFields prefix="new-coupon" nowLocal={nowLocal} />
                    <div className="mt-4">
                      <AdminSubmit>Create coupon</AdminSubmit>
                    </div>
                  </ActionForm>
                </div>
              </details>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function AppliesTo({ prefix, value }: { prefix: string; value?: BookingType[] }) {
  const v = value ?? ["package", "cab"];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-forest-900">
        Applies to<span className="text-red-700" aria-hidden> *</span>
      </legend>
      <div className="flex flex-wrap gap-4">
        <Checkbox name="applies_to" id={`${prefix}-applies-package`} value="package" label="Packages" defaultChecked={v.includes("package")} />
        <Checkbox name="applies_to" id={`${prefix}-applies-cab`} value="cab" label="Cabs" defaultChecked={v.includes("cab")} />
      </div>
    </fieldset>
  );
}

function RouteFields({ prefix, route }: { prefix: string; route?: RouteRow }) {
  const id = (n: string) => `${prefix}-${n}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Origin" name={id("origin")} required>
        <Input name="origin" id={id("origin")} required maxLength={120} defaultValue={route?.origin} placeholder="Tirupati" />
      </Field>
      <Field label="Destination" name={id("destination")} required>
        <Input name="destination" id={id("destination")} required maxLength={120} defaultValue={route?.destination} placeholder="Chennai" />
      </Field>
      <Field label="Slug" name={id("slug")} required hint="Used in URLs, e.g. tirupati-to-chennai">
        <Input name="slug" id={id("slug")} required maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" defaultValue={route?.slug} />
      </Field>
      <Field label="Distance (km, one way)" name={id("distance_km")} required>
        <Input name="distance_km" id={id("distance_km")} type="number" min={1} max={2000} required defaultValue={route?.distance_km} />
      </Field>
      <Field label="Typical duration (minutes)" name={id("typical_duration_minutes")} required>
        <Input
          name="typical_duration_minutes"
          id={id("typical_duration_minutes")}
          type="number"
          min={5}
          max={2880}
          required
          defaultValue={route?.typical_duration_minutes}
        />
      </Field>
      <Field label="Sort order" name={id("sort_order")}>
        <Input name="sort_order" id={id("sort_order")} type="number" defaultValue={route?.sort_order ?? 0} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Notes" name={id("notes")}>
          <Textarea name="notes" id={id("notes")} maxLength={1000} className="min-h-20" defaultValue={route?.notes ?? ""} />
        </Field>
      </div>
      <Checkbox name="is_active" id={id("is_active")} label="Active (shown to customers)" defaultChecked={route?.is_active ?? true} />
    </div>
  );
}

function RuleFields({ prefix, rule }: { prefix: string; rule?: RuleRow }) {
  const id = (n: string) => `${prefix}-${n}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Name" name={id("name")} required>
          <Input name="name" id={id("name")} required maxLength={120} defaultValue={rule?.name} placeholder="Brahmotsavam surcharge" />
        </Field>
      </div>
      <Field label="Starts on" name={id("starts_on")} required>
        <Input name="starts_on" id={id("starts_on")} type="date" required defaultValue={rule?.starts_on} />
      </Field>
      <Field label="Ends on" name={id("ends_on")} required>
        <Input name="ends_on" id={id("ends_on")} type="date" required defaultValue={rule?.ends_on} />
      </Field>
      <Field label="Adjustment (%)" name={id("adjustment")} required hint="Between −50 and 100. Negative values give a discount.">
        <Input
          name="adjustment"
          id={id("adjustment")}
          type="number"
          step="0.01"
          min={-50}
          max={100}
          required
          defaultValue={rule ? pct(rule.adjustment_bps) : undefined}
        />
      </Field>
      <AppliesTo prefix={prefix} value={rule?.applies_to} />
      <Checkbox name="is_active" id={id("is_active")} label="Active" defaultChecked={rule?.is_active ?? true} />
    </div>
  );
}

function CouponFields({ prefix, coupon, nowLocal }: { prefix: string; coupon?: CouponRow; nowLocal: string }) {
  const id = (n: string) => `${prefix}-${n}`;
  const discountDefault = coupon ? (coupon.discount_type === "percent" ? pct(coupon.discount_value) : rupees(coupon.discount_value)) : undefined;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Code" name={id("code")} required hint="3–30 characters: A–Z, 0–9, _ or -. Stored in upper case.">
        <Input name="code" id={id("code")} required maxLength={30} className="font-mono uppercase" defaultValue={coupon?.code} />
      </Field>
      <Field label="Description" name={id("description")}>
        <Input name="description" id={id("description")} maxLength={300} defaultValue={coupon?.description ?? ""} />
      </Field>
      <Field label="Discount type" name={id("discount_type")} required>
        <Select name="discount_type" id={id("discount_type")} defaultValue={coupon?.discount_type ?? "percent"}>
          <option value="percent">Percentage (%)</option>
          <option value="flat">Flat amount (₹)</option>
        </Select>
      </Field>
      <Field label="Discount" name={id("discount_value")} required hint="Percent (0.01–100) or rupees, depending on the type.">
        <Input name="discount_value" id={id("discount_value")} inputMode="decimal" required defaultValue={discountDefault} />
      </Field>
      <Field label="Maximum discount (₹, optional)" name={id("max_discount")} hint="Caps percentage discounts.">
        <Input
          name="max_discount"
          id={id("max_discount")}
          inputMode="decimal"
          defaultValue={coupon?.max_discount_paise != null ? rupees(coupon.max_discount_paise) : ""}
        />
      </Field>
      <Field label="Minimum order (₹)" name={id("min_order")}>
        <Input name="min_order" id={id("min_order")} inputMode="decimal" defaultValue={coupon ? rupees(coupon.min_order_paise) : "0"} />
      </Field>
      <Field label="Valid from (IST)" name={id("valid_from")} required>
        <Input
          name="valid_from"
          id={id("valid_from")}
          type="datetime-local"
          required
          defaultValue={coupon ? istLocal(coupon.valid_from) : nowLocal}
        />
      </Field>
      <Field label="Valid until (IST, optional)" name={id("valid_until")}>
        <Input
          name="valid_until"
          id={id("valid_until")}
          type="datetime-local"
          defaultValue={coupon?.valid_until ? istLocal(coupon.valid_until) : ""}
        />
      </Field>
      <Field label="Total usage limit (optional)" name={id("usage_limit")}>
        <Input name="usage_limit" id={id("usage_limit")} type="number" min={1} defaultValue={coupon?.usage_limit ?? ""} />
      </Field>
      <Field label="Uses per customer" name={id("per_customer_limit")} required>
        <Input
          name="per_customer_limit"
          id={id("per_customer_limit")}
          type="number"
          min={1}
          max={1000}
          required
          defaultValue={coupon?.per_customer_limit ?? 1}
        />
      </Field>
      <AppliesTo prefix={prefix} value={coupon?.applies_to} />
      <Checkbox name="is_active" id={id("is_active")} label="Active" defaultChecked={coupon?.is_active ?? true} />
    </div>
  );
}
