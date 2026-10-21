import Link from "next/link";
import { FaqList } from "@/components/content/FaqList";
import { CabRouteList } from "@/components/content/CabRouteList";
import { PackageCard } from "@/components/catalog/PackageCard";
import { JsonLd } from "@/components/JsonLd";
import { Alert, Breadcrumbs, ButtonLink, Container, EmptyState, PageHeader, SectionHeading, buttonClass } from "@/components/ui";
import { getCabRoutes, getFaqs, getPackages } from "@/lib/data/catalog";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { TTD_DISCLAIMER } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Tirupati to Tirumala by Road — Travel Guide",
  description:
    "Plan your road journey from Tirupati, the railway station or airport to Tirumala: ghat roads, Alipiri checks, timing tips and what to book with TTD versus us.",
  path: "/tirumala-tirupati",
});

const TIRUMALA_ROUTE_RE = /tirumala/i;

const STARTS = [
  {
    title: "From Tirupati city",
    text: "Most hotels are a short drive from Alipiri, the foot of the hills where the ghat road begins. Allow extra time on weekends, festival days and early mornings when traffic builds at the checkpoint.",
  },
  {
    title: "From Tirupati railway station",
    text: "The main station is in the heart of the city. Your driver can meet you outside the station with a name board so you do not have to negotiate on arrival with luggage and elders.",
  },
  {
    title: "From Tirupati Airport (Renigunta)",
    text: "The airport is on the Renigunta side, so the drive to Tirumala first crosses Tirupati before climbing the ghat. It is a longer transfer — plan for it if you have a darshan slot.",
  },
] as const;

const TIPS = [
  ["Keep your darshan slot in mind", "If you hold a darshan or seva booking from TTD, plan to reach Tirumala well before the reporting time printed on it. Queues at the Alipiri checkpoint and parking on the hill can take longer than expected."],
  ["Expect a security check at Alipiri", "Vehicles and baggage are screened before the ghat road. Items not permitted on the hill are decided by TTD and security agencies — check the official TTD website before you pack."],
  ["The ghat road has many curves", "Travellers prone to motion sickness should eat lightly, sit facing forward and carry water. Our drivers keep a steady pace and will stop at safe places when needed."],
  ["Dress and conduct", "TTD prescribes traditional dress for darshan and has rules on conduct, photography and mobile phones in certain areas. Please follow the latest guidance from TTD."],
  ["Allow buffer time for the return", "Darshan durations vary a lot. Avoid tight train or flight connections on the same day, or tell us your departure time so we can plan the drop."],
  ["Walking up instead?", "Many devotees climb the traditional footpaths. We can drop you at the start of the path and pick up your family or luggage separately — ask us when you book."],
] as const;

