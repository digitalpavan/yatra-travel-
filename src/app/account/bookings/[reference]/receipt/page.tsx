import { notFound } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { PrintButton } from "@/components/account/PrintButton";
import { getSiteSettings } from "@/lib/data/catalog";
import { formatDateTime } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { getMyBooking } from "@/lib/server/account";
import { requireUser } from "@/lib/server/auth";

export const metadata = { title: "Payment receipt", robots: { index: false, follow: false } };

/**
 * Payment receipt (acknowledgement of payment). This is NOT a GST tax invoice;
 * issuing tax invoices requires the business's GST registration details and
 * invoice numbering — see README "Business decisions".
 */
export default async function ReceiptPage(props: PageProps<"/account/bookings/[reference]/receipt">) {
  const { reference } = await props.params;
  const viewer = await requireUser(`/account/bookings/${reference}/receipt`);
  const [detail, settings] = await Promise.all([getMyBooking(viewer.id, reference), getSiteSettings()]);
  if (!detail || detail.booking.amount_paid_paise === 0) notFound();
  const { booking, payments, refunds } = detail;
  const b = booking.price_breakdown;

  return (
    <article className="mx-auto max-w-2xl rounded-2xl border border-line bg-white p-6 sm:p-10 print:border-0 print:p-0">
      <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <LogoMark className="h-12 w-12" />
          <div>
            <p className="font-display text-xl font-semibold">{settings.brand.legal_name || settings.brand.name}</p>
            <p className="text-xs text-muted">{settings.contact.address}</p>
            {settings.brand.gstin && <p className="text-xs text-muted">GSTIN {settings.brand.gstin}</p>}
          </div>
        </div>
        <div className="text-right text-sm">
          <h1 className="text-lg font-semibold">Payment receipt</h1>
          <p>{booking.reference}</p>
        </div>
      </header>
      <section className="mt-4 grid gap-1 text-sm">
        <p><span className="text-muted">Customer:</span> {booking.contact_name} · {booking.contact_email}</p>
        <p><span className="text-muted">Service:</span> {b?.summary} · {b?.vehicle_label}</p>
        <p><span className="text-muted">Travel date:</span> {formatDateTime(booking.start_at)}</p>
      </section>
      <table className="mt-6 w-full text-sm">
        <tbody>
          {b?.lines?.map((l) => (
            <tr key={l.label} className="border-t border-line"><td className="py-2">{l.label}</td><td className="py-2 text-right">{formatINR(l.amount_paise)}</td></tr>
          ))}
          {b?.adjustment_paise ? <tr className="border-t border-line"><td className="py-2">Seasonal adjustment</td><td className="py-2 text-right">{formatINR(b.adjustment_paise)}</td></tr> : null}
          {b?.discount_paise ? <tr className="border-t border-line"><td className="py-2">Discount</td><td className="py-2 text-right">−{formatINR(b.discount_paise)}</td></tr> : null}
          {b?.tax_paise ? <tr className="border-t border-line"><td className="py-2">{b.tax_label} ({b.tax_rate_bps / 100}%){b.tax_included ? " included" : ""}</td><td className="py-2 text-right">{formatINR(b.tax_paise)}</td></tr> : null}
          <tr className="border-t-2 border-forest-800 font-semibold"><td className="py-2">Total</td><td className="py-2 text-right">{formatINR(booking.total_paise)}</td></tr>
        </tbody>
      </table>
      <h2 className="mt-6 text-base font-semibold">Payments received</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {payments.filter((p) => p.captured_at).map((p) => (
          <li key={p.id}>{formatDateTime(p.captured_at!)} — {formatINR(p.amount_paise)} via {p.method ?? "online payment"} (ref. {p.provider_payment_id})</li>
        ))}
      </ul>
      {refunds.some((r) => r.status === "processed") && (
        <>
          <h2 className="mt-4 text-base font-semibold">Refunds</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {refunds.filter((r) => r.status === "processed").map((r) => (
              <li key={r.id}>{formatDateTime(r.processed_at!)} — {formatINR(r.amount_paise)}</li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-8 text-xs text-muted">This is a payment acknowledgement generated electronically and is not a tax invoice.</p>
      <div className="mt-6 print:hidden"><PrintButton /></div>
    </article>
  );
}
