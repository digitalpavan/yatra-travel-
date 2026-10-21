import Link from "next/link";
import { Suspense } from "react";
import { BookingForm } from "@/components/booking/BookingForm";
import { CabRouteList, cabRouteLabel } from "@/components/content/CabRouteList";
import { JsonLd } from "@/components/JsonLd";
import { Alert, Breadcrumbs, Card, Container, EmptyState, LoadingBlock, PageHeader, SectionHeading, buttonClass } from "@/components/ui";
import { getCabRoutes, getSiteSettings, getVehicleRates } from "@/lib/data/catalog";
import { formatINR } from "@/lib/money";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import type { CabRoute, VehicleRate } from "@/lib/types";

export const metadata = pageMetadata({
  title: "Cab Booking in Tirupati — Tirumala, Airport & Outstation",
  description:
    "Book a cab in Tirupati for Tirumala, the airport, railway station, temple towns and outstation trips. Per-km fares by vehicle, with the full fare shown before you pay.",
  path: "/cab-booking",
});

async function CabBookingForm({
  searchParams,
  routes,
  rates,
}: {
  searchParams: PageProps<"/cab-booking">["searchParams"];
  routes: CabRoute[];
  rates: VehicleRate[];
}) {
  const params = await searchParams;
  const requested = typeof params.route === "string" ? params.route : undefined;
  const defaultRoute = routes.some((r) => r.slug === requested) ? requested : undefined;
  return (
    <BookingForm
      mode="cab"
      routes={routes.map((r) => ({ slug: r.slug, label: cabRouteLabel(r) }))}
      vehicles={rates.map((r) => ({
        vehicle_class: r.vehicle_class,
        label: `${r.label} · ${r.seats} seats · ${formatINR(r.per_km_paise)}/km`,
        seats: r.seats,
        luggage_bags: r.luggage_bags,
      }))}
      defaultRoute={defaultRoute}
    />
  );
}

export default async function CabBookingPage(props: PageProps<"/cab-booking">) {
  const [routes, rates, settings] = await Promise.all([getCabRoutes(), getVehicleRates(), getSiteSettings()]);
  const showBaseFare = rates.some((r) => r.base_fare_paise > 0);
  const tax = settings.booking;

  return (
    <>
      <PageHeader
        title="Cab booking in Tirupati"
        intro="Point-to-point and round-trip cabs for Tirumala, the airport, the railway station, nearby temple towns and outstation destinations — with a clear, itemised fare before you pay."
      >
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Cab booking" }]} />
      </PageHeader>

      <Container className="grid gap-10 py-10 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-12">
          <section aria-labelledby="fares-heading">
            <SectionHeading eyebrow="Fares" title="How cab fares are calculated" />
            <div className="-mt-4 space-y-4 text-sm leading-relaxed text-charcoal">
              <p>
                <strong>One-way trips</strong> are charged on the route distance multiplied by the per-kilometre rate of the vehicle you
                choose{showBaseFare ? ", plus the vehicle's base fare" : ""}.
              </p>
              <p>
                <strong>Round trips</strong> are charged for twice the route distance or the minimum kilometres per day multiplied by
                the number of trip days, whichever is higher, plus a daily driver allowance{showBaseFare ? " and the base fare" : ""}.
              </p>
              <p>
                <strong>Not included unless stated:</strong> tolls, parking fees and interstate permits, which are paid at actuals, along with any
                other government or local vehicle charges that apply on the day.
              </p>
              {tax.tax_rate_bps > 0 && (
                <p>
                  {tax.tax_label} at {tax.tax_rate_bps / 100}% is {tax.prices_include_tax ? "included in" : "added to"} the fare.
                </p>
              )}
              <p className="text-muted">The booking form shows the complete fare breakdown for your date and vehicle before payment.</p>
            </div>

            {rates.length ? (
              <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <caption className="sr-only">Cab rates by vehicle type</caption>
                  <thead className="bg-ivory-dark text-forest-900">
                    <tr>
                      <th scope="col" className="px-4 py-3">Vehicle</th>
                      <th scope="col" className="px-4 py-3">Seats / bags</th>
                      {showBaseFare && <th scope="col" className="px-4 py-3 text-right">Base fare</th>}
                      <th scope="col" className="px-4 py-3 text-right">Per km</th>
                      <th scope="col" className="px-4 py-3 text-right">Min km/day*</th>
                      <th scope="col" className="px-4 py-3 text-right">Driver allowance/day*</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rates.map((r) => (
                      <tr key={r.vehicle_class} className="border-t border-line">
                        <th scope="row" className="px-4 py-3 font-semibold text-forest-900">{r.label}</th>
                        <td className="px-4 py-3">{r.seats} seats · {r.luggage_bags} bags</td>
                        {showBaseFare && <td className="px-4 py-3 text-right">{formatINR(r.base_fare_paise)}</td>}
                        <td className="px-4 py-3 text-right font-semibold">{formatINR(r.per_km_paise)}</td>
                        <td className="px-4 py-3 text-right">{r.min_km_per_day} km</td>
                        <td className="px-4 py-3 text-right">{formatINR(r.driver_allowance_per_day_paise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-line px-4 py-2 text-xs text-muted">* Applies to round trips.</p>
              </div>
            ) : (
              <div className="mt-6">
                <EmptyState title="Rates are being updated">Please contact us for a fare while we update our rate card.</EmptyState>
              </div>
            )}
          </section>

          <section aria-labelledby="routes-heading">
            <div id="routes-heading">
              <SectionHeading
                eyebrow="Routes"
                title="Popular fixed routes"
                intro="Distances and travel times are approximate and vary with traffic, checkpoints and road conditions."
              />
            </div>
            {routes.length ? (
              <CabRouteList routes={routes} />
            ) : (
              <EmptyState title="Routes are being updated" />
            )}
            <p className="mt-6 text-sm">
              Going somewhere not listed, or need a multi-stop trip?{" "}
              <Link href="/custom-itinerary" className="font-semibold text-forest-800 underline">
                Request a custom itinerary
              </Link>
              .
            </p>
          </section>

          <Alert tone="info" title="Tirumala trips">
            Vehicles going up to Tirumala pass security checks at Alipiri and must follow ghat road rules set by TTD and the police.
            Darshan tickets are not part of a cab booking — book them only through official TTD channels.
          </Alert>
        </div>

        <aside id="book" aria-label="Book a cab" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <h2 className="text-xl font-semibold">Book a cab</h2>
            <p className="mt-1 text-sm text-muted">Choose a route, vehicle and time. You will see the exact fare before paying.</p>
            <div className="mt-4">
              {routes.length && rates.length ? (
                <Suspense fallback={<LoadingBlock label="Loading booking form" />}>
                  <CabBookingForm searchParams={props.searchParams} routes={routes} rates={rates} />
                </Suspense>
              ) : (
                <Alert tone="info">
                  Online cab booking is not open yet.{" "}
                  <Link href="/contact" className="underline">Contact us</Link> and we will arrange your trip.
                </Alert>
              )}
            </div>
            <p className="mt-4 text-xs text-muted">
              Need several stops or a multi-day trip?{" "}
              <Link href="/custom-itinerary" className={`${buttonClass("ghost", "sm")} !px-0 underline`}>Plan a custom trip</Link>
            </p>
          </Card>
        </aside>
      </Container>

      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Cab booking", path: "/cab-booking" }])} />
    </>
  );
}
