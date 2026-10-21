import Link from "next/link";
import { ContactForm } from "@/components/content/ContactForm";
import { JsonLd } from "@/components/JsonLd";
import { WhatsAppIcon } from "@/components/layout/WhatsAppButton";
import { Breadcrumbs, Card, Container, PageHeader, buttonClass } from "@/components/ui";
import { getSiteSettings } from "@/lib/data/catalog";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { whatsappLink } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Contact & Support",
  description:
    "Contact Yatra Travel in Tirupati for bookings, cab enquiries, changes, cancellations or refunds. Send a support request and get a reference number for follow-up.",
  path: "/contact",
});

function safeExternalUrl(url: string): string | null {
  return /^https:\/\/[^\s]+$/i.test(url.trim()) ? url.trim() : null;
}

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const { contact } = settings;
  const wa = settings.whatsapp.enabled ? whatsappLink(settings.whatsapp.number, settings.whatsapp.default_message) : null;
  const mapUrl = contact.map_url ? safeExternalUrl(contact.map_url) : null;
  const telHref = contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, "")}` : null;
  const hasDirectContact = Boolean(contact.phone || contact.email || wa);

  return (
    <>
      <PageHeader
        title="Contact & support"
        intro="Questions about a trip, help with an existing booking, or a cancellation or refund — send us a message and you will receive a reference number for follow-up."
      >
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Contact & support" }]} />
      </PageHeader>

      <Container className="grid gap-10 py-10 lg:grid-cols-[1fr_1.4fr]">
        <aside className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold">Reach us</h2>
            <dl className="mt-4 space-y-4 text-sm">
              {contact.phone && telHref && (
                <div>
                  <dt className="text-muted">Phone</dt>
                  <dd>
                    <a href={telHref} className="font-semibold text-forest-800 underline">{contact.phone}</a>
                  </dd>
                </div>
              )}
              {contact.email && (
                <div>
                  <dt className="text-muted">Email</dt>
                  <dd>
                    <a href={`mailto:${contact.email}`} className="font-semibold break-all text-forest-800 underline">{contact.email}</a>
                  </dd>
                </div>
              )}
              {contact.address && (
                <div>
                  <dt className="text-muted">Address</dt>
                  <dd className="whitespace-pre-line">{contact.address}</dd>
                  {mapUrl && (
                    <dd className="mt-1">
                      <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest-800 underline">
                        View on Google Maps<span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </dd>
                  )}
                </div>
              )}
              {contact.hours && (
                <div>
                  <dt className="text-muted">Hours</dt>
                  <dd className="whitespace-pre-line">{contact.hours}</dd>
                </div>
              )}
            </dl>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "md", "mt-6 w-full")}>
                <WhatsAppIcon className="h-5 w-5" /> Chat on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            {!hasDirectContact && (
              <p className="mt-4 text-sm text-muted">The support form is the quickest way to reach us. We reply by email.</p>
            )}
          </Card>

          <div className="rounded-2xl border border-line bg-white p-6 text-sm">
            <h2 className="text-lg font-semibold">Have a booking?</h2>
            <p className="mt-2 text-muted">
              Signed-in customers can view bookings, cancel within the policy and track support requests from{" "}
              <Link href="/account" className="font-semibold text-forest-800 underline">My account</Link>. Read our{" "}
              <Link href="/cancellation-refund-policy" className="underline">cancellation &amp; refund policy</Link> and{" "}
              <Link href="/faqs" className="underline">FAQs</Link>.
            </p>
          </div>

          <div className="rounded-2xl border border-gold-200 bg-gold-50 p-6 text-sm text-gold-700">
            <h2 className="text-lg font-semibold text-forest-900">Darshan &amp; accommodation queries</h2>
            <p className="mt-2">
              We cannot book, change or check TTD darshan, seva or accommodation tickets. Please contact TTD through its official
              website or counters for these.
            </p>
          </div>
        </aside>

        <Card className="p-5 sm:p-8">
          <h2 className="text-2xl font-semibold">Send us a message</h2>
          <p className="mt-1 mb-6 text-sm text-muted">Fields marked * are required.</p>
          <ContactForm />
        </Card>
      </Container>

      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Contact & support", path: "/contact" }])} />
    </>
  );
}
