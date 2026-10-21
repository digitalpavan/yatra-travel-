import Link from "next/link";
import type { CabRoute } from "@/lib/types";

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function cabRouteLabel(r: Pick<CabRoute, "origin" | "destination" | "distance_km">): string {
  return `${r.origin} → ${r.destination} (~${r.distance_km} km)`;
}

/** Fixed cab routes with approximate distance/time; each links to the cab booking form preselected. */
export function CabRouteList({ routes, headingLevel = "h3" }: { routes: CabRoute[]; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {routes.map((r) => (
        <li key={r.id} className="relative rounded-2xl border border-line bg-white p-4 transition hover:border-gold-300">
          <Heading className="font-sans text-base font-semibold text-forest-900">
            <Link href={`/cab-booking?route=${r.slug}#book`} className="after:absolute after:inset-0">
              {r.origin} <span aria-hidden>→</span>
              <span className="sr-only"> to </span> {r.destination}
            </Link>
          </Heading>
          <p className="mt-1 text-sm text-muted">
            ~{r.distance_km} km · usually around {formatDuration(r.typical_duration_minutes)}
          </p>
          {r.notes && <p className="mt-1 text-xs text-gold-700">{r.notes}</p>}
        </li>
      ))}
    </ul>
  );
}
