-- =============================================================================
-- Operations: fleet, bookings, allocation, payments, refunds, reviews,
-- notifications, support, itinerary requests, consent & privacy requests
-- =============================================================================

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null unique check (registration_number ~ '^[A-Z0-9 -]{4,15}$'),
  vehicle_class public.vehicle_class not null references public.vehicle_rates (vehicle_class) on delete restrict,
  model text not null,
  seats integer not null check (seats between 1 and 60),
  is_ac boolean not null default true,
  status text not null default 'active' check (status in ('active', 'maintenance', 'retired')),
  permit_valid_until date,
  insurance_valid_until date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vehicles_class_status_idx on public.vehicles (vehicle_class, status);
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles (id) on delete set null, -- optional login for driver app
  full_name text not null,
  phone text not null check (phone ~ '^\+?[0-9]{10,15}$'),
  license_number text not null unique,
  license_valid_until date,
  languages text[] not null default '{Telugu}',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger drivers_updated_at before update on public.drivers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique check (reference ~ '^YT[0-9]{6}-[A-Z2-9]{5}$'),
  customer_id uuid references public.profiles (id) on delete set null,
  idempotency_key text check (char_length(idempotency_key) between 8 and 80),
  booking_type public.booking_type not null,
  trip_type public.trip_type not null,
  package_id uuid references public.packages (id) on delete restrict,
  cab_route_id uuid references public.cab_routes (id) on delete restrict,
  vehicle_class public.vehicle_class not null references public.vehicle_rates (vehicle_class) on delete restrict,
  pickup_location text not null check (char_length(pickup_location) between 3 and 200),
  drop_location text check (char_length(drop_location) <= 200),
  start_at timestamptz not null,
  end_at timestamptz not null,
  trip_days integer not null default 1 check (trip_days between 1 and 30),
  passengers integer not null check (passengers between 1 and 60),
  luggage_bags integer not null default 0 check (luggage_bags between 0 and 60),
  special_requests text check (char_length(special_requests) <= 1000),
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  contact_phone text not null check (contact_phone ~ '^\+?[0-9]{10,15}$'),
  contact_email text not null,
  status public.booking_status not null default 'pending',
  coupon_id uuid references public.coupons (id) on delete set null,
  price_breakdown jsonb not null,
  subtotal_paise integer not null check (subtotal_paise >= 0),
  adjustment_paise integer not null default 0,
  discount_paise integer not null default 0 check (discount_paise >= 0),
  tax_paise integer not null default 0 check (tax_paise >= 0),
  total_paise integer not null check (total_paise > 0),
  amount_paid_paise integer not null default 0 check (amount_paid_paise >= 0),
  amount_refunded_paise integer not null default 0 check (amount_refunded_paise >= 0),
  payment_due_by timestamptz,
  cancel_requested_at timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 500),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_order check (end_at > start_at),
  constraint bookings_refund_le_paid check (amount_refunded_paise <= amount_paid_paise),
  constraint bookings_package_ref check (booking_type <> 'package' or package_id is not null),
  constraint bookings_cab_ref check (booking_type <> 'cab' or cab_route_id is not null),
  constraint bookings_idempotency unique (customer_id, idempotency_key)
);
create index bookings_customer_idx on public.bookings (customer_id, start_at desc);
create index bookings_status_start_idx on public.bookings (status, start_at);
create index bookings_class_period_idx on public.bookings using gist (vehicle_class, tstzrange(start_at, end_at, '[)'));
create index bookings_pending_due_idx on public.bookings (payment_due_by) where status = 'pending';
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  status public.booking_status,
  note text not null,
  visible_to_customer boolean not null default true,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

-- Concrete vehicle + driver allocations. Exclusion constraints make overlapping
-- active allocations of the same vehicle or driver impossible, even under concurrency.
create table public.vehicle_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  driver_id uuid not null references public.drivers (id) on delete restrict,
  period tstzrange not null check (not isempty(period)),
  is_active boolean not null default true,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  constraint vehicle_assignments_no_vehicle_overlap
    exclude using gist (vehicle_id with =, period with &&) where (is_active),
  constraint vehicle_assignments_no_driver_overlap
    exclude using gist (driver_id with =, period with &&) where (is_active)
);
create unique index vehicle_assignments_one_active_per_booking
  on public.vehicle_assignments (booking_id) where is_active;
create index vehicle_assignments_driver_idx on public.vehicle_assignments (driver_id);

