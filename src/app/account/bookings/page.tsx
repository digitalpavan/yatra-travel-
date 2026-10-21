import { BookingRow } from "@/components/account/BookingRow";
import { ButtonLink, EmptyState, SectionHeading } from "@/components/ui";
import { getMyBookings } from "@/lib/server/account";
import { requireUser } from "@/lib/server/auth";

export const metadata = { title: "My bookings", robots: { index: false, follow: false } };

export default async function MyBookingsPage() {
  const viewer = await requireUser("/account/bookings");
  const bookings = await getMyBookings(viewer.id);
  return (
    <div>
      <SectionHeading as="h1" title="My bookings" intro="All your trips, newest first." />
      {bookings.length ? (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <BookingRow key={b.id} booking={b} />
          ))}
        </ul>
      ) : (
        <EmptyState title="You have no bookings yet" action={<ButtonLink href="/packages" variant="gold">Book a trip</ButtonLink>} />
      )}
    </div>
  );
}
