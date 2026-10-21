import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAnyStaff } from "@/lib/server/auth";
import { integrations } from "@/lib/server/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { Alert, Badge, Button, EmptyState, Field, Textarea } from "@/components/ui";
import { AdminHeader, LoadError, Pagination, Panel, TableWrap, Td, Th, pageParam, sp } from "@/components/admin/AdminUI";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { declineRefund, processRefund } from "./actions";

export const metadata: Metadata = { title: "Payments & refunds", robots: { index: false, follow: false } };

const PAGE_SIZE = 25;
const PAYMENT_STATUSES = ["created", "authorized", "captured", "failed", "refunded", "partially_refunded"] as const;
const OPEN_REFUND_STATUSES = ["requested", "approved", "failed", "processing"] as const;
const ACTIONABLE_REFUND = ["requested", "approved", "failed"];

type Tone = "gold" | "green" | "gray" | "red" | "blue";
const PAYMENT_TONES: Record<string, Tone> = {
  created: "gray",
  authorized: "blue",
  captured: "green",
  failed: "red",
  refunded: "gray",
  partially_refunded: "gold",
};
const REFUND_TONES: Record<string, Tone> = {
  requested: "gold",
  approved: "blue",
  processing: "blue",
  processed: "green",
  failed: "red",
  rejected: "gray",
};

interface PaymentRow {
  id: string;
  provider_order_id: string;
  provider_payment_id: string | null;
  amount_paise: number;
  status: string;
  method: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  captured_at: string | null;
  created_at: string;
  bookings: { reference: string } | null;
}

interface RefundRow {
  id: string;
  amount_paise: number;
  reason: string;
  status: string;
  provider_refund_id: string | null;
  failure_reason: string | null;
  processed_at: string | null;
  created_at: string;
  bookings: { reference: string } | null;
}

interface WebhookRow {
  id: number;
  event_type: string;
  event_id: string;
  received_at: string;
  processed_at: string | null;
  processing_error: string | null;
  payload: unknown;
}

const label = (s: string) => s.replace(/_/g, " ");

function BookingLink({ booking }: { booking: { reference: string } | null }) {
  if (!booking) return <span className="text-muted">—</span>;
  return (
    <Link className="font-medium text-forest-800 underline-offset-2 hover:underline" href={`/admin/bookings/${booking.reference}`}>
      {booking.reference}
    </Link>
  );
}

