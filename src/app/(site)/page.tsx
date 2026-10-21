import Image from "next/image";
import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { PackageCard } from "@/components/catalog/PackageCard";
import { JsonLd } from "@/components/JsonLd";
import { WhatsAppIcon } from "@/components/layout/WhatsAppButton";
import { ButtonLink, Container, SectionHeading, buttonClass } from "@/components/ui";
import { getDestinations, getFaqs, getPackages, getSiteSettings, getTestimonials } from "@/lib/data/catalog";
import { organizationJsonLd, pageMetadata } from "@/lib/seo";
import { DEFAULT_DESCRIPTION, TTD_DISCLAIMER, whatsappLink } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Yatra Travel — Tirupati Temple Tours, Tirumala Cabs & Pilgrimage Packages",
  description: DEFAULT_DESCRIPTION,
  path: "/",
  image: "/brand/og-default.png",
});

const SERVICES = [
  {
    title: "Tirumala hill transfers",
    text: "Tirupati to Tirumala and back with drivers who know the ghat roads, vehicle checks and timings.",
    href: "/tirumala-tirupati",
    icon: "⛰️",
  },
  {
    title: "Temple tours",
    text: "Tiruchanur, Srikalahasti, Kanipakam and more — planned around your pace and puja timings.",
    href: "/temple-tours",
    icon: "🛕",
  },
  {
    title: "Local & outstation cabs",
    text: "Airport and railway station pickups, one-way drops and round trips with transparent per-km fares.",
    href: "/cab-booking",
    icon: "🚗",
  },
  {
    title: "Custom itineraries",
    text: "Tell us your dates, group size and places — we will plan a trip and send you a quote.",
    href: "/custom-itinerary",
    icon: "🗺️",
  },
];

