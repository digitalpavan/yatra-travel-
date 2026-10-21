import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAnyStaff } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/money";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/types";
import { Alert, ButtonLink } from "@/components/ui";
import { AdminHeader, LoadError, Panel, StatTile, sp } from "@/components/admin/AdminUI";

export const metadata: Metadata = { title: "Overview", robots: { index: false, follow: false } };

interface Overview {
  bookings_by_status: Partial<Record<BookingStatus, number>>;
  upcoming_7_days: number;
  unassigned_upcoming: number;
  captured_30_days_paise: number;
  refunded_30_days_paise: number;
  refunds_awaiting_action: number;
  open_tickets: number;
  new_itinerary_requests: number;
  pending_reviews: number;
  failed_notifications_7_days: number;
}

const STATUS_ORDER: BookingStatus[] = ["pending", "confirmed", "assigned", "in_progress", "completed", "cancelled", "refund_pending", "refunded"];

export default async function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  const viewer = await requireAnyStaff("/admin");
  const denied = sp((await searchParams).denied) === "1";

  if (!viewer.permissions.includes("reports.read")) {
    // Drivers land on their trips list.
    if (viewer.permissions.includes("trips.own")) redirect(denied ? "/admin/trips?denied=1" : "/admin/trips");
    redirect("/account");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_overview");
  const o = data as Overview | null;
  const can = (p: (typeof viewer.permissions)[number]) => viewer.permissions.includes(p);

  return (
    <div className="space-y-6">
      <AdminHeader title="Overview" intro="Today's operations at a glance. Figures come live from the database." />
      {denied && (
        <Alert tone="warning" title="Access denied">
          Your role does not have permission to open that page. Ask an owner or administrator if you need access.
        </Alert>
      )}
      {error || !o ? (
        <LoadError what="the overview" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Upcoming (7 days)" value={o.upcoming_7_days} href="/admin/bookings?status=confirmed" />
            <StatTile
              label="Unassigned upcoming"
              value={o.unassigned_upcoming}
              href="/admin/bookings?status=confirmed"
              tone={o.unassigned_upcoming > 0 ? "attention" : "default"}
              hint="Confirmed, no vehicle yet"
            />
            <StatTile label="Captured (30 days)" value={formatINR(o.captured_30_days_paise)} href={can("payments.read") ? "/admin/payments" : undefined} />
            <StatTile label="Refunded (30 days)" value={formatINR(o.refunded_30_days_paise)} href={can("payments.read") ? "/admin/payments" : undefined} />
          </div>

          <Panel title="Needs attention">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <StatTile
                label="Refunds awaiting action"
                value={o.refunds_awaiting_action}
                href={can("refunds.manage") || can("payments.read") ? "/admin/payments#refunds" : undefined}
                tone={o.refunds_awaiting_action > 0 ? "attention" : "default"}
              />
              <StatTile
                label="Open tickets"
                value={o.open_tickets}
                href={can("support.manage") ? "/admin/support" : undefined}
                tone={o.open_tickets > 0 ? "attention" : "default"}
              />
              <StatTile
                label="New itinerary requests"
                value={o.new_itinerary_requests}
                href={can("support.manage") ? "/admin/support#itinerary" : undefined}
                tone={o.new_itinerary_requests > 0 ? "attention" : "default"}
              />
              <StatTile
                label="Pending reviews"
                value={o.pending_reviews}
                href={can("reviews.manage") ? "/admin/reviews" : undefined}
                tone={o.pending_reviews > 0 ? "attention" : "default"}
              />
              <StatTile
                label="Failed notifications (7 days)"
                value={o.failed_notifications_7_days}
                href={can("bookings.read") ? "/admin/notifications" : undefined}
                tone={o.failed_notifications_7_days > 0 ? "attention" : "default"}
              />
            </div>
          </Panel>

          <Panel title="Bookings by status" actions={can("bookings.read") ? <ButtonLink href="/admin/bookings" variant="outline" size="sm">All bookings</ButtonLink> : undefined}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STATUS_ORDER.map((status) => (
                <li key={status}>
                  <StatTile
                    label={BOOKING_STATUS_LABELS[status]}
                    value={o.bookings_by_status[status] ?? 0}
                    href={can("bookings.read") ? `/admin/bookings?status=${status}` : undefined}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}
