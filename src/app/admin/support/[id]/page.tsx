import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import { Alert, EmptyState, Field, Select, Textarea } from "@/components/ui";
import { AdminHeader, KeyValues, LoadError, Panel } from "@/components/admin/AdminUI";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { TICKET_STATUS_LABELS, TicketStatusBadge } from "@/components/admin/SupportBadges";
import { replyToTicket, setTicketStatus } from "../actions";

export const metadata: Metadata = { title: "Support ticket", robots: { index: false, follow: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Ticket {
  id: string;
  reference: string;
  customer_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  category: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  bookings: { reference: string; status: string } | null;
}

interface Message {
  id: number;
  is_staff: boolean;
  body: string;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
}

export default async function SupportTicketPage({ params }: PageProps<"/admin/support/[id]">) {
  const { id } = await params;
  await requirePermission("support.manage", `/admin/support/${id}`);
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createSupabaseServerClient();
  const [ticketRes, messagesRes] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("id, reference, customer_id, name, email, phone, category, subject, status, created_at, updated_at, bookings(reference, status)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("ticket_messages")
      .select("id, is_staff, body, created_at, profiles!ticket_messages_author_id_fkey(full_name, email)")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  if (ticketRes.error) {
    return (
      <div className="space-y-6">
        <AdminHeader title="Support ticket" back={{ href: "/admin/support", label: "Support" }} />
        <LoadError what="the ticket" />
      </div>
    );
  }
  const ticket = ticketRes.data as unknown as Ticket | null;
  if (!ticket) notFound();
  const messages = (messagesRes.data ?? []) as unknown as Message[];

  return (
    <div className="space-y-6">
      <AdminHeader
        title={ticket.subject}
        back={{ href: "/admin/support", label: "Support" }}
        intro={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{ticket.reference}</span>
            <TicketStatusBadge status={ticket.status} />
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Panel title="Conversation">
            {messagesRes.error ? (
              <LoadError what="messages" />
            ) : messages.length === 0 ? (
              <EmptyState title="No messages yet" />
            ) : (
              <ol className="space-y-3">
                {messages.map((m) => {
                  const author = m.profiles?.full_name || m.profiles?.email || (m.is_staff ? "Staff" : ticket.name);
                  return (
                    <li
                      key={m.id}
                      className={`max-w-[90%] rounded-2xl border p-3 text-sm ${
                        m.is_staff ? "ml-auto border-forest-100 bg-forest-50" : "mr-auto border-line bg-white"
                      }`}
                    >
                      <p className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span className="font-semibold text-forest-900">{m.is_staff ? `${author} (staff)` : author}</span>
                        <time dateTime={m.created_at}>{formatDateTime(m.created_at)}</time>
                      </p>
                      <p className="break-words whitespace-pre-line text-charcoal">{m.body}</p>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <Panel title="Reply to customer" id="reply">
            {ticket.status === "closed" && (
              <div className="mb-4">
                <Alert tone="info">This ticket is closed — the customer cannot reply until it is reopened.</Alert>
              </div>
            )}
            <ActionForm action={replyToTicket} resetOnSuccess labels={{ body: "Reply" }}>
              <input type="hidden" name="ticket_id" value={ticket.id} />
              <div className="space-y-3">
                <Field
                  label="Message"
                  name="body"
                  required
                  hint={ticket.status === "open" ? "Replying marks the ticket as in progress. Up to 5000 characters." : "Up to 5000 characters."}
                >
                  <Textarea name="body" required maxLength={5000} />
                </Field>
                <AdminSubmit pendingLabel="Sending…">Send reply</AdminSubmit>
              </div>
            </ActionForm>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Details">
            <KeyValues
              items={[
                ["Customer", ticket.name],
                [
                  "Email",
                  <a key="e" className="break-all text-forest-800 hover:underline" href={`mailto:${ticket.email}`}>
                    {ticket.email}
                  </a>,
                ],
                [
                  "Phone",
                  ticket.phone ? (
                    <a className="text-forest-800 hover:underline" href={`tel:${ticket.phone}`}>
                      {ticket.phone}
                    </a>
                  ) : (
                    "—"
                  ),
                ],
                ["Category", <span key="c" className="capitalize">{ticket.category}</span>],
                [
                  "Booking",
                  ticket.bookings ? (
                    <Link className="text-forest-800 hover:underline" href={`/admin/bookings/${ticket.bookings.reference}`}>
                      {ticket.bookings.reference}
                    </Link>
                  ) : (
                    "—"
                  ),
                ],
                ["Account", ticket.customer_id ? "Registered customer" : "Guest"],
                ["Opened", formatDateTime(ticket.created_at)],
                ["Updated", formatDateTime(ticket.updated_at)],
              ]}
            />
          </Panel>

          <Panel title="Status">
            <ActionForm action={setTicketStatus}>
              <input type="hidden" name="id" value={ticket.id} />
              <div className="space-y-3">
                <Field label="Ticket status" name="status">
                  <Select name="status" defaultValue={ticket.status}>
                    {Object.entries(TICKET_STATUS_LABELS).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </Select>
                </Field>
                <AdminSubmit size="sm" variant="outline">
                  Update status
                </AdminSubmit>
              </div>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </div>
  );
}
