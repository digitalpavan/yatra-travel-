import Link from "next/link";
import { Suspense } from "react";
import { DestinationCard } from "@/components/content/DestinationCard";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Container, EmptyState, LoadingBlock, PageHeader, buttonClass } from "@/components/ui";
import { getDestinations } from "@/lib/data/catalog";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { DESTINATION_CATEGORY_LABELS, type Destination } from "@/lib/types";

export const metadata = pageMetadata({
  title: "Destinations Around Tirupati — Temples & Sights",
  description:
    "Explore temples, hills, waterfalls and heritage sites around Tirupati and Tirumala, with distances from Tirupati, the best time to visit and tours that cover them.",
  path: "/destinations",
});

type Category = Destination["category"];

async function DestinationResults({ searchParams }: { searchParams: PageProps<"/destinations">["searchParams"] }) {
  const [params, destinations] = await Promise.all([searchParams, getDestinations()]);
  const raw = typeof params.category === "string" ? params.category : "";
  const category = raw in DESTINATION_CATEGORY_LABELS ? (raw as Category) : "";
  const result = category ? destinations.filter((d) => d.category === category) : destinations;
  const available = new Set(destinations.map((d) => d.category));

  return (
    <>
      <nav aria-label="Filter destinations by category" className="mb-8">
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link
              href="/destinations"
              aria-current={!category ? "page" : undefined}
              className={`inline-block rounded-full border px-4 py-1.5 text-sm ${!category ? "border-forest-800 bg-forest-800 text-white" : "border-line bg-white hover:border-forest-500"}`}
            >
              All
            </Link>
          </li>
          {(Object.entries(DESTINATION_CATEGORY_LABELS) as [Category, string][])
            .filter(([value]) => available.has(value) || value === category)
            .map(([value, label]) => (
              <li key={value}>
                <Link
                  href={`/destinations?category=${value}`}
                  aria-current={category === value ? "page" : undefined}
                  className={`inline-block rounded-full border px-4 py-1.5 text-sm ${category === value ? "border-forest-800 bg-forest-800 text-white" : "border-line bg-white hover:border-forest-500"}`}
                >
                  {label}
                </Link>
              </li>
            ))}
        </ul>
      </nav>

      <p className="mb-4 text-sm text-muted" aria-live="polite">
        {result.length} destination{result.length === 1 ? "" : "s"}
        {category && ` in ${DESTINATION_CATEGORY_LABELS[category]}`}
      </p>

      {result.length === 0 ? (
        <EmptyState
          title={destinations.length === 0 ? "Destination guides are coming soon" : "No destinations in this category yet"}
          action={
            destinations.length === 0 ? (
              <Link href="/custom-itinerary" className={buttonClass("gold")}>Plan a custom trip</Link>
            ) : (
              <Link href="/destinations" className={buttonClass("outline")}>Show all destinations</Link>
            )
          }
        >
          {destinations.length === 0
            ? "We are adding guides for temples and sights around Tirupati. Meanwhile, tell us where you would like to go."
            : "Try another category."}
        </EmptyState>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {result.map((d) => (
            <li key={d.id} className="flex">
              <DestinationCard destination={d} headingLevel="h2" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function DestinationsPage(props: PageProps<"/destinations">) {
  return (
    <>
      <PageHeader
        title="Destinations around Tirupati"
        intro="Temples, hills, waterfalls and heritage sites within reach of Tirupati — with approximate distances and tips for planning your visit."
      >
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Destinations" }]} />
      </PageHeader>
      <Container className="py-10">
        <Suspense fallback={<LoadingBlock label="Loading destinations" />}>
          <DestinationResults searchParams={props.searchParams} />
        </Suspense>
      </Container>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Destinations", path: "/destinations" }])} />
    </>
  );
}
