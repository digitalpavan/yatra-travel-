import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/server/auth";
import { integrations } from "@/lib/server/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/dates";
import { VEHICLE_CLASS_LABELS, type VehicleClass } from "@/lib/types";
import { Alert, Badge, EmptyState, Field, Select, Textarea } from "@/components/ui";
import { AdminHeader, KeyValues, LoadError, Pagination, Panel, TableWrap, Td, Th, pageParam, sp } from "@/components/admin/AdminUI";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { TicketStatusBadge } from "@/components/admin/SupportBadges";
import { anonymiseCustomer, updateDataRequest, updateItineraryRequest } from "./actions";

export const metadata: Metadata = { title: "Support", robots: { index: false, follow: false } };

const PAGE_SIZE = 25;
const TICKET_FILTERS = {
  active: { label: "Open & in progress", statuses: ["open", "in_progress"] },
  open: { label: "Open", statuses: ["open"] },
  in_progress: { label: "In progress", statuses: ["in_progress"] },
  resolved: { label: "Resolved", statuses: ["resolved"] },
  closed: { label: "Closed", statuses: ["closed"] },
  all: { label: "All", statuses: null },
} as const;
type TicketFilter = keyof typeof TICKET_FILTERS;

const ITINERARY_STATUSES = ["new", "contacted", "quoted", "converted", "closed"] as const;
const DATA_REQUEST_LABELS: Record<string, string> = {
  access: "Access to data",
  correction: "Correction",
  deletion: "Deletion",
  withdraw_consent: "Withdraw consent",
};

interface TicketRow {
  id: string;
  reference: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  bookings: { reference: string } | null;
}

interface ItineraryRow {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string;
  travel_start: string;
  travel_end: string;
  passengers: number;
  pickup_city: string;
  places: string[];
  preferred_vehicle: VehicleClass | null;
  budget_note: string | null;
  details: string | null;
  status: string;
  staff_notes: string | null;
  created_at: string;
}

interface DataRequestRow {
  id: string;
  user_id: string | null;
  request_type: string;
  details: string | null;
  status: string;
  response_note: string | null;
  resolved_at: string | null;
  created_at: string;
  profiles: { email: string | null; full_name: string | null; anonymized_at: string | null } | null;
}

