import Link from "next/link";
import { LegalPage } from "@/components/content/LegalPage";
import { CookieSettingsButton } from "@/components/layout/CookieConsent";
import { getSiteSettings } from "@/lib/data/catalog";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Cookie Policy",
  description:
    "Which cookies the Yatra Travel website uses: essential sign-in and security cookies, and optional analytics cookies that are set only with your consent.",
  path: "/cookie-policy",
});

const CONTENTS = [
  { id: "what", label: "What cookies are" },
  { id: "essential", label: "Essential cookies" },
  { id: "analytics", label: "Analytics cookies" },
  { id: "choices", label: "Your choices" },
];

export default async function CookiePolicyPage() {
  const settings = await getSiteSettings();

  return (
    <LegalPage
      title="Cookie policy"
      intro="How this website uses cookies and similar storage, and how you can control them."
      path="/cookie-policy"
      settings={settings}
      contents={CONTENTS}
    >
      <h2 id="what">1. What cookies are</h2>
      <p>
        Cookies are small text files stored by your browser. Similar technologies, such as local storage, work in the same way. We
        use them only where needed, and we ask for your consent before setting anything that is not essential.
      </p>

      <h2 id="essential">2. Essential cookies (always on)</h2>
      <p>These are needed for the website to work and cannot be switched off:</p>
      <ul>
        <li>
          <strong>Authentication cookies</strong> — keep you signed in securely to your account and protect booking and payment
          pages. They are set by our authentication provider (Supabase) and expire when you sign out or after a period of inactivity.
        </li>
        <li>
          <strong>Consent preference</strong> — your cookie choice and a random anonymous identifier are kept in your
          browser&apos;s local storage so we do not ask on every page and can keep a record of the choice you made.
        </li>
      </ul>
      <p>
        The payment window is provided by Razorpay, which may set its own essential cookies for fraud prevention while you pay. Those
        are governed by Razorpay&apos;s policies.
      </p>

      <h2 id="analytics">3. Analytics cookies (optional)</h2>
      <p>
        If you allow it, we use analytics (Google Analytics) to understand which pages are useful and how visitors find us — for
        example, pages viewed, approximate location at city level and device type. These cookies are <strong>not set unless you
        consent</strong>, and we do not use them for advertising.
      </p>

      <h2 id="choices">4. Your choices</h2>
      <p>
        You can accept or reject optional cookies in the banner shown on your first visit, and change your mind at any time:
      </p>
      <p>
        <CookieSettingsButton />
      </p>
      <p>
        You can also delete or block cookies in your browser settings; blocking essential cookies will prevent sign-in and booking.
        Your choice is recorded as described in our <Link href="/privacy-policy">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}
