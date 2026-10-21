import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { PACKAGE_CATEGORY_LABELS, type PackageSummary } from "@/lib/types";

export function PackageCard({ pkg, headingLevel = "h3" }: { pkg: PackageSummary; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[var(--shadow-card)] transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/10] bg-ivory-dark">
        {pkg.image_url && (
          <Image
            src={pkg.image_url}
            alt={pkg.image_alt ?? ""}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge>{PACKAGE_CATEGORY_LABELS[pkg.category]}</Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Heading className="text-lg font-semibold">
          <Link href={`/packages/${pkg.slug}`} className="after:absolute after:inset-0 focus:outline-none">
            <span className="relative">{pkg.title}</span>
          </Link>
        </Heading>
        <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">{pkg.summary}</p>
        <div className="mt-4 flex items-end justify-between border-t border-line pt-4 text-sm">
          <span className="text-muted">
            {pkg.duration_days} day{pkg.duration_days > 1 ? "s" : ""}
            {pkg.duration_nights > 0 && ` / ${pkg.duration_nights} night${pkg.duration_nights > 1 ? "s" : ""}`}
          </span>
          {pkg.min_price_paise !== null && (
            <span className="text-right">
              <span className="block text-xs text-muted">from (per vehicle)</span>
              <span className="font-display text-lg font-semibold text-forest-800">{formatINR(pkg.min_price_paise)}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
