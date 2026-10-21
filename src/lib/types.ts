import type { VehicleClass, VehicleRate } from "@/lib/pricing";

export type { VehicleClass, VehicleRate };

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "refund_pending"
  | "refunded";

export interface ItineraryDay {
  day: number;
  title: string;
  details: string;
}

export interface PackagePrice {
  vehicle_class: VehicleClass;
  price_paise: number;
}

export interface PackageSummary {
  id: string;
  slug: string;
  title: string;
  category: "tirumala" | "temple_circuit" | "sightseeing" | "multi_day";
  summary: string;
  duration_days: number;
  duration_nights: number;
  image_url: string | null;
  image_alt: string | null;
  is_featured: boolean;
  sort_order: number;
  min_price_paise: number | null;
  destination_slugs: string[];
}

export interface PackageDetail extends PackageSummary {
  description: string;
  min_passengers: number;
  max_passengers: number;
  inclusions: string[];
  exclusions: string[];
  highlights: string[];
  itinerary: ItineraryDay[];
  default_start_time: string;
  seo_title: string | null;
  seo_description: string | null;
  prices: PackagePrice[];
  destinations: Pick<Destination, "slug" | "name" | "category">[];
  updated_at: string;
}

export interface Destination {
  id: string;
  slug: string;
  name: string;
  category: "temple" | "sightseeing" | "nature" | "heritage" | "city";
  region: string;
  short_description: string;
  description: string;
  image_url: string | null;
  image_alt: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_from_tirupati_km: number | null;
  best_time_to_visit: string | null;
  visitor_note: string | null;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string;
}

export interface CabRoute {
  id: string;
  slug: string;
  origin: string;
  destination: string;
  distance_km: number;
  typical_duration_minutes: number;
  notes: string | null;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_markdown: string;
  cover_url: string | null;
  cover_alt: string | null;
  tags: string[];
  published_at: string;
  updated_at: string;
  seo_title: string | null;
  seo_description: string | null;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface Testimonial {
  id: string;
  display_name: string;
  rating: number;
  title: string | null;
  body: string;
  created_at: string;
  booking_type: "package" | "cab";
}

export interface SiteSettings {
  brand: { name: string; tagline: string; legal_name: string; gstin: string };
  contact: { phone: string; email: string; address: string; hours: string; map_url: string };
  social: { facebook: string; instagram: string; youtube: string; x: string };
  whatsapp: { enabled: boolean; number: string; default_message: string };
  booking: {
    hold_minutes: number;
    min_lead_hours: number;
    max_advance_days: number;
    tax_rate_bps: number;
    tax_label: string;
    prices_include_tax: boolean;
  };
  cancellation_policy: { tiers: { min_hours_before: number; refund_bps: number }[]; note?: string };
  legal: { policy_version: string; last_updated: string; grievance_officer_name: string; grievance_officer_email: string };
}

export const DEFAULT_SETTINGS: SiteSettings = {
  brand: { name: "Yatra Travel", tagline: "Your Journey, Our Devotion.", legal_name: "", gstin: "" },
  contact: { phone: "", email: "", address: "Tirupati, Andhra Pradesh, India", hours: "", map_url: "" },
  social: { facebook: "", instagram: "", youtube: "", x: "" },
  whatsapp: { enabled: false, number: "", default_message: "Namaste! I would like to enquire about a trip with Yatra Travel." },
  booking: {
    hold_minutes: 30,
    min_lead_hours: 6,
    max_advance_days: 180,
    tax_rate_bps: 0,
    tax_label: "GST",
    prices_include_tax: false,
  },
  cancellation_policy: { tiers: [{ min_hours_before: 0, refund_bps: 0 }] },
  legal: { policy_version: "draft", last_updated: "", grievance_officer_name: "", grievance_officer_email: "" },
};

export const VEHICLE_CLASS_LABELS: Record<VehicleClass, string> = {
  sedan: "Sedan",
  suv: "SUV",
  muv: "Premium MUV",
  tempo_traveller: "Tempo Traveller",
  mini_bus: "Mini Bus",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Awaiting payment",
  confirmed: "Confirmed",
  assigned: "Vehicle assigned",
  in_progress: "Trip in progress",
  completed: "Completed",
  cancelled: "Cancelled",
  refund_pending: "Refund in progress",
  refunded: "Refunded",
};

export const PACKAGE_CATEGORY_LABELS: Record<PackageSummary["category"], string> = {
  tirumala: "Tirumala",
  temple_circuit: "Temple circuit",
  sightseeing: "Sightseeing",
  multi_day: "Multi-day",
};

export const DESTINATION_CATEGORY_LABELS: Record<Destination["category"], string> = {
  temple: "Temple",
  sightseeing: "Sightseeing",
  nature: "Nature",
  heritage: "Heritage",
  city: "City",
};
