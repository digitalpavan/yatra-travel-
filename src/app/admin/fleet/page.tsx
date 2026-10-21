import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, istDateString } from "@/lib/dates";
import { Alert, Badge, ButtonLink, EmptyState } from "@/components/ui";
import { AdminHeader, LoadError, Panel, TableWrap, Td, Th, sp } from "@/components/admin/AdminUI";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { createDriver, createVehicle, deleteDriver, deleteVehicle, updateDriver, updateVehicle } from "./actions";
import { DRIVER_LABELS, DriverFields, VEHICLE_LABELS, VehicleFields, type DriverRow, type VehicleRow } from "./_forms";

export const metadata: Metadata = { title: "Fleet", robots: { index: false, follow: false } };

type Expiry = "expired" | "soon" | "ok" | "missing";

const STATUS_TONE = { active: "green", maintenance: "gold", retired: "gray", inactive: "gray" } as const;

export default async function FleetPage({ searchParams }: PageProps<"/admin/fleet">) {
  await requirePermission("fleet.manage", "/admin/fleet");
  const created = sp((await searchParams).created);

  const now = new Date();
  const today = istDateString(now);
  const soonLimit = istDateString(new Date(now.getTime() + 30 * 86_400_000));
  const expiry = (d: string | null): Expiry => (!d ? "missing" : d < today ? "expired" : d <= soonLimit ? "soon" : "ok");

  const supabase = await createSupabaseServerClient();
  const [classesRes, vehiclesRes, driversRes] = await Promise.all([
    supabase.from("vehicle_rates").select("vehicle_class, label").order("sort_order"),
    supabase
      .from("vehicles")
      .select("id, registration_number, vehicle_class, model, seats, is_ac, status, permit_valid_until, insurance_valid_until, notes")
      .order("status")
      .order("registration_number"),
    supabase
      .from("drivers")
      .select("id, user_id, full_name, phone, license_number, license_valid_until, languages, status, profiles(email)")
      .order("status")
      .order("full_name"),
  ]);
  const classes = (classesRes.data ?? []) as { vehicle_class: string; label: string }[];
  const classLabel = new Map(classes.map((c) => [c.vehicle_class, c.label]));
  const vehicles = (vehiclesRes.data ?? []) as unknown as VehicleRow[];
  const drivers = (driversRes.data ?? []) as unknown as DriverRow[];

  // Document expiry warnings (retired vehicles / inactive drivers are ignored).
  const warnings: { key: string; who: string; doc: string; date: string; state: "expired" | "soon"; href: string }[] = [];
  for (const v of vehicles) {
    if (v.status === "retired") continue;
    for (const [doc, date] of [
      ["Permit", v.permit_valid_until],
      ["Insurance", v.insurance_valid_until],
    ] as const) {
      const s = expiry(date);
      if (date && (s === "expired" || s === "soon"))
        warnings.push({ key: `${v.id}-${doc}`, who: v.registration_number, doc, date, state: s, href: `#vehicle-${v.id}` });
    }
  }
  for (const d of drivers) {
    if (d.status !== "active") continue;
    const s = expiry(d.license_valid_until);
    if (d.license_valid_until && (s === "expired" || s === "soon"))
      warnings.push({ key: `${d.id}-lic`, who: d.full_name, doc: "Driving licence", date: d.license_valid_until, state: s, href: `#driver-${d.id}` });
  }
  warnings.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Fleet"
        back={{ href: "/admin", label: "Overview" }}
        intro="Vehicles, drivers and document validity. Retire vehicles or deactivate drivers instead of deleting them once they have trips."
        actions={
          <ButtonLink href="/admin/fleet/rates" variant="outline" size="sm">
            Vehicle rate card
          </ButtonLink>
        }
      />

      {created === "vehicle" && <Alert tone="success" title="Vehicle added." />}
      {created === "driver" && <Alert tone="success" title="Driver added." />}

      <Panel title="Document expiry" id="expiry" description="Permits, insurance and licences that have expired or expire within 30 days.">
        {vehiclesRes.error || driversRes.error ? (
          <LoadError what="fleet documents" />
        ) : warnings.length === 0 ? (
          <p className="text-sm text-muted">All recorded documents are valid for more than 30 days.</p>
        ) : (
          <ul className="divide-y divide-line/70 text-sm">
            {warnings.map((w) => (
              <li key={w.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <a href={w.href} className="font-medium text-forest-800 hover:underline">
                    {w.who}
                  </a>{" "}
                  — {w.doc}
                </span>
                <Badge tone={w.state === "expired" ? "red" : "gold"}>
                  {w.state === "expired" ? "Expired" : "Expires"} {formatDate(`${w.date}T00:00:00+05:30`)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Vehicles${vehiclesRes.error ? "" : ` (${vehicles.length})`}`} id="vehicles">
        {vehiclesRes.error || classesRes.error ? (
          <LoadError what="vehicles" />
        ) : (
          <div className="space-y-4">
            {vehicles.length === 0 ? (
              <EmptyState title="No vehicles yet">Add your first vehicle below.</EmptyState>
            ) : (
              <TableWrap label="Vehicles">
                <thead>
                  <tr>
                    <Th>Registration</Th>
                    <Th>Class / model</Th>
                    <Th>Seats</Th>
                    <Th>Status</Th>
                    <Th>Permit</Th>
                    <Th>Insurance</Th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr key={v.id}>
                      <Td className="font-mono font-medium whitespace-nowrap">
                        <a href={`#vehicle-${v.id}`} className="text-forest-800 hover:underline">
                          {v.registration_number}
                        </a>
                      </Td>
                      <Td>
                        {classLabel.get(v.vehicle_class) ?? v.vehicle_class}
                        <span className="block text-xs text-muted">
                          {v.model}
                          {v.is_ac ? " · AC" : " · Non-AC"}
                        </span>
                      </Td>
                      <Td>{v.seats}</Td>
                      <Td>
                        <Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge>
                      </Td>
                      <Td>
                        <DocDate date={v.permit_valid_until} state={expiry(v.permit_valid_until)} />
                      </Td>
                      <Td>
                        <DocDate date={v.insurance_valid_until} state={expiry(v.insurance_valid_until)} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}

            {vehicles.map((v) => (
              <details key={v.id} id={`vehicle-${v.id}`} className="rounded-xl border border-line bg-white p-4 target:border-forest-500">
                <summary className="cursor-pointer font-medium text-forest-900">
                  Edit {v.registration_number} <span className="font-normal text-muted">({v.model})</span>
                </summary>
                <div className="mt-4 space-y-4">
                  <ActionForm action={updateVehicle} labels={VEHICLE_LABELS}>
                    <input type="hidden" name="id" value={v.id} />
                    <VehicleFields prefix={`v-${v.id}`} classes={classes} vehicle={v} />
                    <div className="mt-4">
                      <AdminSubmit>Save vehicle</AdminSubmit>
                    </div>
                  </ActionForm>
                  <ActionForm action={deleteVehicle} confirm={`Delete vehicle ${v.registration_number}? This cannot be undone.`}>
                    <input type="hidden" name="id" value={v.id} />
                    <AdminSubmit variant="danger" size="sm" pendingLabel="Deleting…">
                      Delete vehicle
                    </AdminSubmit>
                  </ActionForm>
                </div>
              </details>
            ))}

            <details className="rounded-xl border border-dashed border-forest-300 bg-forest-50/40 p-4" open={vehicles.length === 0}>
              <summary className="cursor-pointer font-semibold text-forest-800">+ Add a vehicle</summary>
              <div className="mt-4">
                {classes.length === 0 ? (
                  <Alert tone="warning" title="No vehicle classes found">
                    The vehicle rate card is empty. Seed the vehicle_rates table before adding vehicles.
                  </Alert>
                ) : (
                  <ActionForm action={createVehicle} labels={VEHICLE_LABELS}>
                    <VehicleFields prefix="new-vehicle" classes={classes} />
                    <div className="mt-4">
                      <AdminSubmit>Add vehicle</AdminSubmit>
                    </div>
                  </ActionForm>
                )}
              </div>
            </details>
          </div>
        )}
      </Panel>

      <Panel title={`Drivers${driversRes.error ? "" : ` (${drivers.length})`}`} id="drivers">
        {driversRes.error ? (
          <LoadError what="drivers" />
        ) : (
          <div className="space-y-4">
            {drivers.length === 0 ? (
              <EmptyState title="No drivers yet">Add your first driver below.</EmptyState>
            ) : (
              <TableWrap label="Drivers">
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Phone</Th>
                    <Th>Licence</Th>
                    <Th>Languages</Th>
                    <Th>Status</Th>
                    <Th>Account</Th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.id}>
                      <Td className="font-medium">
                        <a href={`#driver-${d.id}`} className="text-forest-800 hover:underline">
                          {d.full_name}
                        </a>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <a href={`tel:${d.phone}`} className="hover:underline">
                          {d.phone}
                        </a>
                      </Td>
                      <Td>
                        <span className="font-mono text-xs">{d.license_number}</span>
                        <span className="block">
                          <DocDate date={d.license_valid_until} state={expiry(d.license_valid_until)} />
                        </span>
                      </Td>
                      <Td>{d.languages.join(", ") || "—"}</Td>
                      <Td>
                        <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge>
                      </Td>
                      <Td className="break-all">{d.user_id ? (d.profiles?.email ?? "Linked") : "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}

            {drivers.map((d) => (
              <details key={d.id} id={`driver-${d.id}`} className="rounded-xl border border-line bg-white p-4">
                <summary className="cursor-pointer font-medium text-forest-900">Edit {d.full_name}</summary>
                <div className="mt-4 space-y-4">
                  {d.user_id && !d.profiles?.email && (
                    <Alert tone="warning">
                      This driver is linked to an account whose email is not visible. Saving with the email field blank will unlink it.
                    </Alert>
                  )}
                  <ActionForm action={updateDriver} labels={DRIVER_LABELS}>
                    <input type="hidden" name="id" value={d.id} />
                    <DriverFields prefix={`d-${d.id}`} driver={d} />
                    <div className="mt-4">
                      <AdminSubmit>Save driver</AdminSubmit>
                    </div>
                  </ActionForm>
                  <ActionForm action={deleteDriver} confirm={`Delete driver ${d.full_name}? This cannot be undone.`}>
                    <input type="hidden" name="id" value={d.id} />
                    <AdminSubmit variant="danger" size="sm" pendingLabel="Deleting…">
                      Delete driver
                    </AdminSubmit>
                  </ActionForm>
                </div>
              </details>
            ))}

            <details className="rounded-xl border border-dashed border-forest-300 bg-forest-50/40 p-4" open={drivers.length === 0}>
              <summary className="cursor-pointer font-semibold text-forest-800">+ Add a driver</summary>
              <div className="mt-4">
                <ActionForm action={createDriver} labels={DRIVER_LABELS}>
                  <DriverFields prefix="new-driver" />
                  <div className="mt-4">
                    <AdminSubmit>Add driver</AdminSubmit>
                  </div>
                </ActionForm>
              </div>
            </details>
          </div>
        )}
      </Panel>

      <p className="text-sm text-muted">
        Fares per vehicle class are managed on the{" "}
        <Link href="/admin/fleet/rates" className="font-medium text-forest-800 hover:underline">
          vehicle rate card
        </Link>
        .
      </p>
    </div>
  );
}

function DocDate({ date, state }: { date: string | null; state: Expiry }) {
  if (!date) return <span className="text-muted">—</span>;
  const label = formatDate(`${date}T00:00:00+05:30`);
  if (state === "expired") return <Badge tone="red">Expired {label}</Badge>;
  if (state === "soon") return <Badge tone="gold">{label}</Badge>;
  return <span className="whitespace-nowrap">{label}</span>;
}