export default async function HomePage() {
  const [packages, destinations, faqs, testimonials, settings] = await Promise.all([
    getPackages(),
    getDestinations(),
    getFaqs(),
    getTestimonials(6),
    getSiteSettings(),
  ]);
  const featured = packages.filter((p) => p.is_featured).slice(0, 3);
  const wa = settings.whatsapp.enabled ? whatsappLink(settings.whatsapp.number, settings.whatsapp.default_message) : null;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-forest-900 text-white">
        <Image src="/images/placeholders/temple-hills.svg" alt="" fill priority className="object-cover opacity-25" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-r from-forest-900 via-forest-900/90 to-forest-900/40" aria-hidden />
        <Container className="relative py-16 sm:py-24">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-forest-800/60 px-3 py-1 text-xs font-semibold tracking-widest text-gold-200 uppercase">
              <LogoMark className="h-5 w-5" /> Tirupati · Tirumala · Temple Circuits
            </p>
            <h1 className="text-4xl leading-tight font-semibold text-white sm:text-5xl">
              Your Journey, <span className="text-gold-300">Our Devotion.</span>
            </h1>
            <p className="mt-4 text-lg text-forest-100">
              Comfortable, punctual transport for Tirumala visits, temple tours and sightseeing around Tirupati — with clear per-vehicle prices and local drivers who know the way.
            </p>

            <form action="/packages" role="search" aria-label="Find a trip" className="mt-8 flex flex-col gap-2 rounded-2xl bg-white p-2 shadow-xl sm:flex-row">
              <label htmlFor="hero-destination" className="sr-only">Where would you like to go?</label>
              <select id="hero-destination" name="destination" className="flex-1 rounded-xl px-3 py-3 text-charcoal">
                <option value="">All destinations</option>
                {destinations.map((d) => (
                  <option key={d.slug} value={d.slug}>{d.name}</option>
                ))}
              </select>
              <button type="submit" className={buttonClass("gold", "lg")}>Find trips</button>
            </form>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href="/cab-booking" className="rounded-full border border-white/30 px-4 py-2 hover:bg-white/10">Book a cab</Link>
              <Link href="/custom-itinerary" className="rounded-full border border-white/30 px-4 py-2 hover:bg-white/10">Plan a custom trip</Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Services */}
      <section className="py-16" aria-labelledby="services-heading">
        <Container>
          <div id="services-heading">
            <SectionHeading eyebrow="What we do" title="Travel services in and around Tirupati" align="center" />
          </div>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="block h-full rounded-2xl border border-line bg-white p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-gold-300">
                  <span aria-hidden className="text-3xl">{s.icon}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted">{s.text}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Popular packages */}
      <section className="bg-ivory-dark/60 py-16" aria-labelledby="packages-heading">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div id="packages-heading">
              <SectionHeading eyebrow="Popular" title="Pilgrimage & sightseeing packages" intro="Fixed per-vehicle prices. Darshan tickets are booked separately through official TTD channels." />
            </div>
            <ButtonLink href="/packages" variant="outline" className="mb-8">View all packages</ButtonLink>
          </div>
          {featured.length ? (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => (
                <li key={p.id} className="relative flex"><PackageCard pkg={p} /></li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Packages will appear here soon. <Link href="/custom-itinerary" className="underline">Ask us for a custom trip.</Link></p>
          )}
        </Container>
      </section>

      {/* Why us */}
      <section className="py-16">
        <Container className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading eyebrow="Why Yatra Travel" title="Rooted in Tirupati, focused on your comfort" />
            <ul className="space-y-4">
              {[
                ["Transparent pricing", "Per-vehicle package prices and per-km cab fares, with a full breakdown before you pay. No hidden charges."],
                ["Local, experienced drivers", "Drivers familiar with Tirumala ghat roads, temple routes and the needs of senior pilgrims."],
                ["Secure online payment", "Pay by UPI, card or net banking through a PCI-DSS compliant gateway. We never see your card details."],
                ["Easy changes and cancellations", "Manage bookings from your account; refunds follow our published cancellation policy."],
              ].map(([title, text]) => (
                <li key={title} className="flex gap-3">
                  <span aria-hidden className="mt-1 text-gold-500">✦</span>
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-gold-200 bg-gold-50 p-6 text-sm text-gold-700">
            <h3 className="text-lg font-semibold text-forest-900">Please note</h3>
            <p className="mt-2">{TTD_DISCLAIMER}</p>
          </div>
        </Container>
      </section>

      {/* Testimonials — only genuine, moderated reviews from completed bookings */}
      {testimonials.length > 0 && (
        <section className="bg-forest-900 py-16 text-forest-100" aria-labelledby="reviews-heading">
          <Container>
            <h2 id="reviews-heading" className="mb-2 text-center text-3xl font-semibold text-white">What our travellers say</h2>
            <p className="mb-8 text-center text-sm text-forest-300">Reviews from customers with completed bookings.</p>
            <ul className="grid gap-5 md:grid-cols-3">
              {testimonials.map((t) => (
                <li key={t.id}>
                  <figure className="h-full rounded-2xl bg-forest-800 p-6">
                    <p aria-label={`${t.rating} out of 5 stars`} className="text-gold-300">{"★".repeat(t.rating)}<span className="text-forest-700">{"★".repeat(5 - t.rating)}</span></p>
                    {t.title && <p className="mt-2 font-semibold text-white">{t.title}</p>}
                    <blockquote className="mt-2 text-sm">“{t.body}”</blockquote>
                    <figcaption className="mt-4 text-xs text-gold-200">— {t.display_name}</figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {/* FAQs */}
      {faqs.length > 0 && (
        <section className="py-16" aria-labelledby="faq-heading">
          <Container className="max-w-3xl">
            <div id="faq-heading">
              <SectionHeading eyebrow="FAQs" title="Common questions" align="center" />
            </div>
            <div className="divide-y divide-line rounded-2xl border border-line bg-white">
              {faqs.slice(0, 5).map((f) => (
                <details key={f.id} className="group p-5">
                  <summary className="cursor-pointer list-none font-semibold text-forest-900 marker:hidden">
                    <span className="flex items-center justify-between gap-4">
                      {f.question}
                      <span aria-hidden className="text-gold-500 transition group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-muted">{f.answer}</p>
                </details>
              ))}
            </div>
            <p className="mt-4 text-center"><Link href="/faqs" className="text-sm font-semibold text-forest-800 underline">See all FAQs</Link></p>
          </Container>
        </section>
      )}

      {/* CTA */}
      <section className="pb-4">
        <Container>
          <div className="flex flex-col items-start gap-5 rounded-3xl bg-gradient-to-r from-gold-300 to-gold-400 p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Planning a visit to Tirupati?</h2>
              <p className="mt-1 text-forest-900/80">Tell us your dates and group size — we will help you plan the journey.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {wa && (
                <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", "lg")}>
                  <WhatsAppIcon className="h-5 w-5" /> WhatsApp us
                </a>
              )}
              <ButtonLink href="/contact" variant="outline" size="lg" className="bg-white/60">Contact us</ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <JsonLd data={organizationJsonLd(settings)} />
    </>
  );
}
