import { NewTicketForm, TicketReplyForm } from "@/components/account/AccountForms";
import { Badge, Card, EmptyState, SectionHeading } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { requireUser } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Support", robots: { index: false, follow: false } };

type Ticket = {
  id: string;
  reference: string;
  subject: string;
  status: string;
  created_at: string;
  ticket_messages: { id: number; body: string; is_staff: boolean; created_at: string }[];
};

export default async function SupportPage() {
  const viewer = await requireUser("/account/support");
  const supabase = await createSupabaseServerClient();
  const [{ data: tickets }, { data: bookings }] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id, reference, subject, status, created_at, ticket_messages(id, body, is_staff, created_at)")
      .eq("customer_id", viewer.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("bookings").select("reference").eq("customer_id", viewer.id).order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeading as="h1" title="Support" intro="Questions about a booking, payment or refund? Send us a message — replies appear here." />
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">New request</h2>
        <NewTicketForm references={(bookings ?? []).map((b) => b.reference)} />
      </Card>
      <section aria-labelledby="tickets">
        <h2 id="tickets" className="mb-3 text-lg font-semibold">Your requests</h2>
        {(tickets as Ticket[] | null)?.length ? (
          <ul className="space-y-4">
            {(tickets as Ticket[]).map((t) => (
              <li key={t.id}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{t.subject}</p>
                    <Badge tone={t.status === "resolved" || t.status === "closed" ? "gray" : "gold"}>{t.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted">{t.reference} · {formatDateTime(t.created_at)}</p>
                  <ol className="mt-3 space-y-2">
                    {[...t.ticket_messages].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((m) => (
                      <li key={m.id} className={`rounded-xl p-3 text-sm ${m.is_staff ? "bg-forest-50" : "bg-ivory-dark"}`}>
                        <p className="mb-1 text-xs font-semibold text-muted">{m.is_staff ? "Yatra Travel" : "You"} · {formatDateTime(m.created_at)}</p>
                        <p className="whitespace-pre-line">{m.body}</p>
                      </li>
                    ))}
                  </ol>
                  {t.status !== "closed" && <div className="mt-3"><TicketReplyForm ticketId={t.id} /></div>}
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No support requests yet" />
        )}
      </section>
    </div>
  );
}
