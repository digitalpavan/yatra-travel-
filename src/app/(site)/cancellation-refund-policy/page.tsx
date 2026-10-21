import Link from "next/link";
import { LegalPage } from "@/components/content/LegalPage";
import { getSiteSettings } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Cancellation & Refund Policy",
  description:
    "How cancellations and refunds work for Yatra Travel packages and cabs: refund percentages by notice period, how to cancel, refund timelines and exceptions.",
  path: "/cancellation-refund-policy",
});

const CONTENTS = [
  { id: "schedule", label: "Refund schedule" },
  { id: "how", label: "How to cancel" },
  { id: "refunds", label: "How refunds are paid" },
  { id: "our-cancellations", label: "If we cancel" },
  { id: "changes", label: "Changes and no-shows" },
  { id: "not-covered", label: "Not covered" },
];

function describeHours(hours: number): string {
  if (hours <= 0) return "the trip start time";
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${hours} hours (${days} day${days === 1 ? "" : "s"})`;
  }
  return `${hours} hours`;
}

function percent(bps: number): string {
  const p = bps / 100;
  return `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
}

export default async function CancellationPolicyPage() {
  const settings = await getSiteSettings();
  const tiers = [...(settings.cancellation_policy.tiers ?? [])].sort((a, b) => b.min_hours_before - a.min_hours_before);
  const note = settings.cancellation_policy.note;

  return (
    <LegalPage
      title="Cancellation & refund policy"
      intro="What happens if you need to cancel a package or cab booking, and how refunds are paid."
      path="/cancellation-refund-policy"
      settings={settings}
      contents={CONTENTS}
    >
      <h2 id="schedule">1. Refund schedule</h2>
      <p>
        The refund depends on how long before the scheduled pickup time you cancel. Percentages apply to the amount you paid for
        the booking.
      </p>
      {tiers.length ? (
        <div className="not-prose my-6 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Refund percentage by cancellation notice</caption>
            <thead className="bg-ivory-dark text-forest-900">
              <tr>
                <th scope="col" className="px-4 py-3">When you cancel</th>
                <th scope="col" className="px-4 py-3 text-right">Refund</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier, i) => {
                const upper = i > 0 ? tiers[i - 1].min_hours_before : null;
                const label =
                  tier.min_hours_before <= 0
                    ? upper !== null
                      ? `Less than ${describeHours(upper)} before pickup`
                      : "Any time before pickup"
                    : `${describeHours(tier.min_hours_before)} or more before pickup`;
                return (
                  <tr key={`${tier.min_hours_before}-${tier.refund_bps}`} className="border-t border-line">
                    <th scope="row" className="px-4 py-3 font-normal">{label}</th>
                    <td className="px-4 py-3 text-right font-semibold text-forest-900">{percent(tier.refund_bps)}</td>
                  </tr>
                );
              })}
              {tiers.at(-1)?.min_hours_before === 0 ? null : (
                <tr className="border-t border-line">
                  <th scope="row" className="px-4 py-3 font-normal">
                    Less than {describeHours(tiers.at(-1)!.min_hours_before)} before pickup
                  </th>
                  <td className="px-4 py-3 text-right font-semibold text-forest-900">0%</td>
                </tr>
              )}
              <tr className="border-t border-line">
                <th scope="row" className="px-4 py-3 font-normal">After the trip has started, or no-show</th>
                <td className="px-4 py-3 text-right font-semibold text-forest-900">0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          <em>The refund schedule has not been published yet. Please <Link href="/contact">contact us</Link> before cancelling.</em>
        </p>
      )}
      {note && (
        <p className="rounded-xl border border-gold-200 bg-gold-50 px-4 py-3 text-sm text-gold-700">
          <strong className="text-gold-700">Note:</strong> {note}
        </p>
      )}
      <p>The refund amount for your booking is calculated and shown to you before you confirm a cancellation.</p>

      <h2 id="how">2. How to cancel</h2>
      <ul>
        <li>
          <strong>Signed-in customers:</strong> open the booking from <Link href="/account">My account</Link> and choose
          &ldquo;Cancel booking&rdquo;. You will see the refund amount before confirming.
        </li>
        <li>
          <strong>Otherwise:</strong> send a request through our <Link href="/contact">support form</Link> with your booking
          reference (it looks like YT261021-ABCDE), choosing the &ldquo;Cancellation or refund&rdquo; topic.
        </li>
      </ul>
      <p>The time of cancellation is the time your cancellation is recorded in our system.</p>

      <h2 id="refunds">3. How refunds are paid</h2>
      <ul>
        <li>
          Refunds are made to the <strong>original payment method</strong> used for the booking, through our payment gateway. We
          cannot refund to a different account or in cash.
        </li>
        <li>
          We initiate eligible refunds promptly after cancellation. The time for the money to reach you depends on your bank, card
          issuer or UPI app and the payment gateway&apos;s processing times.
        </li>
        <li>Unpaid bookings that expire or are cancelled are released without any charge.</li>
      </ul>

      <h2 id="our-cancellations">4. If we have to cancel</h2>
      <p>
        If we cannot operate a confirmed booking — for example, no suitable vehicle is available — we will offer you an alternative
        vehicle or date, or a <strong>full refund</strong> of the amount paid.
      </p>

      <h2 id="changes">5. Changes, delays and no-shows</h2>
      <ul>
        <li>Requests to change the date, time or vehicle are subject to availability and any fare difference.</li>
        <li>
          If you are not at the pickup point and cannot be reached within a reasonable waiting time, the booking may be treated as a
          no-show.
        </li>
        <li>Unused parts of a trip, such as skipped places or early drops, are not refundable.</li>
      </ul>

      <h2 id="not-covered">6. What this policy does not cover</h2>
      <p>
        <strong>Darshan, seva and accommodation tickets are not sold by us.</strong> Their cancellation and refund rules are set by
        Tirumala Tirupati Devasthanams (TTD) or the relevant temple administration, and you must contact them directly. A change to
        your darshan slot does not automatically change or cancel your booking with us — please tell us so we can try to adjust
        the trip.
      </p>
      <p>
        Tolls, parking or permits already paid during a trip, and third-party bookings such as hotels, trains or flights, are not
        refundable by us.
      </p>
    </LegalPage>
  );
}
