import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import type { MyBooking } from "@/lib/server/account";

export function BookingRow({ booking }: { booking: MyBooking }) {
  return (
    <li>
      <Link
        href={`/account/bookings/${booking.reference}`}
        className="flex flex-col gap-2 rounded-2xl border border-line bg-white p-4 hover:border-forest-300 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="font-semibold text-forest-900">{booking.price_breakdown?.summary ?? "Trip"}</p>
          <p className="text-sm text-muted">
            {formatDateTime(booking.start_at)} · {booking.reference}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={booking.status} />
          <span className="font-semibold">{formatINR(booking.total_paise)}</span>
        </div>
      </Link>
    </li>
  );
}
