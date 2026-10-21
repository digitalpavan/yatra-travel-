import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageCard } from "@/components/catalog/PackageCard";
import { JsonLd } from "@/components/JsonLd";
import { Alert, Badge, Breadcrumbs, ButtonLink, Card, Container, buttonClass } from "@/components/ui";
import { getDestination, getDestinations, getPackages } from "@/lib/data/catalog";
import { attractionJsonLd, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { TTD_DISCLAIMER } from "@/lib/site";
import { DESTINATION_CATEGORY_LABELS } from "@/lib/types";

export async function generateStaticParams() {
  const destinations = await getDestinations();
  // Cache Components requires at least one entry; unknown slugs render notFound().
  return destinations.length ? destinations.map((d) => ({ slug: d.slug })) : [{ slug: "unavailable" }];
}

export async function generateMetadata(props: PageProps<"/destinations/[slug]">) {
  const { slug } = await props.params;
  const d = await getDestination(slug);
  if (!d) return pageMetadata({ title: "Destination not found", path: `/destinations/${slug}`, noindex: true });
  return pageMetadata({
    title: d.seo_title || `${d.name} — Travel Guide from Tirupati`,
    description: d.seo_description || d.short_description,
    path: `/destinations/${d.slug}`,
    image: d.image_url?.endsWith(".svg") ? "/brand/og-default.png" : d.image_url,
    imageAlt: d.image_alt,
  });
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export default async function DestinationPage(props: PageProps<"/destinations/[slug]">) {
  const { slug } = await props.params;
  const [d, packages] = await Promise.all([getDestination(slug), getPackages()]);
  if (!d) notFound();

  const covering = packages.filter((p) => p.destination_slugs.includes(d.slug));
  const lat = d.latitude !== null ? Number(d.latitude) : null;
  const lng = d.longitude !== null ? Number(d.longitude) : null;
  const mapLink = lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) ? mapsUrl(lat, lng) : null;
  const isTirumala = /tirumala|venkateswara/i.test(`${d.slug} ${d.name}`);

  return (
    <>
      <div className="border-b border-line bg-gradient-to-b from-ivory-dark to-ivory">
        <Container className="py-8">
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/destinations", label: "Destinations" }, { label: d.name }]} />
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge>{DESTINATION_CATEGORY_LABELS[d.category] ?? d.category}</Badge>
                {d.region && <Badge tone="green">{d.region}</Badge>}
              </div>
              <h1 className="text-3xl font-semibold sm:text-4xl">{d.name}</h1>
              <p className="mt-3 text-lg text-muted">{d.short_description}</p>
            </div>
            {d.image_url && (
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-ivory-dark">
                <Image src={d.image_url} alt={d.image_alt ?? ""} fill priority sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
              </div>
            )}
          </div>
        </Container>
      </div>

      <Container className="grid gap-10 py-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-10">
          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="text-2xl font-semibold">About {d.name}</h2>
            <div className="prose-yatra mt-3 whitespace-pre-line">{d.description || d.short_description}</div>
          </section>

          {d.visitor_note && (
            <Alert tone="info" title="Visitor note">
              {d.visitor_note}
            </Alert>
          )}

          {(d.category === "temple" || isTirumala) && <Alert tone="warning" title="Temple tickets are not included">{TTD_DISCLAIMER}</Alert>}

          <section aria-labelledby="packages-heading">
            <h2 id="packages-heading" className="text-2xl font-semibold">Tours that include {d.name}</h2>
            {covering.length ? (
              <ul className="mt-4 grid gap-6 sm:grid-cols-2">
                {covering.map((p) => (
                  <li key={p.id} className="relative flex">
                    <PackageCard pkg={p} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-muted">
                No fixed package covers this place yet.{" "}
                <Link href={`/custom-itinerary?place=${encodeURIComponent(d.name)}`} className="font-semibold text-forest-800 underline">
                  Ask us for a custom trip
                </Link>{" "}
                or <Link href="/cab-booking" className="font-semibold text-forest-800 underline">book a cab</Link>.
              </p>
            )}
          </section>
        </div>

        <aside aria-label="Trip facts" className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <h2 className="text-xl font-semibold">Plan your visit</h2>
            <dl className="mt-4 space-y-3 text-sm">
              {d.distance_from_tirupati_km !== null && (
                <div>
                  <dt className="text-muted">Distance from Tirupati</dt>
                  <dd className="font-semibold text-forest-900">About {d.distance_from_tirupati_km} km by road</dd>
                </div>
              )}
              {d.best_time_to_visit && (
                <div>
                  <dt className="text-muted">Best time to visit</dt>
                  <dd className="font-semibold text-forest-900">{d.best_time_to_visit}</dd>
                </div>
              )}
              {d.region && (
                <div>
                  <dt className="text-muted">Region</dt>
                  <dd className="font-semibold text-forest-900">{d.region}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-xs text-muted">Distances are approximate and depend on the route taken.</p>
            <div className="mt-5 flex flex-col gap-2">
              {mapLink && (
                <a href={mapLink} target="_blank" rel="noopener noreferrer" className={buttonClass("outline")}>
                  View on Google Maps<span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              <ButtonLink href={`/packages?destination=${d.slug}`} variant="primary">Find tours</ButtonLink>
              <ButtonLink href="/cab-booking" variant="gold">Book a cab</ButtonLink>
            </div>
          </Card>
        </aside>
      </Container>

      <JsonLd data={attractionJsonLd(d)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Destinations", path: "/destinations" },
          { name: d.name, path: `/destinations/${d.slug}` },
        ])}
      />
    </>
  );
}
