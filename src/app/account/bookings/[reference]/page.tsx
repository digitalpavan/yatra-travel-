import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelBookingForm, ReviewForm } from "@/components/account/AccountForms";
import { PayButton } from "@/components/account/PayButton";
import { Alert, Badge, Card, StatusBadge } from "@/components/ui";
import { computeRefund } from "@/lib/cancellation";
import { getSiteSettings } from "@/lib/data/catalog";
import { formatDateTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { getMyBooking } from "@/lib/server/account";
import { requireUser } from "@/lib/server/auth";
import { integrations } from "@/lib/server/env";
import { TTD_DISCLAIMER } from "@/lib/site";
import { BOOKING_STATUS_LABELS, VEHICLE_CLASS_LABELS, type VehicleClass } from "@/lib/types";

export const metadata = { title: "Booking details", robots: { index: false, follow: false } };

const PAYMENT_LABELS: Record<string, string> = {
  created: "Started",
  authorized: "Authorised",
  captured: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
};
const REFUND_LABELS: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  processing: "Processing",
  processed: "Refunded",
  failed: "Delayed — our team is on it",
  rejected: "Declined",
};

export default async function BookingDetailPage(props: PageProps<"/account/bookings/[reference]">) {
  const { reference } = await props.params;
  const viewer = await requireUser(`/account/bookings/${reference}`);
  const [detail, settings] = await Promise.all([getMyBooking(viewer.id, reference), getSiteSettings()]);
  if (!detail) notFound();
  const { booking, events, payments, refunds, assignment, review } = detail;
  const breakdown = booking.price_breakdown;
  const now = new Date();
  const payable = booking.status === "pending" && booking.payment_due_by && new Date(booking.payment_due_by) > now;
  const holdExpired = booking.status === "pending" && !payable;
  const refund = computeRefund({
    policy: settings.cancellation_policy,
    status: booking.status,
    startAt: new Date(booking.start_at),
    now,
    amountPaidPaise: booking.amount_paid_paise,
    amountRefundedPaise: booking.amount_refunded_paise,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/account/bookings" className="text-sm text-muted hover:underline">← My bookings</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold sm:text-3xl">{breakdown?.summary ?? "Your trip"}</h1>
          <StatusBadge status={booking.status} />
        </div>
        <p className="mt-1 text-sm text-muted">Reference <strong className="text-charcoal">{booking.reference}</strong> · booked {formatDateTime(booking.created_at)}</p>
      </div>

      {payable && (
        <Card className="border-gold-300 p-5">
          <h2 className="text-lg font-semibold">Complete your payment</h2>
          <p className="mt-1 text-sm text-muted">
            Your vehicle is held until <strong>{formatDateTime(booking.payment_due_by!)}</strong>. Pay {formatINR(booking.total_paise)} securely to confirm.
          </p>
          <div className="mt-4">
            {integrations.razorpay() ? (
              <PayButton reference={booking.reference} label={`Pay ${formatINR(booking.total_paise)}`} />
            ) : (
              <Alert tone="warning" title="Online payment is not available yet">
                Please contact us to complete this booking. Your booking reference is {booking.reference}.
              </Alert>
            )}
          </div>
        </Card>
      )}
      {holdExpired && (
        <Alert tone="warning" title="Payment window has ended">
          This booking will be released shortly. If you were charged, the payment will be confirmed or refunded automatically.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">Trip details</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Pickup</dt><dd>{formatDateTime(booking.start_at)}</dd>
            <dt className="text-muted">From</dt><dd>{booking.pickup_location}</dd>
            {booking.drop_location && (<><dt className="text-muted">To</dt><dd>{booking.drop_location}</dd></>)}
            <dt className="text-muted">Until</dt><dd>{formatDateTime(booking.end_at)}</dd>
            <dt className="text-muted">Vehicle</dt><dd>{breakdown?.vehicle_label ?? VEHICLE_CLASS_LABELS[booking.vehicle_class as VehicleClass]}</dd>
            <dt className="text-muted">Travellers</dt><dd>{booking.passengers} passenger(s), {booking.luggage_bags} bag(s)</dd>
            {booking.special_requests && (<><dt className="text-muted">Requests</dt><dd>{booking.special_requests}</dd></>)}
            <dt className="text-muted">Contact</dt><dd>{booking.contact_name} · {booking.contact_phone}</dd>
          </dl>
          {assignment && (
            <div className="mt-4 rounded-xl bg-forest-50 p-3 text-sm">
              <p className="font-semibold text-forest-900">Your driver</p>
              <p>{assignment.driver_name} · <a className="underline" href={`tel:${assignment.driver_phone}`}>{assignment.driver_phone}</a></p>
              <p className="text-muted">{assignment.vehicle_model} · {assignment.registration_number}</p>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">Fare</h2>
          <dl className="space-y-1 text-sm">
            {breakdown?.lines?.map((l) => (
              <div key={l.label} className="flex justify-between gap-3"><dt className="text-muted">{l.label}</dt><dd>{formatINR(l.amount_paise)}</dd></div>
            ))}
            {breakdown?.adjustment_paise ? (
              <div className="flex justify-between gap-3"><dt className="text-muted">Seasonal adjustment</dt><dd>{formatINR(breakdown.adjustment_paise)}</dd></div>
            ) : null}
            {breakdown?.discount_paise ? (
              <div className="flex justify-between gap-3"><dt className="text-muted">Discount ({breakdown.coupon?.code})</dt><dd>−{formatINR(breakdown.discount_paise)}</dd></div>
            ) : null}
            {breakdown?.tax_paise ? (
              <div className="flex justify-between gap-3"><dt className="text-muted">{breakdown.tax_label}{breakdown.tax_included ? " (included)" : ""}</dt><dd>{formatINR(breakdown.tax_paise)}</dd></div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatINR(booking.total_paise)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Paid</dt><dd>{formatINR(booking.amount_paid_paise)}</dd></div>
            {booking.amount_refunded_paise > 0 && (
              <div className="flex justify-between gap-3"><dt className="text-muted">Refunded</dt><dd>{formatINR(booking.amount_refunded_paise)}</dd></div>
            )}
          </dl>
          {booking.amount_paid_paise > 0 && (
            <Link href={`/account/bookings/${booking.reference}/receipt`} className="mt-4 inline-block text-sm font-semibold text-forest-800 underline">
              View / print receipt
            </Link>
          )}
        </Card>
      </div>

      {(payments.length > 0 || refunds.length > 0) && (
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">Payments &amp; refunds</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted"><tr><th className="py-2 pr-4 font-medium">Date</th><th className="py-2 pr-4 font-medium">Type</th><th className="py-2 pr-4 font-medium">Status</th><th className="py-2 text-right font-medium">Amount</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-2 pr-4">{formatDateTime(p.captured_at ?? p.created_at)}</td>
                    <td className="py-2 pr-4">Payment{p.method ? ` (${p.method})` : ""}</td>
                    <td className="py-2 pr-4">{PAYMENT_LABELS[p.status] ?? p.status}{p.failure_reason ? ` — ${p.failure_reason}` : ""}</td>
                    <td className="py-2 text-right">{formatINR(p.amount_paise)}</td>
                  </tr>
                ))}
                {refunds.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-2 pr-4">{formatDateTime(r.processed_at ?? r.created_at)}</td>
                    <td className="py-2 pr-4">Refund</td>
                    <td className="py-2 pr-4">{REFUND_LABELS[r.status] ?? r.status}</td>
                    <td className="py-2 text-right">−{formatINR(r.amount_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">Booking timeline</h2>
        <ol className="space-y-3 border-l-2 border-gold-200 pl-5">
          {events.map((e) => (
            <li key={e.id} className="text-sm">
              <p className="font-medium">{e.note}</p>
              <p className="text-xs text-muted">
                {formatDateTime(e.created_at)}
                {e.status && <> · {BOOKING_STATUS_LABELS[e.status]}</>}
              </p>
            </li>
          ))}
        </ol>
      </Card>

      {refund.can_cancel && (
        <Card className="p-5">
          <details>
            <summary className="cursor-pointer font-semibold text-red-800">Cancel this booking</summary>
            <div className="mt-3">
              <CancelBookingForm
                reference={booking.reference}
                refundText={
                  booking.amount_paid_paise === 0
                    ? "This booking has not been paid, so no charge applies."
                    : `Under our cancellation policy you will receive a refund of ${formatINR(refund.refundable_paise)} (${refund.refund_bps / 100}% of the amount paid) if you cancel now.`
                }
              />
              <p className="mt-2 text-xs text-muted">
                See the <Link className="underline" href="/cancellation-refund-policy">cancellation &amp; refund policy</Link>.
              </p>
            </div>
          </details>
        </Card>
      )}

      {booking.status === "completed" && (
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">Review your trip</h2>
          {review ? (
            <p className="text-sm">
              Thank you for your review. <Badge tone={review.status === "approved" ? "green" : "gold"}>{review.status === "approved" ? "Published" : review.status === "pending" ? "Awaiting moderation" : "Not published"}</Badge>
            </p>
          ) : (
            <ReviewForm bookingId={booking.id} defaultName={booking.contact_name.split(" ")[0]} />
          )}
        </Card>
      )}

      <p className="text-xs text-muted">{TTD_DISCLAIMER}</p>
      <p className="text-sm">
        Need help? <Link href="/account/support" className="font-semibold text-forest-800 underline">Contact support</Link> and mention {booking.reference}.
      </p>
    </div>
  );
}
