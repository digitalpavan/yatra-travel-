import Link from "next/link";
import { GrievanceOfficer, LegalPage } from "@/components/content/LegalPage";
import { getSiteSettings } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";
import { TTD_DISCLAIMER } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Terms of Service",
  description:
    "Terms for booking tour packages and cabs with Yatra Travel in Tirupati: bookings, fares, payments, traveller responsibilities, cancellations and limits of liability.",
  path: "/terms",
});

const CONTENTS = [
  { id: "about", label: "About these terms" },
  { id: "services", label: "Our services" },
  { id: "temple", label: "Temple tickets" },
  { id: "booking", label: "Bookings" },
  { id: "fares", label: "Fares and payment" },
  { id: "changes", label: "Changes and cancellations" },
  { id: "travellers", label: "Traveller responsibilities" },
  { id: "delays", label: "Delays and events beyond control" },
  { id: "liability", label: "Liability" },
  { id: "accounts", label: "Accounts and content" },
  { id: "law", label: "Governing law" },
  { id: "contact", label: "Contact" },
];

export default async function TermsPage() {
  const settings = await getSiteSettings();
  const business = settings.brand.legal_name || settings.brand.name;
  const { hold_minutes, min_lead_hours, max_advance_days, tax_label, tax_rate_bps, prices_include_tax } = settings.booking;

  return (
    <LegalPage
      title="Terms of service"
      intro="The terms that apply when you use this website and book travel services with us."
      path="/terms"
      settings={settings}
      contents={CONTENTS}
    >
      <h2 id="about">1. About these terms</h2>
      <p>
        These terms form an agreement between you and <strong>{business}</strong> (&ldquo;Yatra Travel&rdquo;, &ldquo;we&rdquo;,
        &ldquo;us&rdquo;), a private transport and tour operator based in Tirupati, Andhra Pradesh. By creating an account or making a
        booking you agree to these terms, our <Link href="/privacy-policy">privacy policy</Link> and our{" "}
        <Link href="/cancellation-refund-policy">cancellation &amp; refund policy</Link>. These terms are an electronic record under
        the Information Technology Act, 2000.
      </p>

      <h2 id="services">2. Our services</h2>
      <p>
        We provide chauffeur-driven vehicles for fixed-itinerary tour packages, point-to-point and round-trip cabs, and custom
        itineraries around Tirupati, Tirumala and nearby destinations. Package and cab prices are <strong>per vehicle</strong>, not
        per person, unless stated otherwise. Inclusions and exclusions are listed on each package page and in your booking.
      </p>

      <h2 id="temple">3. Temple tickets and darshan</h2>
      <p>{TTD_DISCLAIMER}</p>
      <p>
        Itinerary timings around temple visits are estimates. Waiting times, queue arrangements, dress codes and access rules are
        decided by TTD and other temple administrations and may change without notice.
      </p>

      <h2 id="booking">4. Bookings</h2>
      <ul>
        <li>You must be at least 18 years old and provide accurate contact and trip details.</li>
        <li>
          Online bookings can be made at least {min_lead_hours} hours and up to {max_advance_days} days before the trip, subject
          to vehicle availability.
        </li>
        <li>
          A new booking is held for {hold_minutes} minutes while you complete payment. If payment is not completed in time, the
          booking is released automatically.
        </li>
        <li>A booking is confirmed only when payment succeeds and you receive a confirmation with a booking reference.</li>
        <li>The specific vehicle model and driver are assigned before the trip; the vehicle class you booked is guaranteed, not the model.</li>
      </ul>

      <h2 id="fares">5. Fares and payment</h2>
      <ul>
        <li>The full fare breakdown — including any seasonal adjustment, coupon discount and tax — is shown before payment.</li>
        {tax_rate_bps > 0 && (
          <li>
            {tax_label} at {tax_rate_bps / 100}% is {prices_include_tax ? "included in displayed prices" : "added to the fare at checkout"}.
          </li>
        )}
        <li>
          Cab fares are based on distance and the vehicle&apos;s per-km rate; round trips are subject to a minimum distance per day and
          a daily driver allowance. Tolls, parking and interstate permits are payable at actuals unless stated as included.
        </li>
        <li>
          Extra distance, extra hours or additional stops requested during the trip may be charged at the published rates and will be
          agreed with you first.
        </li>
        <li>
          Payments are processed securely by Razorpay. We do not store card or bank credentials. Payment-related disputes are also
          subject to the gateway&apos;s and your bank&apos;s terms.
        </li>
      </ul>

      <h2 id="changes">6. Changes and cancellations</h2>
      <p>
        You can request changes or cancel from your account or by contacting us. Refunds follow our{" "}
        <Link href="/cancellation-refund-policy">cancellation &amp; refund policy</Link>. If we must cancel a confirmed trip — for
        example because no suitable vehicle is available — we will offer an alternative or a full refund of the amount paid.
      </p>

      <h2 id="travellers">7. Traveller responsibilities</h2>
      <ul>
        <li>Be ready at the pickup point at the booked time. Long waiting may delay or shorten the itinerary.</li>
        <li>Do not exceed the seating capacity of the vehicle; the driver may refuse extra passengers for safety and legal reasons.</li>
        <li>
          Do not carry illegal or prohibited items, or items not permitted on Tirumala hill by TTD and security agencies. Vehicles and
          baggage may be checked at the Alipiri checkpoint.
        </li>
        <li>Alcohol, smoking and other intoxicants are not permitted in our vehicles.</li>
        <li>Treat drivers with respect. Damage to the vehicle caused by passengers may be charged at actual cost.</li>
        <li>Keep your own valuables, tickets and documents safe; we are not responsible for items left in the vehicle, though we will try to help recover them.</li>
      </ul>

      <h2 id="delays">8. Delays and events beyond our control</h2>
      <p>
        We plan carefully, but journey times can be affected by traffic, checkpoint queues, ghat road regulation, weather,
        road closures, festivals, strikes, government orders or vehicle breakdowns. We will try to arrange a replacement vehicle
        if one breaks down. We are not liable for missed darshan slots, trains or flights caused by such events, and we recommend
        leaving generous buffers.
      </p>

      <h2 id="liability">9. Liability</h2>
      <p>
        To the extent permitted by law, our total liability for any claim relating to a booking is limited to the amount you paid
        for that booking. Nothing in these terms limits liability that cannot be limited under Indian law, including under the
        Consumer Protection Act, 2019.
      </p>

      <h2 id="accounts">10. Accounts, reviews and website use</h2>
      <ul>
        <li>Keep your login details confidential. You are responsible for activity under your account.</li>
        <li>
          Reviews must be genuine and about your own completed trip. We moderate reviews and may decline content that is abusive,
          irrelevant or unlawful.
        </li>
        <li>Do not misuse the website, attempt to gain unauthorised access, or scrape or overload it.</li>
        <li>Website content, text and images belong to us or our licensors and may not be copied for commercial use.</li>
      </ul>

      <h2 id="law">11. Governing law and disputes</h2>
      <p>
        These terms are governed by the laws of India. Subject to your rights as a consumer, courts at Tirupati, Andhra Pradesh will
        have jurisdiction. Please contact us first — most issues can be resolved quickly.
      </p>

      <h2 id="contact">12. Contact and grievances</h2>
      <p>
        Reach us through the <Link href="/contact">contact page</Link>. Under the Consumer Protection (E-Commerce) Rules, 2020 and the
        IT Rules, grievances may also be addressed to:
      </p>
      <GrievanceOfficer settings={settings} />
    </LegalPage>
  );
}
