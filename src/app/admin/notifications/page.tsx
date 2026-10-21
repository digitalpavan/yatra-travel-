import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import { Badge, EmptyState } from "@/components/ui";
import { AdminHeader, LoadError, Panel, TableWrap, Td, Th, sp } from "@/components/admin/AdminUI";

export const metadata: Metadata = { title: "Notifications", robots: { index: false, follow: false } };

interface NotificationRow {
  id: string;
  channel: "email" | "whatsapp";
  template: string;
  recipient: string;
  status: "queued" | "sent" | "failed" | "skipped";
  error: string | null;
  attempts: number;
  created_at: string;
  bookings: { reference: string } | null;
}

const STATUSES = ["failed", "skipped", "sent", "queued"] as const;

export default async function NotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  await requirePermission("bookings.read", "/admin/notifications");
  const requested = sp((await searchParams).status);
  const status = (STATUSES as readonly string[]).includes(requested ?? "") ? requested! : "failed";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, channel, template, recipient, status, error, attempts, created_at, bookings(reference)")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as unknown as NotificationRow[];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Notifications"
        back={{ href: "/admin", label: "Overview" }}
        intro="The 100 most recent email and WhatsApp notifications with the selected status. Failed messages need a manual follow-up with the customer."
      />
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/notifications?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize ${s === status ? "border-forest-800 bg-forest-800 text-white" : "border-line text-forest-800 hover:bg-forest-50"}`}
          >
            {s}
          </Link>
        ))}
      </nav>
      <Panel>
        {error ? (
          <LoadError what="notifications" />
        ) : rows.length === 0 ? (
          <EmptyState title={`No ${status} notifications`} />
        ) : (
          <TableWrap label="Notifications">
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Channel</Th>
                <Th>Template</Th>
                <Th>Booking</Th>
                <Th>Recipient</Th>
                <Th>Error</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(n.created_at)}</Td>
                  <Td>
                    <Badge tone={n.channel === "email" ? "blue" : "green"}>{n.channel}</Badge>
                  </Td>
                  <Td className="font-mono text-xs">{n.template}</Td>
                  <Td>
                    {n.bookings ? (
                      <Link className="font-medium text-forest-800 underline-offset-2 hover:underline" href={`/admin/bookings/${n.bookings.reference}`}>
                        {n.bookings.reference}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="break-all">{n.recipient}</Td>
                  <Td className="max-w-xs text-red-800">{n.error ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
