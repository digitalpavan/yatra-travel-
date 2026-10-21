import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAnyStaff } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime, requestTime } from "@/lib/dates";
import { VEHICLE_CLASS_LABELS, type BookingStatus, type VehicleClass } from "@/lib/types";
import { Alert, Card, EmptyState, StatusBadge } from "@/components/ui";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { AdminHeader, LoadError, sp } from "@/components/admin/AdminUI";
import { updateTripStatusAction } from "../bookings/actions";

export const metadata: Metadata = { title: "Trips", robots: { index: false, follow: false } };

interface TripRow {
  id: string;
  reference: string;
  status: BookingStatus;
  start_at: string;
  end_at: string;
  vehicle_class: VehicleClass;
  pickup_location: string;
  drop_location: string | null;
  passengers: number;
  luggage_bags: number;
  special_requests: string | null;
  contact_name: string;
  contact_phone: string;
  packages: { title: string } | null;
  cab_routes: { origin: string; destination: string } | null;
  vehicle_assignments: {
    is_active: boolean;
    vehicles: { registration_number: string; model: string } | null;
    drivers: { full_name: string; phone: string } | null;
  }[];
}

const COLUMNS =
  "id, reference, status, start_at, end_at, vehicle_class, pickup_location, drop_location, passengers, luggage_bags, special_requests, contact_name, contact_phone, packages(title), cab_routes(origin, destination), vehicle_assignments(is_active, vehicles(registration_number, model), drivers(full_name, phone))";

function TripCard({ trip, canAct, staffView }: { trip: TripRow; canAct: boolean; staffView: boolean }) {
  const assignment = trip.vehicle_assignments.find((a) => a.is_active);
  const title = trip.packages?.title ?? (trip.cab_routes ? `${trip.cab_routes.origin} → ${trip.cab_routes.destination}` : "Trip");
  return (
    <Card className="p-4 sm:p-5">
      <article aria-labelledby={`trip-${trip.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 id={`trip-${trip.id}`} className="text-lg font-semibold">
              {title}
            </h2>
            <p className="text-sm text-muted">
              {staffView ? (
                <Link href={`/admin/bookings/${trip.reference}`} className="font-mono underline-offset-2 hover:underline">
                  {trip.reference}
                </Link>
              ) : (
                <span className="font-mono">{trip.reference}</span>
              )}{" "}
              · {VEHICLE_CLASS_LABELS[trip.vehicle_class]}
            </p>
          </div>
          <StatusBadge status={trip.status} />
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Pickup time</dt>
            <dd className="font-semibold text-forest-900">{formatDateTime(trip.start_at)}</dd>
          </div>
          <div>
            <dt className="text-muted">Ends</dt>
            <dd>{formatDateTime(trip.end_at)}</dd>
          </div>
          <div>
            <dt className="text-muted">Pickup location</dt>
            <dd className="font-medium">{trip.pickup_location}</dd>
          </div>
          <div>
            <dt className="text-muted">Drop location</dt>
            <dd>{trip.drop_location ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Customer</dt>
            <dd>
              {trip.contact_name} ·{" "}
              <a href={`tel:${trip.contact_phone}`} className="font-medium text-forest-800 underline">
                {trip.contact_phone}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Passengers</dt>
            <dd>
              {trip.passengers} · {trip.luggage_bags} bags
            </dd>
          </div>
          {assignment && (
            <div>
              <dt className="text-muted">Vehicle / driver</dt>
              <dd>
                {assignment.vehicles ? `${assignment.vehicles.registration_number} (${assignment.vehicles.model})` : "Assigned vehicle"}
                {assignment.drivers ? ` · ${assignment.drivers.full_name}` : ""}
              </dd>
            </div>
          )}
          {trip.special_requests && (
            <div className="sm:col-span-2">
              <dt className="text-muted">Special requests</dt>
              <dd>{trip.special_requests}</dd>
            </div>
          )}
        </dl>
        {canAct && (trip.status === "assigned" || trip.status === "in_progress") && (
          <ActionForm
            action={updateTripStatusAction}
            confirm={trip.status === "assigned" ? `Start trip ${trip.reference}?` : `Complete trip ${trip.reference}?`}
            className="mt-4"
          >
            <input type="hidden" name="booking_id" value={trip.id} />
            <input type="hidden" name="status" value={trip.status === "assigned" ? "in_progress" : "completed"} />
            <AdminSubmit variant={trip.status === "assigned" ? "gold" : "primary"} size="lg" pendingLabel="Updating…" className="w-full sm:w-auto">
              {trip.status === "assigned" ? "Start trip" : "Complete trip"}
            </AdminSubmit>
          </ActionForm>
        )}
      </article>
    </Card>
  );
}

export default async function TripsPage({ searchParams }: PageProps<"/admin/trips">) {
  const viewer = await requireAnyStaff("/admin/trips");
  const isDriver = viewer.permissions.includes("trips.own");
  const staffView = viewer.permissions.includes("bookings.read");
  if (!isDriver && !staffView) redirect("/admin?denied=1");
  const denied = sp((await searchParams).denied) === "1";
  const canAct = isDriver || viewer.permissions.includes("bookings.manage");

  // RLS: drivers only receive bookings they are actively assigned to; staff see all.
  const supabase = await createSupabaseServerClient();
  const since = new Date(requestTime() - 24 * 3_600_000).toISOString();
  const [activeRes, doneRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(COLUMNS)
      .in("status", ["assigned", "in_progress"])
      .gte("end_at", since)
      .order("start_at", { ascending: true })
      .limit(100),
    isDriver
      ? supabase.from("bookings").select(COLUMNS).eq("status", "completed").order("start_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const active = (activeRes.data ?? []) as unknown as TripRow[];
  const done = (doneRes.data ?? []) as unknown as TripRow[];

  return (
    <div className="space-y-6">
      <AdminHeader
        title={isDriver ? "My trips" : "Assigned trips"}
        intro={isDriver ? "Your upcoming and ongoing trips. Tap Start when you pick up the customer and Complete at drop-off." : "All upcoming and ongoing trips with a vehicle assigned."}
      />
      {denied && (
        <Alert tone="warning" title="Access denied">
          That page is not available for your role.
        </Alert>
      )}
      {activeRes.error ? (
        <LoadError what="trips" />
      ) : active.length === 0 ? (
        <EmptyState title="No upcoming trips">{isDriver ? "New assignments will appear here." : "Assign vehicles from a booking's page."}</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {active.map((t) => (
            <TripCard key={t.id} trip={t} canAct={canAct} staffView={staffView} />
          ))}
        </div>
      )}
      {isDriver && done.length > 0 && (
        <section aria-labelledby="done-title" className="space-y-3">
          <h2 id="done-title" className="text-lg font-semibold">
            Recently completed
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {done.map((t) => (
              <TripCard key={t.id} trip={t} canAct={false} staffView={staffView} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