const label = (s: string) => s.replace(/_/g, " ");
const filterClass = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm font-medium ${active ? "border-forest-800 bg-forest-800 text-white" : "border-line text-forest-800 hover:bg-forest-50"}`;

/** Show a date-only column (YYYY-MM-DD) without timezone shifts. */
const ymd = (d: string) => formatDate(`${d}T12:00:00+05:30`);

export default async function SupportPage({ searchParams }: PageProps<"/admin/support">) {
  const viewer = await requirePermission("support.manage", "/admin/support");
  const params = await searchParams;
  const requested = sp(params.status) ?? "active";
  const filter: TicketFilter = requested in TICKET_FILTERS ? (requested as TicketFilter) : "active";
  const page = pageParam(params.page);
  const itineraryAll = sp(params.itinerary) === "all";
  const privacyAll = sp(params.privacy) === "all";

  const canReadItinerary = viewer.permissions.includes("bookings.read");
  const canEditItinerary = viewer.permissions.includes("bookings.manage");
  const canPrivacy = viewer.permissions.includes("settings.manage");

  const supabase = await createSupabaseServerClient();

  let ticketQuery = supabase
    .from("support_tickets")
    .select("id, reference, name, email, category, subject, status, created_at, updated_at, bookings(reference)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const statuses = TICKET_FILTERS[filter].statuses;
  if (statuses) ticketQuery = ticketQuery.in("status", statuses);

  const [tickets, itinerary, privacy] = await Promise.all([
    ticketQuery,
    canReadItinerary
      ? (() => {
          let q = supabase
            .from("itinerary_requests")
            .select(
              "id, reference, name, email, phone, travel_start, travel_end, passengers, pickup_city, places, preferred_vehicle, budget_note, details, status, staff_notes, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(50);
          if (!itineraryAll) q = q.in("status", ["new", "contacted", "quoted"]);
          return q;
        })()
      : null,
    canPrivacy
      ? (() => {
          let q = supabase
            .from("data_requests")
            .select(
              "id, user_id, request_type, details, status, response_note, resolved_at, created_at, profiles!data_requests_user_id_fkey(email, full_name, anonymized_at)",
            )
            .order("created_at", { ascending: true })
            .limit(50);
          if (!privacyAll) q = q.in("status", ["received", "in_progress"]);
          return q;
        })()
      : null,
  ]);

  const ticketRows = (tickets.data ?? []) as unknown as TicketRow[];
  const itineraryRows = (itinerary?.data ?? []) as unknown as ItineraryRow[];
  const privacyRows = (privacy?.data ?? []) as unknown as DataRequestRow[];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Support"
        back={{ href: "/admin", label: "Overview" }}
        intro="Customer tickets, custom itinerary requests and privacy (data protection) requests."
      />

      <Panel title="Tickets" id="tickets">
        <nav aria-label="Filter tickets by status" className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(TICKET_FILTERS) as TicketFilter[]).map((f) => (
            <Link
              key={f}
              href={f === "active" ? "/admin/support" : `/admin/support?status=${f}`}
              aria-current={f === filter ? "page" : undefined}
              className={filterClass(f === filter)}
            >
              {TICKET_FILTERS[f].label}
            </Link>
          ))}
        </nav>
        {tickets.error ? (
          <LoadError what="tickets" />
        ) : ticketRows.length === 0 ? (
          <EmptyState title="No tickets here">Nothing matches this filter.</EmptyState>
        ) : (
          <>
            <TableWrap label="Support tickets">
              <thead>
                <tr>
                  <Th>Ticket</Th>
                  <Th>Subject</Th>
                  <Th>Customer</Th>
                  <Th>Category</Th>
                  <Th>Booking</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                </tr>
              </thead>
              <tbody>
                {ticketRows.map((t) => (
                  <tr key={t.id}>
                    <Td className="whitespace-nowrap">
                      <Link className="font-medium text-forest-800 underline-offset-2 hover:underline" href={`/admin/support/${t.id}`}>
                        {t.reference}
                      </Link>
                    </Td>
                    <Td className="max-w-xs">
                      <Link className="hover:underline" href={`/admin/support/${t.id}`}>
                        {t.subject}
                      </Link>
                    </Td>
                    <Td>
                      <span className="block">{t.name}</span>
                      <span className="block text-xs break-all text-muted">{t.email}</span>
                    </Td>
                    <Td className="capitalize">{t.category}</Td>
                    <Td>
                      {t.bookings ? (
                        <Link className="text-forest-800 hover:underline" href={`/admin/bookings/${t.bookings.reference}`}>
                          {t.bookings.reference}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <TicketStatusBadge status={t.status} />
                    </Td>
                    <Td className="whitespace-nowrap">{formatDateTime(t.updated_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={tickets.count ?? null}
              basePath="/admin/support"
              params={{ status: filter === "active" ? undefined : filter }}
            />
          </>
        )}
      </Panel>

      {canReadItinerary && (
        <Panel
          id="itinerary"
          title="Custom itinerary requests"
          description={itineraryAll ? "All requests, newest first (50 most recent)." : "Requests still being worked on (new, contacted, quoted), newest first."}
          actions={
            <Link className="text-sm font-medium text-forest-800 hover:underline" href={itineraryAll ? "/admin/support#itinerary" : "/admin/support?itinerary=all#itinerary"}>
              {itineraryAll ? "Show active only" : "Show all"}
            </Link>
          }
        >
          {!canEditItinerary && <p className="mb-4 text-sm text-muted">You can view requests. Updating them requires booking management permission.</p>}
          {itinerary?.error ? (
            <LoadError what="itinerary requests" />
          ) : itineraryRows.length === 0 ? (
            <EmptyState title="No itinerary requests" />
          ) : (
            <ul className="space-y-4">
              {itineraryRows.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{r.reference}</span>
                    <Badge tone={r.status === "new" ? "gold" : r.status === "converted" ? "green" : r.status === "closed" ? "gray" : "blue"}>{r.status}</Badge>
                    <span className="text-xs text-muted">Received {formatDateTime(r.created_at)}</span>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <KeyValues
                      items={[
                        ["Name", r.name],
                        [
                          "Email",
                          <a key="e" className="break-all text-forest-800 hover:underline" href={`mailto:${r.email}`}>
                            {r.email}
                          </a>,
                        ],
                        [
                          "Phone",
                          <a key="p" className="text-forest-800 hover:underline" href={`tel:${r.phone}`}>
                            {r.phone}
                          </a>,
                        ],
                        ["Travel dates", `${ymd(r.travel_start)} – ${ymd(r.travel_end)}`],
                        ["Passengers", r.passengers],
                        ["Pickup city", r.pickup_city],
                        ["Places", r.places.length ? r.places.join(", ") : "—"],
                        ["Preferred vehicle", r.preferred_vehicle ? VEHICLE_CLASS_LABELS[r.preferred_vehicle] : "—"],
                        ["Budget", r.budget_note ?? "—"],
                        ["Details", r.details ? <span className="whitespace-pre-line">{r.details}</span> : "—"],
                      ]}
                    />
                    {canEditItinerary ? (
                      <ActionForm action={updateItineraryRequest} labels={{ status: "Status", staff_notes: "Staff notes" }}>
                        <input type="hidden" name="id" value={r.id} />
                        <div className="space-y-3">
                          <Field label="Status" name={`it-status-${r.id}`}>
                            <Select name="status" id={`it-status-${r.id}`} defaultValue={r.status}>
                              {ITINERARY_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </option>
                              ))}
                            </Select>
                          </Field>
                          <Field label="Staff notes (internal, up to 3000 characters)" name={`it-notes-${r.id}`}>
                            <Textarea name="staff_notes" id={`it-notes-${r.id}`} maxLength={3000} defaultValue={r.staff_notes ?? ""} />
                          </Field>
                          <AdminSubmit size="sm">Save</AdminSubmit>
                        </div>
                      </ActionForm>
                    ) : (
                      <KeyValues items={[["Staff notes", r.staff_notes ? <span className="whitespace-pre-line">{r.staff_notes}</span> : "—"]]} />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {canPrivacy && (
        <Panel
          id="privacy"
          title="Privacy requests"
          description={
            privacyAll
              ? "All data requests under the Digital Personal Data Protection Act, 2023 (oldest first, up to 50)."
              : "Open data requests under the Digital Personal Data Protection Act, 2023 — oldest first. Respond promptly."
          }
          actions={
            <Link className="text-sm font-medium text-forest-800 hover:underline" href={privacyAll ? "/admin/support#privacy" : "/admin/support?privacy=all#privacy"}>
              {privacyAll ? "Show open only" : "Show all"}
            </Link>
          }
        >
          {privacy?.error ? (
            <LoadError what="privacy requests" />
          ) : privacyRows.length === 0 ? (
            <EmptyState title="No privacy requests" />
          ) : (
            <ul className="space-y-4">
              {privacyRows.map((r) => (
                <DataRequestItem key={r.id} row={r} adminReady={integrations.supabaseAdmin()} />
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

function DataRequestItem({ row: r, adminReady }: { row: DataRequestRow; adminReady: boolean }) {
  const open = r.status === "received" || r.status === "in_progress";
  const canAnonymise = r.request_type === "deletion" && r.user_id && !r.profiles?.anonymized_at;
  return (
    <li className="rounded-xl border border-line p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-semibold">{DATA_REQUEST_LABELS[r.request_type] ?? r.request_type}</span>
        <Badge tone={r.status === "received" ? "gold" : r.status === "in_progress" ? "blue" : r.status === "completed" ? "green" : "gray"}>
          {label(r.status)}
        </Badge>
        <span className="text-xs text-muted">Received {formatDateTime(r.created_at)}</span>
      </div>
      <KeyValues
        items={[
          [
            "Customer",
            r.profiles?.anonymized_at ? (
              <span>Anonymised on {formatDateTime(r.profiles.anonymized_at)}</span>
            ) : r.profiles ? (
              <span className="break-all">
                {r.profiles.full_name ? `${r.profiles.full_name} · ` : ""}
                {r.profiles.email ?? "no email"}
              </span>
            ) : (
              "No linked account"
            ),
          ],
          ["Details", r.details ? <span className="whitespace-pre-line">{r.details}</span> : "—"],
          ["Response note", r.response_note ? <span className="whitespace-pre-line">{r.response_note}</span> : "—"],
          ["Resolved", r.resolved_at ? formatDateTime(r.resolved_at) : "—"],
        ]}
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ActionForm action={updateDataRequest} labels={{ response_note: "Response note", status: "Status" }}>
          <input type="hidden" name="id" value={r.id} />
          <div className="space-y-3">
            <Field label="Response note (required when rejecting)" name={`dr-note-${r.id}`}>
              <Textarea name="response_note" id={`dr-note-${r.id}`} maxLength={2000} defaultValue={r.response_note ?? ""} className="min-h-20" />
            </Field>
            <div className="flex flex-wrap gap-2">
              {r.status !== "in_progress" && open && (
                <AdminSubmit size="sm" variant="outline" name="status" value="in_progress">
                  Mark in progress
                </AdminSubmit>
              )}
              <AdminSubmit size="sm" name="status" value="completed">
                {open ? "Mark completed" : "Save as completed"}
              </AdminSubmit>
              <AdminSubmit size="sm" variant="danger" name="status" value="rejected">
                Reject
              </AdminSubmit>
            </div>
          </div>
        </ActionForm>

        {canAnonymise && (
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 text-sm">
            <p className="font-semibold text-red-900">Anonymise this customer</p>
            <p className="mt-1 text-charcoal">
              Replaces personal data (name, phone, email, notes) in the customer&apos;s profile, bookings, support tickets, reviews and itinerary
              requests. Booking, payment and refund records are retained, as required by Indian tax and accounting law. The login account itself is
              not deleted by this action. Customers with active bookings or pending refunds cannot be anonymised.
            </p>
            {adminReady ? (
              <ActionForm
                action={anonymiseCustomer}
                className="mt-3"
                confirm="Permanently anonymise this customer's personal data? This cannot be undone."
              >
                <input type="hidden" name="id" value={r.id} />
                <AdminSubmit size="sm" variant="danger" pendingLabel="Anonymising…">
                  Anonymise customer
                </AdminSubmit>
              </ActionForm>
            ) : (
              <div className="mt-3">
                <Alert tone="warning" title="Not available">
                  SUPABASE_SECRET_KEY is not configured on the server, so anonymisation cannot run.
                </Alert>
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
