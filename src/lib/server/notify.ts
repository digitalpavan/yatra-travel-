import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { integrations, serverEnv } from "@/lib/server/env";
import { publicEnv } from "@/lib/env";
import { formatINR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/types";

/**
 * Transactional notifications. Every attempt is logged in public.notifications
 * with status sent / failed / skipped (not configured or no consent). Failures
 * never break the booking flow; staff can see and follow up on failed messages.
 */

const TIMEOUT_MS = 10_000;

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

type SendResult = { status: "sent"; id: string } | { status: "failed" | "skipped"; error: string };

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<SendResult> {
  if (!integrations.email()) return { status: "skipped", error: "Email provider not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${serverEnv.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: serverEnv.emailFrom, to: [to], subject, html, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !json.id) return { status: "failed", error: json.message || `HTTP ${res.status}` };
    return { status: "sent", id: json.id };
  } catch (error) {
    return { status: "failed", error: (error as Error).message };
  }
}

/** WhatsApp Cloud API — approved template messages only. */
export async function sendWhatsAppTemplate(
  toE164: string,
  template: string,
  bodyParams: string[],
): Promise<SendResult> {
  if (!integrations.whatsapp()) return { status: "skipped", error: "WhatsApp Business API not configured" };
  const to = toE164.replace(/^\+/, "");
  try {
    const res = await fetch(
      `https://graph.facebook.com/${serverEnv.whatsappApiVersion}/${serverEnv.whatsappPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${serverEnv.whatsappAccessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: template,
            language: { code: serverEnv.whatsappTemplateLanguage },
            components: [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }],
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
    if (!res.ok || !json.messages?.[0]?.id) return { status: "failed", error: json.error?.message || `HTTP ${res.status}` };
    return { status: "sent", id: json.messages[0].id };
  } catch (error) {
    return { status: "failed", error: (error as Error).message };
  }
}

async function logNotification(entry: {
  booking_id?: string | null;
  user_id?: string | null;
  channel: "email" | "whatsapp";
  template: string;
  recipient: string;
  result: SendResult;
}) {
  const { result } = entry;
  const { error } = await createSupabaseAdminClient()
    .from("notifications")
    .insert({
      booking_id: entry.booking_id ?? null,
      user_id: entry.user_id ?? null,
      channel: entry.channel,
      template: entry.template,
      recipient: entry.recipient,
      status: result.status,
      provider_message_id: result.status === "sent" ? result.id : null,
      error: result.status === "sent" ? null : result.error,
      attempts: result.status === "skipped" ? 0 : 1,
      sent_at: result.status === "sent" ? new Date().toISOString() : null,
    });
  if (error) console.error("[notify] failed to log notification", error.message);
}

function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#faf6ec;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #eadfc2">
<tr><td style="background:#0f3d2e;color:#f5d27a;padding:20px 24px;border-radius:12px 12px 0 0;font-size:20px;font-weight:bold">Yatra Travel</td></tr>
<tr><td style="padding:24px"><h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;font-size:12px;color:#666;border-top:1px solid #eee">Yatra Travel is a private travel operator in Tirupati and is not affiliated with Tirumala Tirupati Devasthanams (TTD). Darshan tickets are issued only through official TTD channels.</td></tr>
</table></td></tr></table></body></html>`;
}

interface BookingForNotice {
  id: string;
  reference: string;
  customer_id: string | null;
  status: BookingStatus;
  start_at: string;
  pickup_location: string;
  total_paise: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
}

async function loadBooking(bookingId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, reference, customer_id, status, start_at, pickup_location, total_paise, contact_name, contact_email, contact_phone")
    .eq("id", bookingId)
    .single<BookingForNotice>();
  if (!booking) return null;
  const { data: profile } = booking.customer_id
    ? await supabase.from("profiles").select("whatsapp_opt_in").eq("id", booking.customer_id).maybeSingle()
    : { data: null };
  return { booking, whatsappOptIn: Boolean(profile?.whatsapp_opt_in) };
}

/** Send a booking status update by email (and WhatsApp for confirmations, with consent). */
export async function notifyBookingUpdate(bookingId: string, kind: "confirmed" | "cancelled" | "refund_processed" | "assigned") {
  try {
    const loaded = await loadBooking(bookingId);
    if (!loaded) return;
    const { booking, whatsappOptIn } = loaded;
    const url = `${publicEnv.siteUrl}/account/bookings/${booking.reference}`;
    const titles = {
      confirmed: `Booking confirmed — ${booking.reference}`,
      cancelled: `Booking cancelled — ${booking.reference}`,
      refund_processed: `Refund processed — ${booking.reference}`,
      assigned: `Your vehicle and driver are assigned — ${booking.reference}`,
    } as const;
    const title = titles[kind];
    const details = [
      ["Reference", booking.reference],
      ["Status", BOOKING_STATUS_LABELS[booking.status]],
      ["Pickup", `${formatDateTime(booking.start_at)} · ${booking.pickup_location}`],
      ["Total", formatINR(booking.total_paise)],
    ];
    const html = emailLayout(
      title,
      `<p>Namaste ${escapeHtml(booking.contact_name)},</p>
       <table cellpadding="6" style="border-collapse:collapse;font-size:14px">${details
         .map(([k, v]) => `<tr><td style="color:#666">${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`)
         .join("")}</table>
       <p><a href="${escapeHtml(url)}" style="display:inline-block;background:#0f3d2e;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">View booking</a></p>`,
    );
    const text = `${title}\n\n${details.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nView booking: ${url}`;

    const emailResult = await sendEmail(booking.contact_email, title, html, text);
    await logNotification({ booking_id: booking.id, user_id: booking.customer_id, channel: "email", template: `booking_${kind}`, recipient: booking.contact_email, result: emailResult });

    if (kind === "confirmed") {
      const waResult: SendResult = whatsappOptIn
        ? await sendWhatsAppTemplate(booking.contact_phone, serverEnv.whatsappTemplateBookingConfirmed, [
            booking.contact_name,
            booking.reference,
            formatDateTime(booking.start_at),
          ])
        : { status: "skipped", error: "Customer has not opted in to WhatsApp updates" };
      await logNotification({ booking_id: booking.id, user_id: booking.customer_id, channel: "whatsapp", template: "booking_confirmed", recipient: booking.contact_phone, result: waResult });
    }
  } catch (error) {
    console.error("[notify] booking update failed", (error as Error).message);
  }
}

/** Internal alert to staff (new booking, refund needed, webhook problems). */
export async function notifyStaff(subject: string, lines: string[]) {
  try {
    if (!serverEnv.staffAlertEmail) return;
    const html = emailLayout(subject, `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`);
    const result = await sendEmail(serverEnv.staffAlertEmail, `[Yatra Travel] ${subject}`, html, lines.join("\n"));
    await logNotification({ channel: "email", template: "staff_alert", recipient: serverEnv.staffAlertEmail, result });
  } catch (error) {
    console.error("[notify] staff alert failed", (error as Error).message);
  }
}