create table public.coupon_redemptions (
  coupon_id uuid not null references public.coupons (id) on delete restrict,
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  customer_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_customer_idx on public.coupon_redemptions (coupon_id, customer_id);

-- ---------------------------------------------------------------------------
-- Payments & refunds (no card data is ever stored)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  provider text not null default 'razorpay' check (provider in ('razorpay')),
  provider_order_id text not null unique,
  provider_payment_id text unique,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status public.payment_status not null default 'created',
  method text,
  failure_code text,
  failure_reason text,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_booking_idx on public.payments (booking_id, created_at desc);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Every webhook delivery is recorded once; the unique key gives idempotency.
create table public.payment_webhook_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  unique (provider, event_id)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete restrict,
  payment_id uuid not null references public.payments (id) on delete restrict,
  amount_paise integer not null check (amount_paise > 0),
  reason text not null check (char_length(reason) <= 500),
  status public.refund_status not null default 'requested',
  provider_refund_id text unique,
  requested_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  failure_reason text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_booking_idx on public.refunds (booking_id);
create index refunds_status_idx on public.refunds (status, created_at);
create trigger refunds_updated_at before update on public.refunds
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Reviews — only from customers with a completed booking (enforced by RLS).
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete restrict,
  customer_id uuid references public.profiles (id) on delete set null,
  display_name text not null check (char_length(display_name) between 2 and 60),
  rating integer not null check (rating between 1 and 5),
  title text check (char_length(title) <= 120),
  body text not null check (char_length(body) between 10 and 2000),
  status public.moderation_status not null default 'pending',
  moderated_by uuid references public.profiles (id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now()
);
create index reviews_status_idx on public.reviews (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Notifications log (email / WhatsApp)
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  channel text not null check (channel in ('email', 'whatsapp')),
  template text not null,
  recipient text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notifications_status_idx on public.notifications (status, created_at desc);
create index notifications_booking_idx on public.notifications (booking_id);

-- ---------------------------------------------------------------------------
-- Customer support & custom itinerary requests
-- ---------------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid references public.profiles (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  email text not null,
  phone text check (phone is null or phone ~ '^\+?[0-9]{10,15}$'),
  category text not null default 'general' check (category in ('general', 'booking', 'payment', 'cancellation', 'feedback', 'privacy')),
  subject text not null check (char_length(subject) between 3 and 160),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_customer_idx on public.support_tickets (customer_id, created_at desc);
create index support_tickets_status_idx on public.support_tickets (status, created_at desc);
create trigger support_tickets_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table public.ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  is_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

create table public.itinerary_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 2 and 120),
  email text not null,
  phone text not null check (phone ~ '^\+?[0-9]{10,15}$'),
  travel_start date not null,
  travel_end date not null,
  passengers integer not null check (passengers between 1 and 60),
  pickup_city text not null check (char_length(pickup_city) <= 120),
  places text[] not null default '{}',
  preferred_vehicle public.vehicle_class,
  budget_note text check (char_length(budget_note) <= 300),
  details text check (char_length(details) <= 3000),
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'converted', 'closed')),
  staff_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint itinerary_dates check (travel_end >= travel_start)
);
create index itinerary_requests_status_idx on public.itinerary_requests (status, created_at desc);
create trigger itinerary_requests_updated_at before update on public.itinerary_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privacy: consent records (append-only) and data-subject requests (DPDP Act 2023)
-- ---------------------------------------------------------------------------
create table public.consent_records (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  anonymous_id text check (char_length(anonymous_id) <= 64),
  purpose text not null check (purpose in ('analytics', 'marketing', 'whatsapp_updates', 'booking_terms')),
  granted boolean not null,
  policy_version text not null,
  source text not null check (source in ('cookie_banner', 'signup', 'booking', 'account_settings')),
  ip_hash text,
  user_agent text check (char_length(user_agent) <= 400),
  created_at timestamptz not null default now(),
  constraint consent_subject check (user_id is not null or anonymous_id is not null)
);
create index consent_records_user_idx on public.consent_records (user_id, purpose, created_at desc);

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  request_type text not null check (request_type in ('access', 'correction', 'deletion', 'withdraw_consent')),
  details text check (char_length(details) <= 2000),
  status text not null default 'received' check (status in ('received', 'in_progress', 'completed', 'rejected')),
  response_note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index data_requests_status_idx on public.data_requests (status, created_at);

-- ---------------------------------------------------------------------------
-- Fixed-window rate limiting (works on serverless without Redis)
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);
