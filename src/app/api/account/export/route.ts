import { getSessionUser } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Personal data export for the signed-in user (RLS limits every query to their own rows). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const supabase = await createSupabaseServerClient();
  const [profile, bookings, payments, refunds, tickets, consents, requests, reviews] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("bookings").select("*").eq("customer_id", user.id),
    supabase.from("payments").select("booking_id, amount_paise, status, method, captured_at, created_at"),
    supabase.from("refunds").select("booking_id, amount_paise, status, reason, processed_at, created_at"),
    supabase.from("support_tickets").select("reference, subject, status, created_at, ticket_messages(body, is_staff, created_at)").eq("customer_id", user.id),
    supabase.from("consent_records").select("purpose, granted, source, policy_version, created_at").eq("user_id", user.id),
    supabase.from("data_requests").select("request_type, status, details, response_note, created_at").eq("user_id", user.id),
    supabase.from("reviews").select("rating, title, body, status, created_at").eq("customer_id", user.id),
  ]);
  const body = JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      profile: profile.data,
      bookings: bookings.data,
      payments: payments.data,
      refunds: refunds.data,
      support_tickets: tickets.data,
      consent_records: consents.data,
      data_requests: requests.data,
      reviews: reviews.data,
    },
    null,
    2,
  );
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="yatra-travel-my-data.json"`,
      "Cache-Control": "no-store",
    },
  });
}
