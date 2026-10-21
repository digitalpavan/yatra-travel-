import type { MetadataRoute } from "next";
import { getBlogPosts, getDestinations, getPackages } from "@/lib/data/catalog";
import { absoluteUrl } from "@/lib/seo";

const STATIC_ROUTES: { path: string; changeFrequency: "daily" | "weekly" | "monthly" | "yearly"; priority: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/packages", changeFrequency: "weekly", priority: 0.9 },
  { path: "/tirumala-tirupati", changeFrequency: "monthly", priority: 0.9 },
  { path: "/temple-tours", changeFrequency: "monthly", priority: 0.8 },
  { path: "/destinations", changeFrequency: "weekly", priority: 0.8 },
  { path: "/cab-booking", changeFrequency: "monthly", priority: 0.9 },
  { path: "/custom-itinerary", changeFrequency: "monthly", priority: 0.7 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.6 },
  { path: "/faqs", changeFrequency: "monthly", priority: 0.6 },
  { path: "/about", changeFrequency: "yearly", priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
  { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/cancellation-refund-policy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/cookie-policy", changeFrequency: "yearly", priority: 0.2 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [packages, destinations, posts] = await Promise.all([getPackages(), getDestinations(), getBlogPosts()]);

  return [
    ...STATIC_ROUTES.map((r) => ({ url: absoluteUrl(r.path), changeFrequency: r.changeFrequency, priority: r.priority })),
    ...packages.map((p) => ({
      url: absoluteUrl(`/packages/${p.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...destinations.map((d) => ({
      url: absoluteUrl(`/destinations/${d.slug}`),
      ...(d.updated_at && { lastModified: d.updated_at }),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      ...((post.updated_at || post.published_at) && { lastModified: post.updated_at || post.published_at }),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
