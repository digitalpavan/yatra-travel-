-- =============================================================================
-- Catalog & content: destinations, packages, cab routes/rates, blog, FAQs, settings
-- All money is stored as integer paise (1 INR = 100 paise).
-- =============================================================================

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  category text not null check (category in ('temple', 'sightseeing', 'nature', 'heritage', 'city')),
  region text not null default 'Tirupati',
  short_description text not null check (char_length(short_description) <= 300),
  description text not null default '',
  image_url text,
  image_alt text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  distance_from_tirupati_km integer check (distance_from_tirupati_km >= 0),
  best_time_to_visit text,
  visitor_note text,                -- e.g. "Timings vary; confirm with the temple administration."
  is_published boolean not null default false,
  sort_order integer not null default 0,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 170),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint destinations_image_alt_required check (image_url is null or image_alt is not null)
);
create index destinations_published_idx on public.destinations (is_published, sort_order);
create index destinations_category_idx on public.destinations (category);
create trigger destinations_updated_at before update on public.destinations
  for each row execute function public.set_updated_at();

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 140),
  category text not null check (category in ('tirumala', 'temple_circuit', 'sightseeing', 'multi_day')),
  summary text not null check (char_length(summary) <= 300),
  description text not null default '',
  duration_days integer not null check (duration_days between 1 and 30),
  duration_nights integer not null default 0 check (duration_nights between 0 and 30),
  min_passengers integer not null default 1 check (min_passengers >= 1),
  max_passengers integer not null default 7 check (max_passengers >= 1),
  inclusions text[] not null default '{}',
  exclusions text[] not null default '{}',
  highlights text[] not null default '{}',
  itinerary jsonb not null default '[]'::jsonb check (jsonb_typeof(itinerary) = 'array'),
  default_start_time time not null default '05:00',
  image_url text,
  image_alt text,
  is_published boolean not null default false,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 170),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint packages_passenger_range check (max_passengers >= min_passengers),
  constraint packages_image_alt_required check (image_url is null or image_alt is not null)
);
create index packages_published_idx on public.packages (is_published, is_featured, sort_order);
create index packages_category_idx on public.packages (category);
create trigger packages_updated_at before update on public.packages
  for each row execute function public.set_updated_at();

create table public.package_destinations (
  package_id uuid not null references public.packages (id) on delete cascade,
  destination_id uuid not null references public.destinations (id) on delete restrict,
  position integer not null default 0,
  primary key (package_id, destination_id)
);
create index package_destinations_destination_idx on public.package_destinations (destination_id);

-- Cab rate card per vehicle class.
create table public.vehicle_rates (
  vehicle_class public.vehicle_class primary key,
  label text not null,
  example_models text not null default '',
  seats integer not null check (seats between 1 and 60),
  luggage_bags integer not null default 0 check (luggage_bags >= 0),
  base_fare_paise integer not null check (base_fare_paise >= 0),
  per_km_paise integer not null check (per_km_paise >= 0),
  min_km_per_day integer not null default 0 check (min_km_per_day >= 0),
  driver_allowance_per_day_paise integer not null default 0 check (driver_allowance_per_day_paise >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create trigger vehicle_rates_updated_at before update on public.vehicle_rates
  for each row execute function public.set_updated_at();

-- Package price per vehicle class (per-vehicle pricing, the norm for Tirupati packages).
create table public.package_prices (
  package_id uuid not null references public.packages (id) on delete cascade,
  vehicle_class public.vehicle_class not null references public.vehicle_rates (vehicle_class) on delete restrict,
  price_paise integer not null check (price_paise > 0),
  primary key (package_id, vehicle_class)
);

-- Fixed cab routes with known distances — enables instant, server-verified fares.
create table public.cab_routes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  origin text not null,
  destination text not null,
  distance_km integer not null check (distance_km between 1 and 2000),
  typical_duration_minutes integer not null check (typical_duration_minutes between 5 and 2880),
  notes text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (origin, destination)
);
create trigger cab_routes_updated_at before update on public.cab_routes
  for each row execute function public.set_updated_at();

-- Seasonal / festival pricing adjustments (percentage, in basis points; may be negative).
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  adjustment_bps integer not null check (adjustment_bps between -5000 and 10000),
  applies_to public.booking_type[] not null default '{package,cab}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_rules_dates check (ends_on >= starts_on)
);
create index pricing_rules_active_idx on public.pricing_rules (is_active, starts_on, ends_on);
create trigger pricing_rules_updated_at before update on public.pricing_rules
  for each row execute function public.set_updated_at();

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,30}$'),
  description text,
  discount_type text not null check (discount_type in ('percent', 'flat')),
  discount_value integer not null check (discount_value > 0), -- bps for percent, paise for flat
  max_discount_paise integer check (max_discount_paise > 0),
  min_order_paise integer not null default 0 check (min_order_paise >= 0),
  applies_to public.booking_type[] not null default '{package,cab}',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  usage_limit integer check (usage_limit > 0),
  per_customer_limit integer not null default 1 check (per_customer_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percent_range check (discount_type <> 'percent' or discount_value <= 10000),
  constraint coupons_validity check (valid_until is null or valid_until > valid_from)
);
create trigger coupons_updated_at before update on public.coupons
  for each row execute function public.set_updated_at();

-- Key/value site configuration. is_public rows are readable by anyone.
create table public.site_settings (
  key text primary key check (key ~ '^[a-z_]+$'),
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 160),
  excerpt text not null check (char_length(excerpt) <= 300),
  body_markdown text not null default '',
  cover_url text,
  cover_alt text,
  tags text[] not null default '{}',
  status public.publish_status not null default 'draft',
  published_at timestamptz,
  author_id uuid references public.profiles (id) on delete set null,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 170),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_published_at check (status <> 'published' or published_at is not null),
  constraint blog_posts_cover_alt check (cover_url is null or cover_alt is not null)
);
create index blog_posts_status_idx on public.blog_posts (status, published_at desc);
create trigger blog_posts_updated_at before update on public.blog_posts
  for each row execute function public.set_updated_at();

create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 5 and 300),
  answer text not null check (char_length(answer) between 5 and 3000),
  category text not null default 'general',
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index faqs_published_idx on public.faqs (is_published, category, sort_order);
create trigger faqs_updated_at before update on public.faqs
  for each row execute function public.set_updated_at();
