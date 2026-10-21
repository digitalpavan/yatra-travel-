import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime, istDateTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { BOOKING_STATUS_LABELS, VEHICLE_CLASS_LABELS, type BookingStatus, type VehicleClass } from "@/lib/types";
import { Badge, ButtonLink, EmptyState, Field, Input, Select, StatusBadge, buttonClass } from "@/components/ui";
import { AdminHeader, LoadError, Pagination, Panel, TableWrap, Td, Th, pageParam, sp } from "@/components/admin/AdminUI";

export const metadata: Metadata = { title: "Bookings", robots: { index: false, follow: false } };

const PAGE_SIZE = 25;
const STATUSES = Object.keys(BOOKING_STATUS_LABELS) as BookingStatus[];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface BookingRow {
  id: string;
  reference: string;
  booking_type: "package" | "cab";
  trip_type: "one_way" | "round_trip" | "package";
  vehicle_class: VehicleClass;
  start_at: string;
  passengers: number;
  contact_name: string;
  contact_phone: string;
  status: BookingStatus;
  total_paise: number;
  amount_paid_paise: number;
  packages: { title: string } | null;
  cab_routes: { origin: string; destination: string } | null;
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await requirePermission("bookings.read", "/admin/bookings");
  const params = await searchParams;
  const status = STATUSES.find((s) => s === sp(params.status));
  const type = (["package", "cab"] as const).find((t) => t === sp(params.type));
  const from = sp(params.from);
  const to = sp(params.to);
  // Keep only characters that are safe inside a PostgREST or() filter.
  const q = sp(params.q, 60)?.replace(/[^A-Za-z0-9 +\-@.]/g, "").trim() || undefined;
  const page = pageParam(params.page);

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("bookings")
    .select(
      "id, reference, booking_type, trip_type, vehicle_class, start_at, passengers, contact_name, contact_phone, status, total_paise, amount_paid_paise, packages(title), cab_routes(origin, destination)",
      { count: "exact" },
    );
  if (status) query = query.eq("status", status);
  if (type) query = query.eq("booking_type", type);
  let dateError = false;
  try {
    if (from && DATE_RE.test(from)) query = query.gte("start_at", istDateTime(from).toISOString());
    if (to && DATE_RE.test(to)) query = query.lt("start_at", istDateTime(nextDay(to)).toISOString());
  } catch {
    dateError = true;
  }
  if (q) {
    const digits = q.replace(/\D/g, "");
    const ors = [`reference.ilike.%${q}%`, `contact_name.ilike.%${q}%`];
    if (digits.length >= 4) ors.push(`contact_phone.ilike.%${digits.slice(-10)}%`);
    query = query.or(ors.join(","));
  }
  const { data, error, count } = await query
    .order("start_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as BookingRow[];
  const filterParams = { status, type, from, to, q };
  const hasFilters = Object.values(filterParams).some(Boolean);

  return (
    <div className="space-y-6">
      <AdminHeader title="Bookings" intro="Search and manage customer bookings. Times are shown in IST." />

      <Panel>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end" role="search" aria-label="Filter bookings">
          <div className="lg:col-span-2">
            <Field label="Search" name="q" hint="Reference, name or phone">
              <Input name="q" defaultValue={q ?? ""} placeholder="YT261021-ABCDE, name or phone" />
            </Field>
          </div>
          <Field label="Status" name="status">
            <Select name="status" defaultValue={status ?? ""}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {BOOKING_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Type" name="type">
            <Select name="type" defaultValue={type ?? ""}>
              <option value="">All types</option>
              <option value="package">Package</option>
              <option value="cab">Cab</option>
            </Select>
          </Field>
          <Field label="Trip from" name="from">
            <Input type="date" name="from" defaultValue={from ?? ""} />
          </Field>
          <Field label="Trip to" name="to">
            <Input type="date" name="to" defaultValue={to ?? ""} />
          </Field>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
            <button type="submit" className={buttonClass("primary", "sm")}>
              Apply filters
            </button>
            {hasFilters && (
              <ButtonLink href="/admin/bookings" variant="ghost" size="sm">
                Clear
              </ButtonLink>
            )}
          </div>
        </form>
      </Panel>

      <Panel>
        {dateError && <p className="mb-3 text-sm text-red-700">One of the dates is invalid and was ignored.</p>}
        {error ? (
          <LoadError what="bookings" />
        ) : rows.length === 0 ? (
          <EmptyState title="No bookings found">{hasFilters ? "Try different filters." : "Bookings will appear here once customers book."}</EmptyState>
        ) : (
          <>
            <TableWrap label="Bookings">
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Trip</Th>
                  <Th>Pickup</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total / paid</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="hover:bg-ivory/60">
                    <Td>
                      <Link href={`/admin/bookings/${b.reference}`} className="font-mono font-semibold text-forest-800 underline-offset-2 hover:underline">
                        {b.reference}
                      </Link>
                    </Td>
                    <Td>
                      <Badge tone={b.booking_type === "package" ? "gold" : "blue"}>{b.booking_type === "package" ? "Package" : "Cab"}</Badge>
                      <p className="mt-1 max-w-56">
                        {b.packages?.title ?? (b.cab_routes ? `${b.cab_routes.origin} → ${b.cab_routes.destination}` : "—")}
                      </p>
                      <p className="text-xs text-muted">
                        {VEHICLE_CLASS_LABELS[b.vehicle_class]} · {b.passengers} pax
                        {b.trip_type === "round_trip" ? " · round trip" : ""}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap">{formatDateTime(b.start_at)}</Td>
                    <Td>
                      <p>{b.contact_name}</p>
                      <p className="text-xs text-muted">{b.contact_phone}</p>
                    </Td>
                    <Td>
                      <StatusBadge status={b.status} />
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      <p>{formatINR(b.total_paise)}</p>
                      <p className="text-xs text-muted">paid {formatINR(b.amount_paid_paise)}</p>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count} basePath="/admin/bookings" params={filterParams} />
          </>
        )}
      </Panel>
    </div>
  );
}
