import Link from "next/link";
import { DestinationCard } from "@/components/content/DestinationCard";
import { PackageCard } from "@/components/catalog/PackageCard";
import { JsonLd } from "@/components/JsonLd";
import { Alert, Breadcrumbs, ButtonLink, Container, EmptyState, PageHeader, SectionHeading, buttonClass } from "@/components/ui";
import { getDestinations, getPackages } from "@/lib/data/catalog";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { TTD_DISCLAIMER } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Temple Tours from Tirupati — Circuits & Day Trips",
  description:
    "Temple tours from Tirupati to Tiruchanur, Srikalahasti, Kanipakam and more. Per-vehicle packages with local drivers, planned around your pace and puja timings.",
  path: "/temple-tours",
});

const PLANNING = [
  ["Start early", "Temples in the region are often busiest late morning and on festival days. An early start leaves room for queues and a relaxed lunch."],
  ["Check temple timings", "Opening hours, special pujas and closures are set by each temple administration and can change on festivals and eclipses. Confirm locally before you travel."],
  ["Dress for the temple", "Traditional, modest clothing is expected at most shrines. Footwear is left outside — carry socks for hot stone floors at midday."],
  ["Plan for elders", "Tell us about senior travellers or anyone with limited mobility. We can choose a roomier vehicle and plan shorter walking stretches."],
] as const;

export default async function TempleToursPage() {
  const [destinations, packages] = await Promise.all([getDestinations(), getPackages()]);
  const temples = destinations.filter((d) => d.category === "temple");
  const tours = packages.filter((p) => p.category === "temple_circuit" || p.category === "multi_day");

  return (
    <>
      <PageHeader
        title="Temple tours from Tirupati"
        intro="Beyond Tirumala, the Chittoor region is home to some of South India's most revered shrines. We provide the vehicle, the driver and a realistic plan so you can visit them comfortably in a day or over a few days."
      >
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Temple tours" }]} />
      </PageHeader>

      <section aria-labelledby="tours-heading" className="py-14">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div id="tours-heading">
              <SectionHeading
                eyebrow="Packages"
                title="Temple circuits and pilgrimages"
                intro="Fixed per-vehicle prices for a planned route. Entry, puja and darshan tickets are not included."
              />
            </div>
            <ButtonLink href="/packages?category=temple_circuit" variant="outline" className="mb-8">All temple packages</ButtonLink>
          </div>
          {tours.length ? (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tours.map((p) => (
                <li key={p.id} className="relative flex">
                  <PackageCard pkg={p} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Temple packages are being updated" action={<Link href="/custom-itinerary" className={buttonClass("gold")}>Plan a custom temple tour</Link>}>
              Tell us which temples you would like to visit and we will plan the route and send a quote.
            </EmptyState>
          )}
        </Container>
      </section>

      <section aria-labelledby="temples-heading" className="bg-ivory-dark/60 py-14">
        <Container>
          <div id="temples-heading">
            <SectionHeading eyebrow="Destinations" title="Temples we travel to" intro="Read about each temple, how far it is from Tirupati and the best time to go." />
          </div>
          {temples.length ? (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {temples.map((d) => (
                <li key={d.id} className="flex">
                  <DestinationCard destination={d} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Temple guides are coming soon" action={<Link href="/destinations" className={buttonClass("outline")}>Browse all destinations</Link>}>
              We are adding detailed guides for temples around Tirupati.
            </EmptyState>
          )}
        </Container>
      </section>

      <section aria-labelledby="planning-heading" className="py-14">
        <Container>
          <div id="planning-heading">
            <SectionHeading eyebrow="Before you go" title="Planning a temple day" />
          </div>
          <ul className="grid gap-5 sm:grid-cols-2">
            {PLANNING.map(([title, text]) => (
              <li key={title} className="rounded-2xl border border-line bg-white p-5">
                <h3 className="font-semibold">
                  <span aria-hidden className="mr-2 text-gold-500">✦</span>
                  {title}
                </h3>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <Alert tone="warning" title="Temple tickets are booked separately">
              {TTD_DISCLAIMER} The same applies to other temples: entry, puja and darshan tickets are issued only by the respective
              temple administration.
            </Alert>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/custom-itinerary" variant="gold" size="lg">Plan a custom temple tour</ButtonLink>
            <ButtonLink href="/cab-booking" variant="outline" size="lg">Book a cab</ButtonLink>
          </div>
        </Container>
      </section>

      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Temple tours", path: "/temple-tours" }])} />
    </>
  );
}
