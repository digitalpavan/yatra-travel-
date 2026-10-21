import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import {
  DEFAULT_SETTINGS,
  type BlogPost,
  type CabRoute,
  type Destination,
  type Faq,
  type PackageDetail,
  type PackageSummary,
  type SiteSettings,
  type Testimonial,
  type VehicleRate,
} from "@/lib/types";

/**
 * Cached public reads. Each function is tagged so admin mutations can expire it
 * with updateTag(<tag>). Errors are logged and surfaced as empty results so
 * pages render a graceful empty state rather than crashing.
 */
export const TAGS = {
  packages: "packages",
  destinations: "destinations",
  blog: "blog",
  faqs: "faqs",
  settings: "settings",
  routes: "cab-routes",
  rates: "vehicle-rates",
  testimonials: "testimonials",
} as const;

function logError(scope: string, error: { message: string } | null) {
  if (error) console.error(`[catalog:${scope}]`, error.message);
}

const PACKAGE_SUMMARY_COLUMNS =
  "id, slug, title, category, summary, duration_days, duration_nights, image_url, image_alt, is_featured, sort_order, package_prices(price_paise), package_destinations(destinations(slug))";

type PackageRow = Omit<PackageSummary, "min_price_paise" | "destination_slugs"> & {
  package_prices: { price_paise: number }[];
  package_destinations: { destinations: { slug: string } | null }[];
};

function toSummary(row: PackageRow): PackageSummary {
  const { package_prices, package_destinations, ...rest } = row;
  const prices = package_prices.map((p) => p.price_paise);
  return {
    ...rest,
    min_price_paise: prices.length ? Math.min(...prices) : null,
    destination_slugs: package_destinations.flatMap((d) => (d.destinations ? [d.destinations.slug] : [])),
  };
}

export async function getPackages(): Promise<PackageSummary[]> {
  "use cache";
  cacheTag(TAGS.packages);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("packages")
    .select(PACKAGE_SUMMARY_COLUMNS)
    .eq("is_published", true)
    .order("sort_order");
  logError("packages", error);
  return ((data ?? []) as unknown as PackageRow[]).map(toSummary);
}

export async function getPackage(slug: string): Promise<PackageDetail | null> {
  "use cache";
  cacheTag(TAGS.packages, `package:${slug}`);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("packages")
    .select(
      "id, slug, title, category, summary, description, duration_days, duration_nights, min_passengers, max_passengers, inclusions, exclusions, highlights, itinerary, default_start_time, image_url, image_alt, is_featured, sort_order, seo_title, seo_description, updated_at, package_prices(vehicle_class, price_paise), package_destinations(position, destinations(slug, name, category))",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  logError("package", error);
  if (!data) return null;
  const row = data as unknown as Omit<PackageDetail, "prices" | "destinations" | "min_price_paise" | "destination_slugs"> & {
    package_prices: PackageDetail["prices"];
    package_destinations: { position: number; destinations: PackageDetail["destinations"][number] | null }[];
  };
  const { package_prices, package_destinations, ...rest } = row;
  const destinations = [...package_destinations]
    .sort((a, b) => a.position - b.position)
    .flatMap((d) => (d.destinations ? [d.destinations] : []));
  const prices = [...package_prices].sort((a, b) => a.price_paise - b.price_paise);
  return {
    ...rest,
    prices,
    destinations,
    min_price_paise: prices[0]?.price_paise ?? null,
    destination_slugs: destinations.map((d) => d.slug),
  };
}

export async function getDestinations(): Promise<Destination[]> {
  "use cache";
  cacheTag(TAGS.destinations);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .eq("is_published", true)
    .order("sort_order");
  logError("destinations", error);
  return (data ?? []) as Destination[];
}

export async function getDestination(slug: string): Promise<Destination | null> {
  "use cache";
  cacheTag(TAGS.destinations, `destination:${slug}`);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("destinations")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  logError("destination", error);
  return (data as Destination | null) ?? null;
}

export async function getVehicleRates(): Promise<VehicleRate[]> {
  "use cache";
  cacheTag(TAGS.rates);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("vehicle_rates")
    .select("vehicle_class, label, seats, luggage_bags, base_fare_paise, per_km_paise, min_km_per_day, driver_allowance_per_day_paise, example_models")
    .eq("is_active", true)
    .order("sort_order");
  logError("rates", error);
  return (data ?? []) as VehicleRate[];
}

export async function getCabRoutes(): Promise<CabRoute[]> {
  "use cache";
  cacheTag(TAGS.routes);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cab_routes")
    .select("id, slug, origin, destination, distance_km, typical_duration_minutes, notes")
    .eq("is_active", true)
    .order("sort_order");
  logError("routes", error);
  return (data ?? []) as CabRoute[];
}

export async function getFaqs(category?: string): Promise<Faq[]> {
  "use cache";
  cacheTag(TAGS.faqs);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  let query = supabase.from("faqs").select("id, question, answer, category").eq("is_published", true);
  if (category) query = query.eq("category", category);
  const { data, error } = await query.order("sort_order");
  logError("faqs", error);
  return (data ?? []) as Faq[];
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  "use cache";
  cacheTag(TAGS.blog);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, body_markdown, cover_url, cover_alt, tags, published_at, updated_at, seo_title, seo_description")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  logError("blog", error);
  return (data ?? []) as BlogPost[];
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  "use cache";
  cacheTag(TAGS.blog, `post:${slug}`);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, body_markdown, cover_url, cover_alt, tags, published_at, updated_at, seo_title, seo_description")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  logError("post", error);
  return (data as BlogPost | null) ?? null;
}

export async function getTestimonials(limit = 6): Promise<Testimonial[]> {
  "use cache";
  cacheTag(TAGS.testimonials);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("public_testimonials")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  logError("testimonials", error);
  return (data ?? []) as Testimonial[];
}

export async function getSiteSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag(TAGS.settings);
  cacheLife("hours");
  const supabase = createSupabasePublicClient();
  if (!supabase) return DEFAULT_SETTINGS;
  const { data, error } = await supabase.from("site_settings").select("key, value").eq("is_public", true);
  logError("settings", error);
  return mergeSettings(data ?? []);
}

export function mergeSettings(rows: { key: string; value: unknown }[]): SiteSettings {
  const settings = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, Record<string, unknown>>;
  for (const { key, value } of rows) {
    if (key in settings && value && typeof value === "object") {
      settings[key] = { ...settings[key], ...(value as Record<string, unknown>) };
    }
  }
  return settings as unknown as SiteSettings;
}
