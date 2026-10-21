import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Alert, Breadcrumbs, ButtonLink, Container, PageHeader, SectionHeading } from "@/components/ui";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { TTD_DISCLAIMER } from "@/lib/site";

export const metadata = pageMetadata({
  title: "About Us — Tirupati Travel Operator",
  description:
    "Yatra Travel is a Tirupati-based transport and tour operator for Tirumala transfers, temple tours and sightseeing. Learn how we plan, price and care for every trip.",
  path: "/about",
});

const VALUES = [
  {
    title: "Pilgrims first",
    text: "Many of our travellers are families with elders, first-time visitors or devotees on a vow. We plan around early starts, rest stops, footwear and luggage counters, and the pace your group is comfortable with.",
  },
  {
    title: "Clear prices, before you pay",
    text: "Packages are priced per vehicle and cabs per kilometre. Tolls, parking, permits and driver allowance are shown as separate lines so you know exactly what you are paying for.",
  },
  {
    title: "Honest about what we do",
    text: "We arrange vehicles, drivers and travel plans. We do not sell darshan, seva or accommodation tickets, and we will never promise a darshan time — those belong to TTD alone.",
  },
  {
    title: "Respect for the hills",
    text: "The Tirumala ghat roads, Seshachalam forests and temple towns are sacred and fragile. Our drivers follow the rules set by TTD and the police, keep vehicles clean and avoid plastic waste.",
  },
];

const HOW = [
  ["Tell us your plan", "Choose a package, book a cab online, or send us a custom itinerary request with your dates and places."],
  ["See the full fare", "Before payment you see the vehicle, the route and every line of the fare. Pay securely through our payment gateway."],
  ["Travel with a local driver", "Your driver meets you at the station, airport or hotel and stays with the plan — with sensible flexibility for queues and weather."],
  ["Get help when you need it", "Reach us from your account, the contact form or WhatsApp (when enabled) for changes, cancellations or questions."],
] as const;

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="About Yatra Travel"
        intro="A Tirupati-based travel operator helping pilgrims and travellers move comfortably between Tirupati, Tirumala and the temples and hills of the Chittoor region."
      >
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "About us" }]} />
      </PageHeader>

      <section className="py-14">
        <Container className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          <div className="prose-yatra">
            <h2>Rooted in the temple town</h2>
            <p>
              Tirupati is where most journeys to Tirumala begin — from the railway station, the bus stands, or the airport at
              Renigunta. From here the road climbs through the Seshachalam hills to the shrine of Sri Venkateswara Swamy, and fans out
              to Tiruchanur, Srikalahasti, Kanipakam and beyond. Yatra Travel exists to make that movement simple: the right vehicle,
              a driver who knows the routes, and a plan that leaves you free to focus on your visit.
            </p>
            <p>
              Our tagline — <strong>Your Journey, Our Devotion</strong> — is a promise about how we work. We cannot make the queues
              shorter or the hills less steep, but we can make sure your transport is on time, your fare is clear and your questions
              are answered honestly.
            </p>
            <h2>What we offer</h2>
            <ul>
              <li>
                <Link href="/tirumala-tirupati">Tirupati–Tirumala transfers</Link> from the city, railway station and airport.
              </li>
              <li>
                <Link href="/temple-tours">Temple tours</Link> covering shrines in and around Tirupati and the wider region.
              </li>
              <li>
                <Link href="/cab-booking">Local and outstation cabs</Link> with transparent per-kilometre fares.
              </li>
              <li>
                <Link href="/packages">Fixed-price packages</Link> and <Link href="/custom-itinerary">custom itineraries</Link> for
                families and groups.
              </li>
            </ul>
          </div>
          <aside className="rounded-3xl border border-gold-200 bg-gold-50 p-6">
            <h2 className="text-xl font-semibold">Travel services, not temple tickets</h2>
            <p className="mt-2 text-sm text-gold-700">{TTD_DISCLAIMER}</p>
            <p className="mt-3 text-sm text-gold-700">
              Darshan, seva and accommodation bookings are made only on the official TTD website or at TTD counters.
            </p>
          </aside>
        </Container>
      </section>

      <section className="bg-ivory-dark/60 py-14" aria-labelledby="values-heading">
        <Container>
          <div id="values-heading">
            <SectionHeading eyebrow="Our approach" title="What guides every trip" align="center" />
          </div>
          <ul className="grid gap-5 sm:grid-cols-2">
            {VALUES.map((v) => (
              <li key={v.title} className="rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-card)]">
                <h3 className="text-lg font-semibold">
                  <span aria-hidden className="mr-2 text-gold-500">✦</span>
                  {v.title}
                </h3>
                <p className="mt-2 text-sm text-muted">{v.text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-14" aria-labelledby="how-heading">
        <Container>
          <div id="how-heading">
            <SectionHeading eyebrow="How it works" title="From enquiry to drop-off" />
          </div>
          <ol className="grid gap-5 md:grid-cols-4">
            {HOW.map(([title, text], i) => (
              <li key={title} className="rounded-2xl border border-line bg-white p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-400 text-sm font-bold text-forest-900" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Alert tone="info" title="Rules on the hill change from time to time">
              Vehicle checks, ghat road timings, dress codes and queue arrangements at Tirumala are decided by TTD and local
              authorities and may change without notice. We keep our plans flexible and will tell you if something affects your trip.
            </Alert>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/packages" variant="gold" size="lg">Explore packages</ButtonLink>
            <ButtonLink href="/contact" variant="outline" size="lg">Contact us</ButtonLink>
          </div>
        </Container>
      </section>

      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "About us", path: "/about" }])} />
    </>
  );
}
