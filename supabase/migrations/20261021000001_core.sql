-- =============================================================================
-- Yatra Travel — core schema: extensions, enums, profiles, staff roles, permissions
-- =============================================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('customer', 'driver', 'booking_staff', 'admin', 'owner');

create type public.booking_status as enum (
  'pending',         -- created, awaiting payment (soft hold on capacity until payment_due_by)
  'confirmed',       -- paid
  'assigned',        -- vehicle + driver allocated
  'in_progress',     -- trip started
  'completed',
  'cancelled',
  'refund_pending',  -- cancelled after payment, refund being processed
  'refunded'
);

create type public.booking_type as enum ('package', 'cab');
create type public.trip_type as enum ('one_way', 'round_trip', 'package');
create type public.vehicle_class as enum ('sedan', 'suv', 'muv', 'tempo_traveller', 'mini_bus');
create type public.payment_status as enum ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded');
create type public.refund_status as enum ('requested', 'approved', 'processing', 'processed', 'failed', 'rejected');
create type public.publish_status as enum ('draft', 'published', 'archived');
create type public.moderation_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  phone text check (phone is null or phone ~ '^\+?[0-9]{10,15}$'),
  email text,
  whatsapp_opt_in boolean not null default false,
  marketing_opt_in boolean not null default false,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), ''),
    case when (new.raw_user_meta_data ->> 'phone') ~ '^\+?[0-9]{10,15}$'
         then new.raw_user_meta_data ->> 'phone' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile email in sync with auth email.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Staff roles & permissions
-- A user with no staff_members row is a customer.
-- ---------------------------------------------------------------------------
create table public.staff_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.app_role not null check (role <> 'customer'),
  active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_members_updated_at before update on public.staff_members
  for each row execute function public.set_updated_at();

create table public.role_permissions (
  role public.app_role not null,
  permission text not null,
  primary key (role, permission)
);

-- Keep in sync with src/lib/permissions.ts (a unit test checks the TS side).
insert into public.role_permissions (role, permission)
select r.role::public.app_role, p.permission
from (values
  ('owner'), ('admin')
) as r(role)
cross join (values
  ('reports.read'), ('bookings.read'), ('bookings.manage'), ('catalog.manage'),
  ('fleet.manage'), ('payments.read'), ('refunds.manage'), ('coupons.manage'),
  ('content.manage'), ('reviews.manage'), ('support.manage'), ('customers.read'),
  ('settings.manage'), ('audit.read'), ('staff.manage')
) as p(permission);

insert into public.role_permissions (role, permission) values
  ('booking_staff', 'reports.read'),
  ('booking_staff', 'bookings.read'),
  ('booking_staff', 'bookings.manage'),
  ('booking_staff', 'payments.read'),
  ('booking_staff', 'support.manage'),
  ('booking_staff', 'customers.read'),
  ('driver', 'trips.own');

-- Current user's role ('customer' when not active staff).
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.role from public.staff_members s where s.user_id = auth.uid() and s.active),
    'customer'::public.app_role
  );
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members s
    join public.role_permissions rp on rp.role = s.role
    where s.user_id = auth.uid()
      and s.active
      and rp.permission = p_permission
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members s
    where s.user_id = auth.uid() and s.active and s.role in ('booking_staff', 'admin', 'owner')
  );
$$;

-- Only an owner may grant/revoke owner or admin; at least one active owner must remain.
create or replace function public.guard_staff_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.app_role := public.current_app_role();
begin
  -- Service role / migrations (no auth.uid()) are trusted.
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.role in ('owner', 'admin') and v_actor_role <> 'owner' then
    raise exception 'Only an owner can grant owner or admin roles' using errcode = '42501';
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.role in ('owner', 'admin') and v_actor_role <> 'owner' then
    raise exception 'Only an owner can modify owner or admin staff' using errcode = '42501';
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.user_id = auth.uid() then
    raise exception 'Staff cannot change their own role' using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger staff_members_guard
  before insert or update or delete on public.staff_members
  for each row execute function public.guard_staff_changes();

create or replace function public.ensure_an_owner_remains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.staff_members) and not exists (
    select 1 from public.staff_members where role = 'owner' and active
  ) then
    raise exception 'At least one active owner is required' using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger staff_members_owner_remains
  after update or delete on public.staff_members
  deferrable initially deferred
  for each row execute function public.ensure_an_owner_remains();
