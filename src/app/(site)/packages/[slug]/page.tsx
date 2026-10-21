import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingForm } from "@/components/booking/BookingForm";
import { JsonLd } from "@/components/JsonLd";
import { Alert, Badge, Breadcrumbs, Card, Container } from "@/components/ui";
import { getPackage, getPackages, getSiteSettings, getVehicleRates } from "@/lib/data/catalog";
import { formatINR } from "@/lib/money";
import { breadcrumbJsonLd, pageMetadata, touristTripJsonLd } from "@/lib/seo";
import { TTD_DISCLAIMER } from "@/lib/site";
import { PACKAGE_CATEGORY_LABELS, VEHICLE_CLASS_LABELS } from "@/lib/types";

export async function generateStaticParams() {
  const packages = await getPackages();
  // Cache Components requires at least one entry; unknown slugs render notFound().
  return packages.length ? packages.map((p) => ({ slug: p.slug })) : [{ slug: "unavailable" }];
}

export async function generateMetadata(props: PageProps<"/packages/[slug]">) {
  const { slug } = await props.params;
  const pkg = await getPackage(slug);
  if (!pkg) return pageMetadata({ title: "Package not found", path: `/packages/${slug}`, noindex: true });
  return pageMetadata({
    title: pkg.seo_title || pkg.title,
    description: pkg.seo_description || pkg.summary,
    path: `/packages/${pkg.slug}`,
    image: pkg.image_url?.endsWith(".svg") ? "/brand/og-default.png" : pkg.image_url,
    imageAlt: pkg.image_alt,
  });
}

export default async function PackagePage(props: PageProps<"/packages/[slug]">) {
  const { slug } = await props.params;
  const [pkg, rates, settings] = await Promise.all([getPackage(slug), getVehicleRates(), getSiteSettings()]);
  if (!pkg) notFound();

  const vehicleOptions = pkg.prices
    .map((p) => {
      const rate = rates.find((r) => r.vehicle_class === p.vehicle_class);
      return rate ? { vehicle_class: p.vehicle_class, label: rate.label, seats: rate.seats, luggage_bags: rate.luggage_bags, price_paise: p.price_paise } : null;
    })
    .filter((v) => v !== null);

  return (
    <>
      <div className="border-b border-line bg-gradient-to-b from-ivory-dark to-ivory">
        <Container className="py-8">
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/packages", label: "Tour packages" }, { label: pkg.title }]} />
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge>{PACKAGE_CATEGORY_LABELS[pkg.category]}</Badge>
                <Badge tone="green">
                  {pkg.duration_days} day{pkg.duration_days > 1 ? "s" : ""}
                  {pkg.duration_nights > 0 && ` / ${pkg.duration_nights} night${pkg.duration_nights > 1 ? "s" : ""}`}
                </Badge>
              </div>
              <h1 className="text-3xl font-semibold sm:text-4xl">{pkg.title}</h1>
              <p className="mt-3 text-lg text-muted">{pkg.summary}</p>
            </div>
            {pkg.image_url && (
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-ivory-dark">
                <Image src={pkg.image_url} alt={pkg.image_alt ?? ""} fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
              </div>
            )}
          </div>
        </Container>
      </div>

      <Container className="grid gap-10 py-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-10">
          <section aria-labelledby="overview">
            <h2 id="overview" className="text-2xl font-semibold">Overview</h2>
            <div className="prose-yatra mt-3 whitespace-pre-line">{pkg.description}</div>
            {pkg.highlights.length > 0 && (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {pkg.highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-sm">
                    <span aria-hidden className="text-gold-500">✦</span> {h}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {pkg.itinerary.length > 0 && (
            <section aria-labelledby="itinerary">
              <h2 id="itinerary" className="text-2xl font-semibold">Itinerary</h2>
              <ol className="mt-4 space-y-4 border-l-2 border-gold-200 pl-6">
                {pkg.itinerary.map((day) => (
                  <li key={day.day} className="relative">
                    <span className="absolute -left-[35px] flex h-6 w-6 items-center justify-center rounded-full bg-gold-400 text-xs font-bold text-forest-900">{day.day}</span>
                    <h3 className="font-semibold">Day {day.day}: {day.title}</h3>
                    <p className="mt-1 text-sm text-muted">{day.details}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section aria-labelledby="inclusions" className="grid gap-6 sm:grid-cols-2">
            <div>
              <h2 id="inclusions" className="text-xl font-semibold">Included</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {pkg.inclusions.map((i) => (
                  <li key={i} className="flex gap-2"><span aria-hidden className="text-forest-500">✓</span>{i}</li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Not included</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {pkg.exclusions.map((i) => (
                  <li key={i} className="flex gap-2"><span aria-hidden className="text-red-700">✕</span>{i}</li>
                ))}
              </ul>
            </div>
          </section>

          {pkg.destinations.length > 0 && (
            <section aria-labelledby="places">
              <h2 id="places" className="text-xl font-semibold">Places covered</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {pkg.destinations.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/destinations/${d.slug}`} className="inline-block rounded-full border border-line bg-white px-3 py-1.5 text-sm hover:border-forest-500">
                      {d.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="prices">
            <h2 id="prices" className="text-xl font-semibold">Price per vehicle</h2>
            <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-ivory-dark text-forest-900">
                  <tr><th scope="col" className="px-4 py-3">Vehicle</th><th scope="col" className="px-4 py-3">Seats</th><th scope="col" className="px-4 py-3 text-right">Price</th></tr>
                </thead>
                <tbody>
                  {vehicleOptions.map((v) => (
                    <tr key={v.vehicle_class} className="border-t border-line">
                      <td className="px-4 py-3">{v.label}</td>
                      <td className="px-4 py-3">{v.seats}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatINR(v.price_paise)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted">
              {settings.booking.tax_rate_bps > 0 &&
                `${settings.booking.tax_label} ${settings.booking.prices_include_tax ? "included" : "is added at checkout"}. `}
              Seasonal adjustments and coupons, if any, are shown in the fare breakdown before payment.
            </p>
          </section>

          <Alert tone="warning" title="Darshan tickets are not included">{TTD_DISCLAIMER}</Alert>
        </div>

        <aside aria-label="Book this package" className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <h2 className="text-xl font-semibold">Book this package</h2>
            <p className="mt-1 text-sm text-muted">Choose your vehicle and date. You will see the exact fare before paying.</p>
            <div className="mt-4">
              {vehicleOptions.length ? (
                <BookingForm
                  mode="package"
                  packageSlug={pkg.slug}
                  defaultTime={pkg.default_start_time.slice(0, 5)}
                  vehicles={vehicleOptions.map((v) => ({ ...v, label: `${VEHICLE_CLASS_LABELS[v.vehicle_class]} · ${v.seats} seats · ${formatINR(v.price_paise)}` }))}
                  minPassengers={pkg.min_passengers}
                  maxPassengers={pkg.max_passengers}
                />
              ) : (
                <Alert tone="info">Online booking for this package is not open yet. Please contact us.</Alert>
              )}
            </div>
          </Card>
        </aside>
      </Container>

      <JsonLd data={touristTripJsonLd(pkg)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Tour packages", path: "/packages" },
          { name: pkg.title, path: `/packages/${pkg.slug}` },
        ])}
      />
    </>
  );
}
