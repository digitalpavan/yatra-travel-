import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { DESTINATION_CATEGORY_LABELS, type Destination } from "@/lib/types";

export function DestinationCard({ destination: d, headingLevel = "h3" }: { destination: Destination; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <article className="group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)] transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/10] bg-ivory-dark">
        {d.image_url && (
          <Image
            src={d.image_url}
            alt={d.image_alt ?? ""}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
        <div className="absolute top-3 left-3">
          <Badge>{DESTINATION_CATEGORY_LABELS[d.category] ?? d.category}</Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Heading className="text-lg font-semibold">
          <Link href={`/destinations/${d.slug}`} className="after:absolute after:inset-0 focus:outline-none">
            {d.name}
          </Link>
        </Heading>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{d.short_description}</p>
        {d.distance_from_tirupati_km !== null && (
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
            About {d.distance_from_tirupati_km} km from Tirupati{d.region && d.region !== "Tirupati" ? ` · ${d.region}` : ""}
          </p>
        )}
      </div>
    </article>
  );
}
