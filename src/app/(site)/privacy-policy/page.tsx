import Link from "next/link";
import { GrievanceOfficer, LegalPage } from "@/components/content/LegalPage";
import { getSiteSettings } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How Yatra Travel collects, uses, stores and protects your personal data under India's Digital Personal Data Protection Act, 2023, and how to exercise your rights.",
  path: "/privacy-policy",
});

const CONTENTS = [
  { id: "who-we-are", label: "Who we are" },
  { id: "data-we-collect", label: "Data we collect" },
  { id: "purposes", label: "Why we use it" },
  { id: "consent", label: "Consent and legal basis" },
  { id: "sharing", label: "Who we share it with" },
  { id: "retention", label: "How long we keep it" },
  { id: "security", label: "Security" },
  { id: "rights", label: "Your rights" },
  { id: "children", label: "Children" },
  { id: "cookies", label: "Cookies" },
  { id: "changes", label: "Changes" },
  { id: "grievance", label: "Grievance Officer" },
];

export default async function PrivacyPolicyPage() {
  const settings = await getSiteSettings();
  const business = settings.brand.legal_name || settings.brand.name;

  return (
    <LegalPage
      title="Privacy policy"
      intro="How we collect, use and protect your personal data when you browse, book or contact us."
      path="/privacy-policy"
      settings={settings}
      contents={CONTENTS}
    >
      <h2 id="who-we-are">1. Who we are</h2>
      <p>
        This website is operated by <strong>{business}</strong> (&ldquo;Yatra Travel&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), a
        private transport and tour operator based in Tirupati, Andhra Pradesh, India. For the purposes of the{" "}
        <strong>Digital Personal Data Protection Act, 2023</strong> (&ldquo;DPDP Act&rdquo;), we are the <em>Data Fiduciary</em> for the
        personal data described in this policy. We also follow the Information Technology Act, 2000 and the rules made under it,
        including the IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, to the
        extent they apply.
      </p>
      <p>We are not affiliated with Tirumala Tirupati Devasthanams (TTD) and do not receive or process TTD booking data.</p>

      <h2 id="data-we-collect">2. Data we collect</h2>
      <h3>Information you give us</h3>
      <ul>
        <li>
          <strong>Account data:</strong> name, email address, mobile number, password (stored only as a secure hash by our
          authentication provider) and your communication preferences.
        </li>
        <li>
          <strong>Booking data:</strong> trip date and time, pickup and drop locations, number of passengers and bags, vehicle
          choice, special requests, and the contact name, phone and email for the trip.
        </li>
        <li>
          <strong>Enquiries:</strong> what you send through the contact, support or custom itinerary forms, and any later messages
          in that conversation.
        </li>
        <li>
          <strong>Reviews:</strong> the display name, rating and text you choose to publish after a completed trip.
        </li>
      </ul>
      <h3>Information created when you use our services</h3>
      <ul>
        <li>
          <strong>Payment status:</strong> payments are processed by our payment gateway, Razorpay. We receive the order and
          payment identifiers, amount, method type and status. <strong>We never receive or store your full card number, CVV, UPI
          PIN or net-banking password.</strong>
        </li>
        <li>
          <strong>Consent records:</strong> when you accept terms, give cookie preferences or opt in to WhatsApp or marketing
          messages, we record what you agreed to, the policy version and the time, along with a <em>salted hash</em> of your IP
          address (not the raw IP) so the record can be verified.
        </li>
        <li>
          <strong>Security and operational logs:</strong> sign-in events, rate-limiting counters based on hashed IP addresses, and
          records of notifications sent to you.
        </li>
        <li>
          <strong>Analytics (optional):</strong> only if you allow analytics cookies, aggregated usage information such as pages
          visited and device type.
        </li>
      </ul>
      <p>We do not intentionally collect sensitive information such as health, religious belief or financial account details.</p>

      <h2 id="purposes">3. Why we use your data</h2>
      <ul>
        <li>To create and manage your account and authenticate you securely.</li>
        <li>To quote, confirm, operate, change or cancel your trip, and to assign a vehicle and driver.</li>
        <li>To process payments and refunds through the payment gateway and keep accounting and tax records.</li>
        <li>To respond to enquiries, support requests and grievances.</li>
        <li>To send transactional messages about your booking by email, and by WhatsApp only if you have opted in.</li>
        <li>To prevent fraud, spam and abuse, and to keep the website secure.</li>
        <li>To comply with legal obligations and lawful requests from authorities.</li>
        <li>With your separate consent only: to send offers and updates, and to measure website usage with analytics.</li>
      </ul>

      <h2 id="consent">4. Consent and legal basis</h2>
      <p>
        We process personal data on the basis of your <strong>consent</strong>, given through a clear notice at the point of
        collection, or for <strong>legitimate uses</strong> permitted under the DPDP Act — for example, when you voluntarily provide
        data to make a booking, or where we must comply with law. You may withdraw consent at any time; this does not affect
        processing already carried out, and we may be unable to continue a service that depends on it.
      </p>
      <p>
        <strong>WhatsApp messages</strong> are sent only if you opt in, and you can turn them off from your account at any time.
        Marketing messages are always optional and separate from booking updates.
      </p>

      <h2 id="sharing">5. Who we share it with</h2>
      <p>We do not sell your personal data. We share only what is necessary with:</p>
      <ul>
        <li>
          <strong>Drivers and vehicle partners</strong> assigned to your trip — name, phone number, pickup details and trip plan.
        </li>
        <li>
          <strong>Data Processors</strong> acting on our instructions: hosting and database providers, the payment gateway
          (Razorpay), email delivery and, if you opt in, the WhatsApp Business messaging provider, and analytics if you allow it.
        </li>
        <li>
          <strong>Authorities</strong> where required by law, court order or to protect the safety of travellers.
        </li>
      </ul>
      <p>
        Some processors may store data on servers outside India. Where that happens, we transfer data only as permitted under the
        DPDP Act and any restrictions notified by the Government of India.
      </p>

      <h2 id="retention">6. How long we keep it</h2>
      <ul>
        <li>Account data: while your account is active, and deleted or anonymised after you request erasure, unless we must keep it.</li>
        <li>Booking, payment and invoice records: for the period required by tax and accounting laws.</li>
        <li>Support and itinerary requests: for as long as needed to resolve them and handle follow-ups, then deleted or anonymised.</li>
        <li>Consent records: for as long as needed to demonstrate the consent you gave or withdrew.</li>
        <li>Security logs and rate-limit counters: for short periods needed for security.</li>
      </ul>
      <p>The exact periods should be confirmed with your legal and tax advisers before launch.</p>

      <h2 id="security">7. Security</h2>
      <p>
        We use reasonable security safeguards, including encrypted connections (HTTPS), access controls so that staff see only what
        their role needs, hashed passwords and IP addresses, and audit logs for administrative actions. No system is perfectly
        secure; if a personal data breach occurs, we will notify affected users and the Data Protection Board of India as required
        under the DPDP Act.
      </p>

      <h2 id="rights">8. Your rights</h2>
      <p>Under the DPDP Act you have the right to:</p>
      <ul>
        <li><strong>Access</strong> a summary of the personal data we process about you and the processing activities.</li>
        <li><strong>Correction and completion</strong> of inaccurate or incomplete data, and to update it.</li>
        <li><strong>Erasure</strong> of data that is no longer needed, unless we must keep it by law.</li>
        <li><strong>Withdraw consent</strong> at any time, as easily as you gave it.</li>
        <li><strong>Nominate</strong> another person to exercise your rights in the event of your death or incapacity.</li>
        <li><strong>Grievance redressal</strong> through our Grievance Officer, and thereafter to approach the Data Protection Board of India.</li>
      </ul>
      <p>
        If you have an account, you can make these requests from <Link href="/account/privacy">My account → Privacy</Link> after
        signing in. Otherwise, use our <Link href="/contact">support form</Link> and choose the &ldquo;Privacy / personal data&rdquo;
        topic. We may need to verify your identity before acting on a request.
      </p>

      <h2 id="children">9. Children</h2>
      <p>
        Our services are intended for adults. Bookings must be made by a person aged 18 or over. We do not knowingly process
        children&apos;s personal data except, where needed, basic traveller details provided by a parent or guardian for a family trip.
      </p>

      <h2 id="cookies">10. Cookies</h2>
      <p>
        We use essential cookies to keep you signed in and secure. Analytics cookies are used only with your consent. See our{" "}
        <Link href="/cookie-policy">cookie policy</Link> for details and to change your choice.
      </p>

      <h2 id="changes">11. Changes to this policy</h2>
      <p>
        We may update this policy when our services or the law change. The &ldquo;Last updated&rdquo; date above shows the current
        version. Where changes are significant, we will notify account holders and, where required, ask for fresh consent.
      </p>

      <h2 id="grievance">12. Grievance Officer</h2>
      <p>For questions, requests or complaints about your personal data, contact our Grievance Officer:</p>
      <GrievanceOfficer settings={settings} />
    </LegalPage>
  );
}
