import type { Metadata } from "next";
import { publicEnv } from "@/lib/env";
import { DEFAULT_DESCRIPTION, SITE_NAME } from "@/lib/site";
import type { BlogPost, Destination, Faq, PackageDetail, SiteSettings } from "@/lib/types";

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${publicEnv.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Unique title/description, canonical URL and Open Graph/Twitter tags for a page. */
export function pageMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image,
  imageAlt,
  type = "website",
  noindex = false,
}: {
  title: string;
  description?: string;
  path: string;
  image?: string | null;
  imageAlt?: string | null;
  type?: "website" | "article";
  noindex?: boolean;
}): Metadata {
  const images = image ? [{ url: absoluteUrl(image), alt: imageAlt ?? title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: SITE_NAME, locale: "en_IN", type, images },
    twitter: { card: "summary_large_image", title, description, images: images?.map((i) => i.url) },
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}

// ---------------------------------------------------------------------------
// JSON-LD (schema.org). Only facts we actually hold — no ratings or offers
// that are not backed by real data.
// ---------------------------------------------------------------------------
export function organizationJsonLd(settings: SiteSettings) {
  const sameAs = Object.values(settings.social).filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "TravelAgency",
    "@id": absoluteUrl("/#organization"),
    name: settings.brand.name,
    slogan: settings.brand.tagline,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/brand/yatra-travel-logo.png"),
    image: absoluteUrl("/brand/yatra-travel-logo.png"),
    ...(settings.contact.phone && { telephone: settings.contact.phone }),
    ...(settings.contact.email && { email: settings.contact.email }),
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.contact.address || undefined,
      addressLocality: "Tirupati",
      addressRegion: "Andhra Pradesh",
      addressCountry: "IN",
    },
    areaServed: ["Tirupati", "Tirumala", "Chittoor district", "Andhra Pradesh"],
    ...(sameAs.length && { sameAs }),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function touristTripJsonLd(pkg: PackageDetail) {
  return {
    "@context": "https://schema.org",
    "@type": "TouristTrip",
    name: pkg.title,
    description: pkg.summary,
    url: absoluteUrl(`/packages/${pkg.slug}`),
    ...(pkg.image_url && { image: absoluteUrl(pkg.image_url) }),
    provider: { "@id": absoluteUrl("/#organization") },
    itinerary: {
      "@type": "ItemList",
      itemListElement: pkg.destinations.map((d, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: { "@type": "TouristAttraction", name: d.name, url: absoluteUrl(`/destinations/${d.slug}`) },
      })),
    },
    ...(pkg.min_price_paise && {
      offers: {
        "@type": "Offer",
        priceCurrency: "INR",
        price: (pkg.min_price_paise / 100).toFixed(2),
        url: absoluteUrl(`/packages/${pkg.slug}`),
        availability: "https://schema.org/InStock",
        description: "Starting price per vehicle; final fare shown at checkout.",
      },
    }),
  };
}

export function attractionJsonLd(d: Destination) {
  const type = d.category === "temple" ? ["TouristAttraction", "HinduTemple"] : "TouristAttraction";
  return {
    "@context": "https://schema.org",
    "@type": type,
    name: d.name,
    description: d.short_description,
    url: absoluteUrl(`/destinations/${d.slug}`),
    ...(d.image_url && { image: absoluteUrl(d.image_url) }),
    ...(d.latitude !== null &&
      d.longitude !== null && { geo: { "@type": "GeoCoordinates", latitude: d.latitude, longitude: d.longitude } }),
    address: { "@type": "PostalAddress", addressRegion: "Andhra Pradesh", addressCountry: "IN" },
  };
}

export function articleJsonLd(post: BlogPost) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    url: absoluteUrl(`/blog/${post.slug}`),
    ...(post.cover_url && { image: absoluteUrl(post.cover_url) }),
    author: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    publisher: { "@id": absoluteUrl("/#organization") },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };
}
