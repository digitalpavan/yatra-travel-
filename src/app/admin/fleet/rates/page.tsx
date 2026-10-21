import type { Metadata } from "next";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/money";
import { Badge, Checkbox, EmptyState, Field, Input } from "@/components/ui";
import { AdminHeader, LoadError, Panel } from "@/components/admin/AdminUI";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { updateVehicleRate } from "../actions";

export const metadata: Metadata = { title: "Vehicle rate card", robots: { index: false, follow: false } };

interface RateRow {
  vehicle_class: string;
  label: string;
  example_models: string;
  seats: number;
  luggage_bags: number;
  base_fare_paise: number;
  per_km_paise: number;
  min_km_per_day: number;
  driver_allowance_per_day_paise: number;
  is_active: boolean;
  sort_order: number;
}

const LABELS = {
  label: "Label",
  example_models: "Example models",
  seats: "Seats",
  luggage_bags: "Luggage bags",
  base_fare: "Base fare",
  per_km: "Per-km rate",
  min_km_per_day: "Minimum km per day",
  driver_allowance_per_day: "Driver allowance per day",
  sort_order: "Sort order",
};

const rupees = (paise: number) => (paise / 100).toString();

export default async function VehicleRatesPage() {
  await requirePermission("fleet.manage", "/admin/fleet/rates");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vehicle_rates")
    .select(
      "vehicle_class, label, example_models, seats, luggage_bags, base_fare_paise, per_km_paise, min_km_per_day, driver_allowance_per_day_paise, is_active, sort_order",
    )
    .order("sort_order");
  const rates = (data ?? []) as unknown as RateRow[];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Vehicle rate card"
        back={{ href: "/admin/fleet", label: "Fleet" }}
        intro="Cab fares are calculated from these rates. Changes apply to new quotes immediately; existing bookings keep their agreed price. Enter amounts in rupees."
      />
      {error ? (
        <LoadError what="vehicle rates" />
      ) : rates.length === 0 ? (
        <EmptyState title="No vehicle classes">The vehicle_rates table has not been seeded yet.</EmptyState>
      ) : (
        rates.map((r) => {
          const id = (n: string) => `${r.vehicle_class}-${n}`;
          return (
            <Panel
              key={r.vehicle_class}
              id={`rate-${r.vehicle_class}`}
              title={r.label}
              description={
                <>
                  Class <code className="font-mono">{r.vehicle_class}</code> · {formatINR(r.base_fare_paise)} base +{" "}
                  {formatINR(r.per_km_paise)}/km
                </>
              }
              actions={r.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Hidden</Badge>}
            >
              <ActionForm action={updateVehicleRate} labels={LABELS}>
                <input type="hidden" name="vehicle_class" value={r.vehicle_class} />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Label" name={id("label")} required>
                    <Input name="label" id={id("label")} required maxLength={60} defaultValue={r.label} />
                  </Field>
                  <Field label="Example models" name={id("example_models")}>
                    <Input name="example_models" id={id("example_models")} maxLength={200} defaultValue={r.example_models} />
                  </Field>
                  <Field label="Seats" name={id("seats")} required>
                    <Input name="seats" id={id("seats")} type="number" min={1} max={60} required defaultValue={r.seats} />
                  </Field>
                  <Field label="Luggage bags" name={id("luggage_bags")} required>
                    <Input name="luggage_bags" id={id("luggage_bags")} type="number" min={0} max={60} required defaultValue={r.luggage_bags} />
                  </Field>
                  <Field label="Base fare (₹)" name={id("base_fare")} required>
                    <Input name="base_fare" id={id("base_fare")} inputMode="decimal" required defaultValue={rupees(r.base_fare_paise)} />
                  </Field>
                  <Field label="Per km (₹)" name={id("per_km")} required>
                    <Input name="per_km" id={id("per_km")} inputMode="decimal" required defaultValue={rupees(r.per_km_paise)} />
                  </Field>
                  <Field label="Minimum km per day" name={id("min_km_per_day")} required>
                    <Input name="min_km_per_day" id={id("min_km_per_day")} type="number" min={0} max={2000} required defaultValue={r.min_km_per_day} />
                  </Field>
                  <Field label="Driver allowance per day (₹)" name={id("driver_allowance_per_day")} required>
                    <Input
                      name="driver_allowance_per_day"
                      id={id("driver_allowance_per_day")}
                      inputMode="decimal"
                      required
                      defaultValue={rupees(r.driver_allowance_per_day_paise)}
                    />
                  </Field>
                  <Field label="Sort order" name={id("sort_order")} required>
                    <Input name="sort_order" id={id("sort_order")} type="number" required defaultValue={r.sort_order} />
                  </Field>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Checkbox
                      name="is_active"
                      id={id("is_active")}
                      defaultChecked={r.is_active}
                      label="Offered to customers (unticked classes are hidden from quotes and booking)"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <AdminSubmit>Save {r.label} rates</AdminSubmit>
                </div>
              </ActionForm>
            </Panel>
          );
        })
      )}
    </div>
  );
}
