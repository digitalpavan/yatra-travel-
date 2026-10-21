import Link from "next/link";
import { Suspense } from "react";
import { ItineraryForm } from "@/components/content/ItineraryForm";
import { JsonLd } from "@/components/JsonLd";
import { Alert, Breadcrumbs, Card, Container, LoadingBlock, PageHeader } from "@/components/ui";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { TTD_DISCLAIMER } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Plan a Custom Trip from Tirupati",
  description:
    "Request a custom itinerary for Tirumala, temples and sightseeing around Tirupati. Share your dates, group size and places — our team will plan the route and quote.",
  path: "/custom-itinerary",
});

async function PrefilledItineraryForm({ searchParams }: { searchParams: PageProps<"/custom-itinerary">["searchParams"] }) {
  const params = await searchParams;
  const place = typeof params.place === "string" ? params.place.replace(/[^\p{L}\p{N}\s,.'()-]/gu, "").slice(0, 120) : "";
  return <ItineraryForm defaultPlaces={place} />;
}

const STEPS = [
  ["Share your plan", "Dates, number of travellers, pickup city and the places you have in mind — rough ideas are fine."],
  ["We plan the route", "Our team works out a realistic day-by-day route, the right vehicle and timings around your temple visits."],
  ["Get a quote", "We contact you by phone or email with the plan and price. Nothing is booked or charged until you confirm."],
] as const;

export default function CustomItineraryPage(props: PageProps<"/custom-itinerary">) {
  return (
    <>
      <PageHeader
        title="Plan a custom trip"
        intro="Travelling with family, a group or on a tight schedule? Tell us what you would like to do and we will put together a transport plan around Tirupati, Tirumala and the wider region."
      >
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Custom itinerary" }]} />
      </PageHeader>

      <Container className="grid gap-10 py-10 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5 sm:p-8">
          <h2 className="mb-1 text-2xl font-semibold">Your itinerary request</h2>
          <p className="mb-6 text-sm text-muted">Fields marked * are required.</p>
          <Suspense fallback={<LoadingBlock label="Loading form" />}>
            <PrefilledItineraryForm searchParams={props.searchParams} />
          </Suspense>
        </Card>

        <aside className="space-y-6">
          <section aria-labelledby="steps-heading" className="rounded-2xl border border-line bg-white p-6">
            <h2 id="steps-heading" className="text-xl font-semibold">What happens next</h2>
            <ol className="mt-4 space-y-4">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="flex gap-3">
                  <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-400 text-xs font-bold text-forest-900">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-sans font-semibold">{title}</h3>
                    <p className="text-sm text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <Alert tone="warning" title="Darshan and rooms on Tirumala">
            {TTD_DISCLAIMER} If you already hold TTD bookings, mention the dates and reporting times so we can plan around them.
          </Alert>
          <p className="text-sm text-muted">
            Need a simple point-to-point ride instead? <Link href="/cab-booking" className="font-semibold text-forest-800 underline">Book a cab online</Link> or browse{" "}
            <Link href="/packages" className="font-semibold text-forest-800 underline">ready-made packages</Link>.
          </p>
        </aside>
      </Container>

      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Custom itinerary", path: "/custom-itinerary" }])} />
    </>
  );
}