function truncatedJson(value: unknown, max = 4000): string {
  const s = JSON.stringify(value, null, 2) ?? "";
  return s.length > max ? `${s.slice(0, max)}\n… (truncated)` : s;
}

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const viewer = await requireAnyStaff("/admin/payments");
  const canRead = viewer.permissions.includes("payments.read");
  const canRefund = viewer.permissions.includes("refunds.manage");
  if (!canRead && !canRefund) redirect("/admin?denied=1");

  const params = await searchParams;
  const requested = sp(params.status);
  const status = (PAYMENT_STATUSES as readonly string[]).includes(requested ?? "") ? requested : undefined;
  const page = pageParam(params.page);

  const supabase = await createSupabaseServerClient();
  const razorpayReady = integrations.razorpay();
  const adminReady = integrations.supabaseAdmin();

  const refundCols = "id, amount_paise, reason, status, provider_refund_id, failure_reason, processed_at, created_at, bookings(reference)";
  const [openRefunds, closedRefunds, payments, webhooks] = await Promise.all([
    supabase.from("refunds").select(refundCols).in("status", OPEN_REFUND_STATUSES).order("created_at", { ascending: true }).limit(100),
    supabase.from("refunds").select(refundCols).in("status", ["processed", "rejected"]).order("updated_at", { ascending: false }).limit(20),
    canRead
      ? (() => {
          let q = supabase
            .from("payments")
            .select(
              "id, provider_order_id, provider_payment_id, amount_paise, status, method, failure_code, failure_reason, captured_at, created_at, bookings(reference)",
              { count: "exact" },
            )
            .order("created_at", { ascending: false })
            .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
          if (status) q = q.eq("status", status);
          return q;
        })()
      : null,
    canRead
      ? supabase
          .from("payment_webhook_events")
          .select("id, event_type, event_id, received_at, processed_at, processing_error, payload")
          .not("processing_error", "is", null)
          .order("received_at", { ascending: false })
          .limit(50)
      : null,
  ]);

  const refundsError = openRefunds.error || closedRefunds.error;
  const openRows = (openRefunds.data ?? []) as unknown as RefundRow[];
  const closedRows = (closedRefunds.data ?? []) as unknown as RefundRow[];
  const refundRows = [...openRows, ...closedRows];
  const paymentRows = (payments?.data ?? []) as unknown as PaymentRow[];
  const webhookRows = (webhooks?.data ?? []) as unknown as WebhookRow[];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Payments & refunds"
        back={{ href: "/admin", label: "Overview" }}
        intro="Razorpay payments, the refund queue and webhook deliveries that could not be applied. Amounts are in Indian rupees."
      />

      <Panel
        id="refunds"
        title="Refund queue"
        description="Requests waiting for review appear first (oldest first), followed by the 20 most recently completed or declined refunds."
      >
        {canRefund && !razorpayReady && (
          <div className="mb-4">
            <Alert tone="warning" title="Razorpay is not configured — refunds cannot be processed online">
              Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the server to enable refunds. Requests stay in the queue until then; you can still decline them.
            </Alert>
          </div>
        )}
        {canRefund && !adminReady && (
          <div className="mb-4">
            <Alert tone="warning" title="Server credentials missing">
              SUPABASE_SECRET_KEY is not configured, so refunds cannot be processed or declined.
            </Alert>
          </div>
        )}
        {!canRefund && (
          <p className="mb-4 text-sm text-muted">You can view refunds. Processing or declining them requires the refunds permission (owner or administrator).</p>
        )}
        {refundsError ? (
          <LoadError what="refunds" />
        ) : refundRows.length === 0 ? (
          <EmptyState title="No refunds yet">Refund requests appear here when a paid booking is cancelled.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {refundRows.map((r) => {
              const actionable = ACTIONABLE_REFUND.includes(r.status);
              return (
                <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1 text-sm">
                      <p className="flex flex-wrap items-center gap-2">
                        <BookingLink booking={r.bookings} />
                        <span className="font-semibold">{formatINR(r.amount_paise)}</span>
                        <Badge tone={REFUND_TONES[r.status] ?? "gray"}>{label(r.status)}</Badge>
                      </p>
                      <p className="break-words text-charcoal">
                        <span className="text-muted">Reason: </span>
                        {r.reason}
                      </p>
                      {r.failure_reason && (
                        <p className={`break-words ${r.status === "rejected" ? "text-charcoal" : "text-red-800"}`}>
                          <span className="text-muted">{r.status === "rejected" ? "Declined because: " : "Failure: "}</span>
                          {r.failure_reason}
                        </p>
                      )}
                      <p className="text-xs text-muted">
                        Requested {formatDateTime(r.created_at)}
                        {r.processed_at && <> · processed {formatDateTime(r.processed_at)}</>}
                        {r.provider_refund_id && <> · gateway id <span className="font-mono">{r.provider_refund_id}</span></>}
                      </p>
                    </div>
                  </div>
                  {canRefund && actionable && (
                    <div className="mt-3 grid gap-4 lg:grid-cols-2">
                      <div>
                        {razorpayReady && adminReady ? (
                          <ActionForm
                            action={processRefund}
                            confirm={`Refund ${formatINR(r.amount_paise)} to the customer via Razorpay? This sends money back and cannot be undone.`}
                          >
                            <input type="hidden" name="id" value={r.id} />
                            <AdminSubmit pendingLabel="Processing…">Process via Razorpay</AdminSubmit>
                          </ActionForm>
                        ) : (
                          <Button type="button" disabled aria-disabled title="Razorpay is not configured">
                            Process via Razorpay
                          </Button>
                        )}
                      </div>
                      <ActionForm
                        action={declineRefund}
                        confirm="Decline this refund request? The customer will not be refunded."
                        labels={{ reason: "Reason" }}
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <div className="flex flex-col gap-2">
                          <Field label="Reason for declining (recorded on the booking timeline)" name={`reason-${r.id}`} required>
                            <Textarea
                              name="reason"
                              id={`reason-${r.id}`}
                              required
                              minLength={3}
                              maxLength={500}
                              placeholder="3–500 characters"
                              className="min-h-16"
                            />
                          </Field>
                          <div>
                            <AdminSubmit variant="outline" size="sm" pendingLabel="Declining…">
                              Decline
                            </AdminSubmit>
                          </div>
                        </div>
                      </ActionForm>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {canRead && (
        <Panel title="Payments" description="Most recent first. Card details are never stored — only Razorpay identifiers.">
          <nav aria-label="Filter payments by status" className="mb-4 flex flex-wrap gap-2">
            {[undefined, ...PAYMENT_STATUSES].map((s) => (
              <Link
                key={s ?? "all"}
                href={s ? `/admin/payments?status=${s}` : "/admin/payments"}
                aria-current={s === status ? "page" : undefined}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize ${s === status ? "border-forest-800 bg-forest-800 text-white" : "border-line text-forest-800 hover:bg-forest-50"}`}
              >
                {s ? label(s) : "All"}
              </Link>
            ))}
          </nav>
          {payments?.error ? (
            <LoadError what="payments" />
          ) : paymentRows.length === 0 ? (
            <EmptyState title={status ? `No ${label(status)} payments` : "No payments yet"} />
          ) : (
            <>
              <TableWrap label="Payments">
                <thead>
                  <tr>
                    <Th>Created</Th>
                    <Th>Booking</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Status</Th>
                    <Th>Method</Th>
                    <Th>Razorpay ids</Th>
                    <Th>Captured</Th>
                    <Th>Failure</Th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((p) => (
                    <tr key={p.id}>
                      <Td className="whitespace-nowrap">{formatDateTime(p.created_at)}</Td>
                      <Td>
                        <BookingLink booking={p.bookings} />
                      </Td>
                      <Td className="text-right font-medium whitespace-nowrap">{formatINR(p.amount_paise)}</Td>
                      <Td>
                        <Badge tone={PAYMENT_TONES[p.status] ?? "gray"}>{label(p.status)}</Badge>
                      </Td>
                      <Td className="capitalize">{p.method ?? "—"}</Td>
                      <Td className="font-mono text-xs break-all">
                        <div>order: {p.provider_order_id}</div>
                        <div>payment: {p.provider_payment_id ?? "—"}</div>
                      </Td>
                      <Td className="whitespace-nowrap">{p.captured_at ? formatDateTime(p.captured_at) : "—"}</Td>
                      <Td className="max-w-xs text-red-800">
                        {p.failure_reason || p.failure_code ? (
                          <>
                            {p.failure_reason ?? ""}
                            {p.failure_code && <span className="block font-mono text-xs">{p.failure_code}</span>}
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              <Pagination page={page} pageSize={PAGE_SIZE} total={payments?.count ?? null} basePath="/admin/payments" params={{ status }} />
            </>
          )}
        </Panel>
      )}

      {canRead && (
        <Panel
          id="webhooks"
          title="Webhook errors"
          description="Razorpay webhook deliveries that failed to apply (50 most recent). Check the booking and payment manually, then contact the customer if needed."
        >
          {webhooks?.error ? (
            <LoadError what="webhook events" />
          ) : webhookRows.length === 0 ? (
            <EmptyState title="No webhook errors">All received webhook events were applied successfully.</EmptyState>
          ) : (
            <TableWrap label="Webhook errors">
              <thead>
                <tr>
                  <Th>Received</Th>
                  <Th>Event</Th>
                  <Th>Processed</Th>
                  <Th>Error</Th>
                </tr>
              </thead>
              <tbody>
                {webhookRows.map((w) => (
                  <tr key={w.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(w.received_at)}</Td>
                    <Td>
                      <span className="font-mono text-xs">{w.event_type}</span>
                      <span className="block font-mono text-xs break-all text-muted">{w.event_id}</span>
                    </Td>
                    <Td className="whitespace-nowrap">{w.processed_at ? formatDateTime(w.processed_at) : "—"}</Td>
                    <Td className="max-w-md">
                      <p className="break-words text-red-800">{w.processing_error}</p>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-forest-800">Payload</summary>
                        <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-ivory-dark/60 p-2 text-xs whitespace-pre-wrap break-all">
                          {truncatedJson(w.payload)}
                        </pre>
                      </details>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Panel>
      )}
    </div>
  );
}
