import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { integrations } from "@/lib/server/env";
import { getSiteSettings } from "@/lib/data/catalog";
import { computeRefund } from "@/lib/cancellation";
import { formatDateTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { BOOKING_STATUS_LABELS, VEHICLE_CLASS_LABELS, type BookingStatus, type VehicleClass } from "@/lib/types";
import { Alert, Badge, EmptyState, Field, Input, Select, StatusBadge, Textarea } from "@/components/ui";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { AdminHeader, KeyValues, LoadError, Panel, TableWrap, Td, Th } from "@/components/admin/AdminUI";
import { assignVehicleAction, cancelBookingAction, updateBookingDetailsAction, updateTripStatusAction } from "../actions";

export const metadata: Metadata = { title: "Booking", robots: { index: false, follow: false } };

const REFERENCE_RE = /^YT[0-9]{6}-[A-Z2-9]{5}$/;

interface Booking {
  id: string;
  reference: string;
  customer_id: string | null;
  booking_type: "package" | "cab";
  trip_type: "one_way" | "round_trip" | "package";
  vehicle_class: VehicleClass;
  pickup_location: string;
  drop_location: string | null;
  start_at: string;
  end_at: string;
  trip_days: number;
  passengers: number;
  luggage_bags: number;
  special_requests: string | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  status: BookingStatus;
  price_breakdown: { lines?: { label: string; amount_paise: number }[]; applied_rules?: string[]; coupon?: { code: string; applied: boolean } | null; tax_label?: string; tax_included?: boolean } | null;
  subtotal_paise: number;
  adjustment_paise: number;
  discount_paise: number;
  tax_paise: number;
  total_paise: number;
  amount_paid_paise: number;
  amount_refunded_paise: number;
  payment_due_by: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  packages: { title: string; slug: string } | null;
  cab_routes: { origin: string; destination: string; distance_km: number } | null;
}

interface Payment {
  id: string;
  provider_order_id: string;
  provider_payment_id: string | null;
  amount_paise: number;
  status: string;
  method: string | null;
  failure_reason: string | null;
  captured_at: string | null;
  created_at: string;
}

interface Refund {
  id: string;
  amount_paise: number;
  reason: string;
  status: string;
  failure_reason: string | null;
  processed_at: string | null;
  created_at: string;
}

interface BookingEvent {
  id: number;
  status: BookingStatus | null;
  note: string;
  visible_to_customer: boolean;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

interface Assignment {
  id: string;
  created_at: string;
  released_at: string | null;
  vehicles: { registration_number: string; model: string; seats: number; vehicle_class: VehicleClass } | null;
  drivers: { full_name: string; phone: string } | null;
}

interface VehicleOption {
  id: string;
  registration_number: string;
  model: string;
  seats: number;
  vehicle_class: VehicleClass;
}

interface DriverOption {
  id: string;
  full_name: string;
  phone: string;
}

const REFUND_TONE: Record<string, "gold" | "green" | "gray" | "red" | "blue"> = {
  requested: "gold",
  approved: "gold",
  processing: "blue",
  processed: "green",
  failed: "red",
  rejected: "gray",
};

export default async function BookingDetailPage({ params }: PageProps<"/admin/bookings/[reference]">) {
  const { reference: raw } = await params;
  const reference = decodeURIComponent(raw).toUpperCase();
  const viewer = await requirePermission("bookings.read", `/admin/bookings/${encodeURIComponent(reference)}`);
  if (!REFERENCE_RE.test(reference)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("*, packages(title, slug), cab_routes(origin, destination, distance_km)")
    .eq("reference", reference)
    .maybeSingle();
  if (error) {
    return (
      <div className="space-y-6">
        <AdminHeader title={reference} back={{ href: "/admin/bookings", label: "Bookings" }} />
        <LoadError what="this booking" />
      </div>
    );
  }
  if (!data) notFound();
  const booking = data as unknown as Booking;
  const canManage = viewer.permissions.includes("bookings.manage");
  const canSeePayments = viewer.permissions.includes("payments.read") || viewer.permissions.includes("refunds.manage");

  const [paymentsRes, refundsRes, eventsRes, assignmentRes] = await Promise.all([
    supabase
      .from("payments")
      .select("id, provider_order_id, provider_payment_id, amount_paise, status, method, failure_reason, captured_at, created_at")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("refunds")
      .select("id, amount_paise, reason, status, failure_reason, processed_at, created_at")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("booking_events")
      .select("id, status, note, visible_to_customer, created_at, profiles(full_name, email)")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("vehicle_assignments")
      .select("id, created_at, released_at, vehicles(registration_number, model, seats, vehicle_class), drivers(full_name, phone)")
      .eq("booking_id", booking.id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  const payments = (paymentsRes.data ?? []) as Payment[];
  const refunds = (refundsRes.data ?? []) as Refund[];
  const events = (eventsRes.data ?? []) as unknown as BookingEvent[];
  const assignment = assignmentRes.data as unknown as Assignment | null;

  const canAssign = canManage && (booking.status === "confirmed" || booking.status === "assigned");
  const canCancel = canManage && ["pending", "confirmed", "assigned"].includes(booking.status);

  let vehicles: VehicleOption[] = [];
  let drivers: DriverOption[] = [];
  let optionsError = false;
  if (canAssign) {
    const [v, d] = await Promise.all([
      supabase
        .from("vehicles")
        .select("id, registration_number, model, seats, vehicle_class")
        .eq("status", "active")
        .gte("seats", booking.passengers)
        .order("vehicle_class")
        .order("registration_number"),
      supabase.from("drivers").select("id, full_name, phone").eq("status", "active").order("full_name"),
    ]);
    optionsError = Boolean(v.error || d.error);
    // Booked class first.
    vehicles = ((v.data ?? []) as VehicleOption[]).sort(
      (a, b) => Number(b.vehicle_class === booking.vehicle_class) - Number(a.vehicle_class === booking.vehicle_class),
    );
    drivers = (d.data ?? []) as DriverOption[];
  }

  // Default staff refund = the customer-facing policy amount (editable).
  const remaining = Math.max(0, booking.amount_paid_paise - booking.amount_refunded_paise);
  let defaultRefund = 0;
  let policyNote = "";
  if (canCancel && booking.amount_paid_paise > 0) {
    const settings = await getSiteSettings();
    const decision = computeRefund({
      policy: settings.cancellation_policy,
      status: booking.status,
      startAt: new Date(booking.start_at),
      now: new Date(),
      amountPaidPaise: booking.amount_paid_paise,
      amountRefundedPaise: booking.amount_refunded_paise,
    });
    defaultRefund = decision.refundable_paise;
    policyNote = decision.can_cancel
      ? `Policy: ${(decision.refund_bps / 100).toFixed(0)}% refund at ${Math.floor(decision.hours_before)} hours before pickup = ${formatINR(decision.refundable_paise)}.`
      : `Policy: ${decision.reason ?? "not eligible for a refund"} Default refund is ₹0.`;
  }

  const trip =
    booking.packages?.title ??
    (booking.cab_routes ? `${booking.cab_routes.origin} → ${booking.cab_routes.destination} (${booking.cab_routes.distance_km} km)` : "—");
  const lines = booking.price_breakdown?.lines ?? [];

  return (
    <div className="space-y-6">
      <AdminHeader
        title={booking.reference}
        back={{ href: "/admin/bookings", label: "Bookings" }}
        intro={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={booking.status} />
            <span>Created {formatDateTime(booking.created_at)}</span>
          </span>
        }
      />

      {booking.status === "pending" && booking.payment_due_by && (
        <Alert tone="warning">Awaiting payment until {formatDateTime(booking.payment_due_by)}. Unpaid bookings expire automatically.</Alert>
      )}
      {booking.cancel_reason && (
        <Alert tone="info" title="Cancellation">
          {booking.cancel_reason}
          {booking.cancelled_at ? ` — ${formatDateTime(booking.cancelled_at)}` : ""}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Trip">
          <KeyValues
            items={[
              ["Type", booking.booking_type === "package" ? "Package" : booking.trip_type === "round_trip" ? "Cab · round trip" : "Cab · one way"],
              ["Trip", booking.packages ? <Link className="underline" href={`/packages/${booking.packages.slug}`}>{trip}</Link> : trip],
              ["Pickup", formatDateTime(booking.start_at)],
              ["Ends", formatDateTime(booking.end_at)],
              ["Days", booking.trip_days],
              ["Vehicle class", VEHICLE_CLASS_LABELS[booking.vehicle_class]],
              ["Passengers", `${booking.passengers} · ${booking.luggage_bags} bags`],
              ["Pickup location", booking.pickup_location],
              ["Drop location", booking.drop_location ?? "—"],
              ["Special requests", booking.special_requests ?? "—"],
            ]}
          />
        </Panel>
        <Panel title="Customer">
          <KeyValues
            items={[
              ["Name", booking.contact_name],
              ["Phone", <a key="p" className="underline" href={`tel:${booking.contact_phone}`}>{booking.contact_phone}</a>],
              ["Email", <a key="e" className="underline break-all" href={`mailto:${booking.contact_email}`}>{booking.contact_email}</a>],
              ["Account", booking.customer_id ? "Registered customer" : "No linked account"],
            ]}
          />
        </Panel>
      </div>

      <Panel title="Price">
        <TableWrap>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <Td>{l.label}</Td>
                <Td className="text-right whitespace-nowrap">{formatINR(l.amount_paise)}</Td>
              </tr>
            ))}
            <tr>
              <Td className="font-medium">Subtotal</Td>
              <Td className="text-right">{formatINR(booking.subtotal_paise)}</Td>
            </tr>
            {booking.adjustment_paise !== 0 && (
              <tr>
                <Td>
                  Seasonal adjustment
                  {booking.price_breakdown?.applied_rules?.length ? ` (${booking.price_breakdown.applied_rules.join(", ")})` : ""}
                </Td>
                <Td className="text-right">{booking.adjustment_paise < 0 ? "−" : ""}{formatINR(Math.abs(booking.adjustment_paise))}</Td>
              </tr>
            )}
            {booking.discount_paise > 0 && (
              <tr>
                <Td>Discount{booking.price_breakdown?.coupon?.code ? ` (${booking.price_breakdown.coupon.code})` : ""}</Td>
                <Td className="text-right">−{formatINR(booking.discount_paise)}</Td>
              </tr>
            )}
            {booking.tax_paise > 0 && (
              <tr>
                <Td>
                  {booking.price_breakdown?.tax_label ?? "Tax"}
                  {booking.price_breakdown?.tax_included ? " (included)" : ""}
                </Td>
                <Td className="text-right">{formatINR(booking.tax_paise)}</Td>
              </tr>
            )}
            <tr>
              <Td className="font-semibold">Total</Td>
              <Td className="text-right font-semibold">{formatINR(booking.total_paise)}</Td>
            </tr>
            <tr>
              <Td>Paid</Td>
              <Td className="text-right">{formatINR(booking.amount_paid_paise)}</Td>
            </tr>
            <tr>
              <Td>Refunded</Td>
              <Td className="text-right">{formatINR(booking.amount_refunded_paise)}</Td>
            </tr>
          </tbody>
        </TableWrap>
      </Panel>

      <Panel title="Vehicle & driver" id="assignment">
        {assignment ? (
          <KeyValues
            items={[
              ["Vehicle", assignment.vehicles ? `${assignment.vehicles.registration_number} · ${assignment.vehicles.model} (${assignment.vehicles.seats} seats)` : "—"],
              ["Driver", assignment.drivers ? `${assignment.drivers.full_name} · ${assignment.drivers.phone}` : "—"],
              ["Assigned", formatDateTime(assignment.created_at)],
              ...(assignment.released_at ? ([["Released", formatDateTime(assignment.released_at)]] as [string, string][]) : []),
            ]}
          />
        ) : (
          <p className="text-sm text-muted">No vehicle assigned yet.</p>
        )}

        {canAssign && (
          <div className="mt-5 border-t border-line pt-5">
            <h3 className="mb-3 text-base font-semibold">{assignment ? "Reassign" : "Assign"} vehicle and driver</h3>
            {optionsError ? (
              <LoadError what="vehicles and drivers" />
            ) : vehicles.length === 0 || drivers.length === 0 ? (
              <Alert tone="warning">
                {vehicles.length === 0 ? `No active vehicle has ${booking.passengers}+ seats. ` : ""}
                {drivers.length === 0 ? "No active drivers. " : ""}
                Update the fleet first.
              </Alert>
            ) : (
              <ActionForm action={assignVehicleAction} className="grid gap-4 sm:grid-cols-2" labels={{ vehicle_id: "Vehicle", driver_id: "Driver" }}>
                <input type="hidden" name="booking_id" value={booking.id} />
                <Field label="Vehicle" name="vehicle_id" required hint={`Active vehicles with at least ${booking.passengers} seats; booked class listed first.`}>
                  <Select name="vehicle_id" required defaultValue="">
                    <option value="" disabled>
                      Choose a vehicle
                    </option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registration_number} · {v.model} · {VEHICLE_CLASS_LABELS[v.vehicle_class]} · {v.seats} seats
                        {v.vehicle_class === booking.vehicle_class ? " (booked class)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Driver" name="driver_id" required>
                  <Select name="driver_id" required defaultValue="">
                    <option value="" disabled>
                      Choose a driver
                    </option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.full_name} · {d.phone}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <AdminSubmit pendingLabel="Assigning…">{assignment ? "Reassign" : "Assign"}</AdminSubmit>
                  <p className="mt-2 text-xs text-muted">Overlapping allocations are rejected automatically. The customer is emailed on assignment.</p>
                </div>
              </ActionForm>
            )}
          </div>
        )}

        {canManage && (booking.status === "assigned" || booking.status === "in_progress") && (
          <div className="mt-5 border-t border-line pt-5">
            <ActionForm
              action={updateTripStatusAction}
              confirm={booking.status === "assigned" ? "Mark this trip as started?" : "Mark this trip as completed?"}
              className="flex flex-wrap items-center gap-3"
            >
              <input type="hidden" name="booking_id" value={booking.id} />
              <input type="hidden" name="status" value={booking.status === "assigned" ? "in_progress" : "completed"} />
              <AdminSubmit variant="gold" pendingLabel="Updating…">
                {booking.status === "assigned" ? "Mark in progress" : "Mark completed"}
              </AdminSubmit>
            </ActionForm>
          </div>
        )}
      </Panel>

      {canManage && !["completed", "cancelled", "refunded"].includes(booking.status) && (
        <Panel title="Edit trip details" description="Only pickup, drop and special requests can be edited here. Dates and prices cannot be changed.">
          <ActionForm action={updateBookingDetailsAction} className="grid gap-4 sm:grid-cols-2" labels={{ pickup_location: "Pickup location", drop_location: "Drop location", special_requests: "Special requests" }}>
            <input type="hidden" name="booking_id" value={booking.id} />
            <Field label="Pickup location" name="pickup_location" required>
              <Input name="pickup_location" defaultValue={booking.pickup_location} required minLength={3} maxLength={200} />
            </Field>
            <Field label="Drop location" name="drop_location">
              <Input name="drop_location" defaultValue={booking.drop_location ?? ""} maxLength={200} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Special requests" name="special_requests">
                <Textarea name="special_requests" defaultValue={booking.special_requests ?? ""} maxLength={1000} />
              </Field>
            </div>
            <div>
              <AdminSubmit>Save details</AdminSubmit>
            </div>
          </ActionForm>
        </Panel>
      )}

      {canSeePayments && (
        <Panel title="Payments">
          {paymentsRes.error ? (
            <LoadError what="payments" />
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted">No payment attempts.</p>
          ) : (
            <TableWrap label="Payments">
              <thead>
                <tr>
                  <Th>Created</Th>
                  <Th>Order / payment</Th>
                  <Th>Status</Th>
                  <Th>Method</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(p.created_at)}</Td>
                    <Td className="font-mono text-xs break-all">
                      {p.provider_order_id}
                      {p.provider_payment_id && <span className="block">{p.provider_payment_id}</span>}
                    </Td>
                    <Td>
                      <Badge tone={p.status === "captured" ? "green" : p.status === "failed" ? "red" : "gray"}>{p.status.replace(/_/g, " ")}</Badge>
                      {p.failure_reason && <p className="mt-1 text-xs text-red-800">{p.failure_reason}</p>}
                      {p.captured_at && <p className="mt-1 text-xs text-muted">Captured {formatDateTime(p.captured_at)}</p>}
                    </Td>
                    <Td>{p.method ?? "—"}</Td>
                    <Td className="text-right">{formatINR(p.amount_paise)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>
      )}

      {canSeePayments && (
        <Panel
          title="Refunds"
          actions={
            refunds.some((r) => ["requested", "approved", "failed"].includes(r.status)) ? (
              <Link href="/admin/payments#refunds" className="text-sm font-medium text-forest-800 underline">
                Process in refunds queue
              </Link>
            ) : undefined
          }
        >
          {refundsRes.error ? (
            <LoadError what="refunds" />
          ) : refunds.length === 0 ? (
            <p className="text-sm text-muted">No refunds.</p>
          ) : (
            <ul className="space-y-3">
              {refunds.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{formatINR(r.amount_paise)}</span>
                    <Badge tone={REFUND_TONE[r.status] ?? "gray"}>{r.status}</Badge>
                  </div>
                  <p className="mt-1">{r.reason}</p>
                  {r.failure_reason && <p className="mt-1 text-red-800">{r.failure_reason}</p>}
                  <p className="mt-1 text-xs text-muted">
                    Requested {formatDateTime(r.created_at)}
                    {r.processed_at ? ` · processed ${formatDateTime(r.processed_at)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {canCancel && (
        <Panel title="Cancel booking" description="Cancels the booking, releases any vehicle allocation and queues a refund (processed separately under Payments & refunds).">
          {!integrations.supabaseAdmin() ? (
            <Alert tone="warning">Cancellation is unavailable: the server&apos;s Supabase service key is not configured.</Alert>
          ) : (
            <ActionForm
              action={cancelBookingAction}
              confirm={`Cancel booking ${booking.reference}? This cannot be undone.`}
              className="grid gap-4 sm:grid-cols-2"
              labels={{ reason: "Reason", refund: "Refund amount" }}
            >
              <input type="hidden" name="booking_id" value={booking.id} />
              <div className="sm:col-span-2">
                <Field label="Reason (shown in the booking history)" name="reason" required>
                  <Textarea name="reason" required minLength={3} maxLength={500} className="min-h-20" />
                </Field>
              </div>
              {booking.amount_paid_paise > 0 ? (
                <Field
                  label="Refund amount (₹)"
                  name="refund"
                  required
                  hint={`${policyNote} Maximum ${formatINR(remaining)}.`}
                >
                  <Input
                    name="refund"
                    inputMode="decimal"
                    required
                    defaultValue={(defaultRefund / 100).toString()}
                    hint={`${policyNote} Maximum ${formatINR(remaining)}.`}
                  />
                </Field>
              ) : (
                <p className="self-end text-sm text-muted">Nothing has been paid, so no refund is needed.</p>
              )}
              <div className="sm:col-span-2">
                <AdminSubmit variant="danger" pendingLabel="Cancelling…">
                  Cancel booking
                </AdminSubmit>
              </div>
            </ActionForm>
          )}
        </Panel>
      )}

      <Panel title="History">
        {eventsRes.error ? (
          <LoadError what="booking history" />
        ) : events.length === 0 ? (
          <EmptyState title="No events recorded" />
        ) : (
          <ol className="relative space-y-4 border-l-2 border-gold-200 pl-5">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute top-1.5 -left-[27px] h-3 w-3 rounded-full border-2 border-white bg-gold-400" aria-hidden />
                <p className="text-sm font-medium text-forest-900">
                  {e.note}
                  {e.status && <span className="ml-2 text-xs font-normal text-muted">→ {BOOKING_STATUS_LABELS[e.status]}</span>}
                </p>
                <p className="text-xs text-muted">
                  {formatDateTime(e.created_at)}
                  {e.profiles ? ` · ${e.profiles.full_name ?? e.profiles.email ?? "user"}` : ""}
                  {!e.visible_to_customer ? " · internal" : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
