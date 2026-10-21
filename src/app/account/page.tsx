import { connection } from "next/server";
import { BookingRow } from "@/components/account/BookingRow";
import { ButtonLink, EmptyState, SectionHeading } from "@/components/ui";
import { requestTime } from "@/lib/dates";
import { getMyBookings } from "@/lib/server/account";
import { requireUser } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "My account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  const viewer = await requireUser("/account");
  await connection();
  const supabase = await createSupabaseServerClient();
  const [bookings, { data: profile }] = await Promise.all([
    getMyBookings(viewer.id),
    supabase.from("profiles").select("full_name").eq("id", viewer.id).maybeSingle(),
  ]);
  const now = requestTime();
  const awaitingPayment = bookings.filter((b) => b.status === "pending" && b.payment_due_by && new Date(b.payment_due_by).getTime() > now);
  const upcoming = bookings
    .filter((b) => ["confirmed", "assigned", "in_progress"].includes(b.status) && new Date(b.end_at).getTime() > now)
    .sort((a, b) => a.start_at.localeCompare(b.start_at));

  return (
    <div className="space-y-10">
      <SectionHeading as="h1" title={`Namaste${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`} intro="Manage your trips, payments and support requests." />

      {viewer.role !== "customer" && (
        <p className="rounded-xl bg-forest-50 px-4 py-3 text-sm">
          You have staff access. <a className="font-semibold underline" href="/admin">Open the admin dashboard</a>
        </p>
      )}

      {awaitingPayment.length > 0 && (
        <section aria-labelledby="awaiting">
          <h2 id="awaiting" className="mb-3 text-xl font-semibold">Awaiting payment</h2>
          <ul className="space-y-3">{awaitingPayment.map((b) => <BookingRow key={b.id} booking={b} />)}</ul>
        </section>
      )}

      <section aria-labelledby="upcoming">
        <h2 id="upcoming" className="mb-3 text-xl font-semibold">Upcoming trips</h2>
        {upcoming.length ? (
          <ul className="space-y-3">{upcoming.map((b) => <BookingRow key={b.id} booking={b} />)}</ul>
        ) : (
          <EmptyState title="No upcoming trips" action={<ButtonLink href="/packages" variant="gold">Explore packages</ButtonLink>}>
            When you book a trip, it will appear here with its status and driver details.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