export default async function TirumalaTirupatiPage() {
  const [packages, routes, faqs] = await Promise.all([getPackages(), getCabRoutes(), getFaqs("tirumala")]);
  const tirumalaPackages = packages.filter((p) => p.category === "tirumala");
  const tirumalaRoutes = routes.filter((r) => TIRUMALA_ROUTE_RE.test(r.origin) || TIRUMALA_ROUTE_RE.test(r.destination));

  return (
    <>
      <PageHeader
        title="Tirupati to Tirumala: a road travel guide"
        intro="How to get from Tirupati, the railway station or the airport up to Tirumala by road — and how to split your planning between transport (which we provide) and darshan, seva and rooms (which only TTD provides)."
      >
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Tirumala & Tirupati" }]} />
      </PageHeader>

      <Container className="py-10">
        <Alert tone="warning" title="Important: we are not TTD">
          {TTD_DISCLAIMER}
        </Alert>
      </Container>

      <section aria-labelledby="split-heading" className="pb-14">
        <Container>
          <h2 id="split-heading" className="mb-6 text-2xl font-semibold sm:text-3xl">Who arranges what</h2>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-forest-100 bg-forest-50 p-6">
              <h3 className="text-lg font-semibold">Yatra Travel provides</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {[
                  "AC vehicles sized for your group — sedans, SUVs, tempo travellers and more",
                  "Drivers familiar with the Tirumala ghat roads and Tirupati city",
                  "Pickup from your hotel, Tirupati railway station or the airport",
                  "Hill transfers, waiting time and return drops as per your booking",
                  "Temple tours and sightseeing around Tirupati after your visit",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span aria-hidden className="text-forest-500">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-gold-200 bg-gold-50 p-6">
              <h3 className="text-lg font-semibold">Only TTD provides</h3>
              <ul className="mt-3 space-y-2 text-sm text-gold-700">
                {[
                  "Darshan tickets and time slots",
                  "Seva bookings",
                  "Accommodation on Tirumala hill",
                  "Rules on vehicles, timings, dress code and what may be carried",
                  "Any changes or cancellations to the above",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <span aria-hidden>•</span>
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-gold-700">
                Book these only through the <strong>official TTD website or TTD counters</strong>. Be cautious of anyone offering
                &ldquo;guaranteed&rdquo; darshan.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="getting-heading" className="bg-ivory-dark/60 py-14">
        <Container>
          <div id="getting-heading">
            <SectionHeading
              eyebrow="Getting there"
              title="The road up the Seshachalam hills"
              intro="Vehicles reach Tirumala by the ghat roads that begin at Alipiri in Tirupati. Traffic on the ghat is regulated — typically one road is used for the climb and another for the descent — and timings, speed limits and vehicle rules are set by TTD and the police. They can change, so treat any timing you read online (including here) as a guide only."
            />
          </div>
          <ul className="grid gap-5 md:grid-cols-3">
            {STARTS.map((s) => (
              <li key={s.title} className="rounded-2xl border border-line bg-white p-6">
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="tips-heading" className="py-14">
        <Container>
          <div id="tips-heading">
            <SectionHeading eyebrow="Planning tips" title="Practical tips for a smoother visit" />
          </div>
          <dl className="grid gap-5 sm:grid-cols-2">
            {TIPS.map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-line bg-white p-5">
                <dt className="font-semibold text-forest-900">
                  <span aria-hidden className="mr-2 text-gold-500">✦</span>
                  {title}
                </dt>
                <dd className="mt-1 text-sm text-muted">{text}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <section aria-labelledby="routes-heading" className="bg-ivory-dark/60 py-14">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div id="routes-heading">
              <SectionHeading
                eyebrow="Cab routes"
                title="Tirumala transfers"
                intro="Distances and durations are approximate and depend on traffic, checkpoint queues and ghat road conditions."
              />
            </div>
            <ButtonLink href="/cab-booking" variant="outline" className="mb-8">All cab routes</ButtonLink>
          </div>
          {tirumalaRoutes.length ? (
            <CabRouteList routes={tirumalaRoutes} />
          ) : (
            <EmptyState title="Routes are being updated" action={<Link href="/contact" className={buttonClass("gold")}>Ask us for a fare</Link>}>
              Fixed Tirumala routes will appear here shortly. You can still contact us for a transfer.
            </EmptyState>
          )}
        </Container>
      </section>

      <section aria-labelledby="pkg-heading" className="py-14">
        <Container>
          <div id="pkg-heading">
            <SectionHeading
              eyebrow="Packages"
              title="Tirumala packages"
              intro="Fixed per-vehicle prices covering transport only. Darshan tickets are booked separately with TTD."
            />
          </div>
          {tirumalaPackages.length ? (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {tirumalaPackages.map((p) => (
                <li key={p.id} className="relative flex">
                  <PackageCard pkg={p} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Packages are being updated" action={<Link href="/custom-itinerary" className={buttonClass("gold")}>Plan a custom trip</Link>}>
              Tell us your dates and group size and we will plan the transport for your Tirumala visit.
            </EmptyState>
          )}
        </Container>
      </section>

      {faqs.length > 0 && (
        <section aria-labelledby="faq-heading" className="pb-14">
          <Container className="max-w-3xl">
            <h2 id="faq-heading" className="mb-6 text-2xl font-semibold">Tirumala travel questions</h2>
            <p className="-mt-4 mb-4 text-sm"><Link href="/faqs" className="underline">See all FAQs</Link></p>
            <FaqList faqs={faqs} />
          </Container>
        </section>
      )}

      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Tirumala & Tirupati", path: "/tirumala-tirupati" },
        ])}
      />
    </>
  );
}
