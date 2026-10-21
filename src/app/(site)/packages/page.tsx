import Link from "next/link";
import { Suspense } from "react";
import { PackageCard } from "@/components/catalog/PackageCard";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Container, EmptyState, LoadingBlock, PageHeader, buttonClass } from "@/components/ui";
import { getPackages } from "@/lib/data/catalog";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { PACKAGE_CATEGORY_LABELS, type PackageSummary } from "@/lib/types";

export const metadata = pageMetadata({
  title: "Tirupati Tour Packages — Tirumala, Temple Circuits & Sightseeing",
  description:
    "Browse Tirupati tour packages: Tirumala hill transfers, local temple tours, Srikalahasti and Kanipakam circuits and multi-day pilgrimages, priced per vehicle.",
  path: "/packages",
});

const SORTS = {
  recommended: "Recommended",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  duration: "Duration",
} as const;
type Sort = keyof typeof SORTS;

function filterPackages(packages: PackageSummary[], params: Record<string, string | string[] | undefined>) {
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase().slice(0, 80) : "";
  const category = typeof params.category === "string" && params.category in PACKAGE_CATEGORY_LABELS ? params.category : "";
  const sort: Sort = typeof params.sort === "string" && params.sort in SORTS ? (params.sort as Sort) : "recommended";
  const destination = typeof params.destination === "string" ? params.destination : "";

  let result = packages.filter(
    (p) =>
      (!category || p.category === category) &&
      (!destination || p.destination_slugs.includes(destination)) &&
      (!q || `${p.title} ${p.summary}`.toLowerCase().includes(q)),
  );
  const price = (p: PackageSummary) => p.min_price_paise ?? Number.MAX_SAFE_INTEGER;
  if (sort === "price-asc") result = [...result].sort((a, b) => price(a) - price(b));
  if (sort === "price-desc") result = [...result].sort((a, b) => price(b) - price(a));
  if (sort === "duration") result = [...result].sort((a, b) => a.duration_days - b.duration_days);
  return { result, q, category, sort, destination };
}

async function PackageResults({ searchParams }: { searchParams: PageProps<"/packages">["searchParams"] }) {
  const [params, packages] = await Promise.all([searchParams, getPackages()]);
  const { result, q, category, sort, destination } = filterPackages(packages, params);

  return (
    <>
      <form role="search" aria-label="Filter packages" className="mb-8 grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <label className="sr-only" htmlFor="q">Search packages</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search e.g. Srikalahasti, Tirumala…" className="rounded-xl border border-line px-3.5 py-2.5 text-sm" />
        <label className="sr-only" htmlFor="category">Category</label>
        <select id="category" name="category" defaultValue={category} className="rounded-xl border border-line px-3 py-2.5 text-sm">
          <option value="">All categories</option>
          {Object.entries(PACKAGE_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="sort">Sort by</label>
        <select id="sort" name="sort" defaultValue={sort} className="rounded-xl border border-line px-3 py-2.5 text-sm">
          {Object.entries(SORTS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {destination && <input type="hidden" name="destination" value={destination} />}
        <button type="submit" className={buttonClass("primary", "md")}>Apply</button>
      </form>

      <p className="mb-4 text-sm text-muted" aria-live="polite">
        {result.length} package{result.length === 1 ? "" : "s"} found
        {(q || category || destination) && (
          <>
            {" · "}
            <Link href="/packages" className="underline">Clear filters</Link>
          </>
        )}
      </p>

      {result.length === 0 ? (
        <EmptyState
          title={packages.length === 0 ? "Packages are being updated" : "No packages match your search"}
          action={<Link href="/custom-itinerary" className={buttonClass("gold")}>Plan a custom trip</Link>}
        >
          {packages.length === 0
            ? "Please check back shortly, or tell us where you would like to go and we will plan it for you."
            : "Try a different search, or ask us for a custom itinerary."}
        </EmptyState>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {result.map((pkg) => (
            <li key={pkg.id} className="relative flex">
              <PackageCard pkg={pkg} headingLevel="h2" />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function PackagesPage(props: PageProps<"/packages">) {
  return (
    <>
      <PageHeader
        title="Tirupati tour packages"
        intro="Fixed-price itineraries with a dedicated AC vehicle and an experienced local driver. Prices are per vehicle, not per person — the full fare breakdown is shown before you pay."
      >
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Tour packages" }]} />
      </PageHeader>
      <Container className="py-10">
        <Suspense fallback={<LoadingBlock label="Loading packages" />}>
          <PackageResults searchParams={props.searchParams} />
        </Suspense>
      </Container>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Tour packages", path: "/packages" }])} />
    </>
  );
}
