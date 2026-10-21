-- =============================================================================
-- Row-level security, grants, audit logging and storage
-- Principle: anon/authenticated get the minimum privileges; anything involving
-- money, pricing or availability is written only by trusted server code.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Reset default privileges: grant explicitly per table below.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Helper functions used inside RLS policies must be executable by API roles.
grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
-- Staff/driver RPCs perform their own permission checks.
grant execute on function public.assign_vehicle(uuid, uuid, uuid) to authenticated;
grant execute on function public.update_trip_status(uuid, public.booking_status) to authenticated;
grant execute on function public.admin_overview() to authenticated;

-- Enable RLS on every table.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone, whatsapp_opt_in, marketing_opt_in) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.has_permission('customers.read'));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()) and anonymized_at is null)
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Staff & permissions
-- ---------------------------------------------------------------------------
grant select on public.staff_members, public.role_permissions to authenticated;
grant insert, update, delete on public.staff_members to authenticated;

create policy staff_select on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('staff.manage'));
create policy staff_insert on public.staff_members for insert to authenticated
  with check (public.has_permission('staff.manage'));
create policy staff_update on public.staff_members for update to authenticated
  using (public.has_permission('staff.manage')) with check (public.has_permission('staff.manage'));
create policy staff_delete on public.staff_members for delete to authenticated
  using (public.has_permission('staff.manage'));
create policy role_permissions_select on public.role_permissions for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Public catalog: anyone reads published rows; managers write.
-- ---------------------------------------------------------------------------
grant select on public.destinations, public.packages, public.package_destinations, public.package_prices,
  public.vehicle_rates, public.cab_routes, public.blog_posts, public.faqs to anon, authenticated;
grant insert, update, delete on public.destinations, public.packages, public.package_destinations,
  public.package_prices, public.vehicle_rates, public.cab_routes, public.blog_posts, public.faqs,
  public.pricing_rules, public.coupons to authenticated;
grant select on public.pricing_rules, public.coupons to authenticated;

create policy destinations_public_read on public.destinations for select to anon, authenticated
  using (is_published or public.has_permission('catalog.manage'));
create policy destinations_manage on public.destinations for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));

create policy packages_public_read on public.packages for select to anon, authenticated
  using (is_published or public.has_permission('catalog.manage'));
create policy packages_manage on public.packages for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));

create policy package_destinations_read on public.package_destinations for select to anon, authenticated
  using (exists (select 1 from public.packages p where p.id = package_id
                 and (p.is_published or public.has_permission('catalog.manage'))));
create policy package_destinations_manage on public.package_destinations for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));

create policy package_prices_read on public.package_prices for select to anon, authenticated
  using (exists (select 1 from public.packages p where p.id = package_id
                 and (p.is_published or public.has_permission('catalog.manage'))));
create policy package_prices_manage on public.package_prices for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));

create policy vehicle_rates_read on public.vehicle_rates for select to anon, authenticated
  using (is_active or public.has_permission('fleet.manage'));
create policy vehicle_rates_manage on public.vehicle_rates for all to authenticated
  using (public.has_permission('fleet.manage')) with check (public.has_permission('fleet.manage'));

create policy cab_routes_read on public.cab_routes for select to anon, authenticated
  using (is_active or public.has_permission('catalog.manage'));
create policy cab_routes_manage on public.cab_routes for all to authenticated
  using (public.has_permission('catalog.manage')) with check (public.has_permission('catalog.manage'));

create policy blog_public_read on public.blog_posts for select to anon, authenticated
  using ((status = 'published' and published_at <= now()) or public.has_permission('content.manage'));
create policy blog_manage on public.blog_posts for all to authenticated
  using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

create policy faqs_public_read on public.faqs for select to anon, authenticated
  using (is_published or public.has_permission('content.manage'));
create policy faqs_manage on public.faqs for all to authenticated
  using (public.has_permission('content.manage')) with check (public.has_permission('content.manage'));

create policy pricing_rules_manage on public.pricing_rules for all to authenticated
  using (public.has_permission('coupons.manage')) with check (public.has_permission('coupons.manage'));
create policy coupons_manage on public.coupons for all to authenticated
  using (public.has_permission('coupons.manage')) with check (public.has_permission('coupons.manage'));

-- ---------------------------------------------------------------------------
-- Site settings
-- ---------------------------------------------------------------------------
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;
create policy site_settings_read on public.site_settings for select to anon, authenticated
  using (is_public or public.has_permission('settings.manage'));
create policy site_settings_manage_insert on public.site_settings for insert to authenticated
  with check (public.has_permission('settings.manage'));
create policy site_settings_manage_update on public.site_settings for update to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

-- ---------------------------------------------------------------------------
-- Fleet
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.vehicles, public.drivers to authenticated;
create policy vehicles_staff_read on public.vehicles for select to authenticated
  using (public.has_permission('bookings.read') or public.has_permission('fleet.manage'));
create policy vehicles_manage on public.vehicles for all to authenticated
  using (public.has_permission('fleet.manage')) with check (public.has_permission('fleet.manage'));

create policy drivers_staff_read on public.drivers for select to authenticated
  using (public.has_permission('bookings.read') or public.has_permission('fleet.manage')
         or user_id = (select auth.uid()));
create policy drivers_manage on public.drivers for all to authenticated
  using (public.has_permission('fleet.manage')) with check (public.has_permission('fleet.manage'));

-- ---------------------------------------------------------------------------
-- Bookings: customers read their own; staff read/manage; drivers read assigned trips.
-- Customers never insert/update directly (server code + RPCs do).
-- ---------------------------------------------------------------------------
create or replace function public.is_assigned_driver(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicle_assignments va
    join public.drivers d on d.id = va.driver_id
    where va.booking_id = p_booking_id and va.is_active and d.user_id = auth.uid()
  );
$$;
grant execute on function public.is_assigned_driver(uuid) to authenticated;

grant select on public.bookings, public.booking_events, public.vehicle_assignments to authenticated;
grant update (special_requests, pickup_location, drop_location) on public.bookings to authenticated;

create policy bookings_select on public.bookings for select to authenticated
  using (customer_id = (select auth.uid())
         or public.has_permission('bookings.read')
         or public.is_assigned_driver(id));
-- Staff may edit operational notes; status transitions with side effects go through RPCs.
create policy bookings_staff_update on public.bookings for update to authenticated
  using (public.has_permission('bookings.manage')) with check (public.has_permission('bookings.manage'));

create policy booking_events_select on public.booking_events for select to authenticated
  using (
    public.has_permission('bookings.read')
    or (visible_to_customer and exists (
          select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid())))
  );

create policy vehicle_assignments_select on public.vehicle_assignments for select to authenticated
  using (public.has_permission('bookings.read')
         or exists (select 1 from public.drivers d where d.id = driver_id and d.user_id = (select auth.uid())));

-- Customers see the vehicle/driver assigned to their own booking via a narrow view.
create view public.my_trip_assignments with (security_invoker = false) as
  select va.booking_id, v.model as vehicle_model, v.registration_number, d.full_name as driver_name, d.phone as driver_phone
  from public.vehicle_assignments va
  join public.vehicles v on v.id = va.vehicle_id
  join public.drivers d on d.id = va.driver_id
  join public.bookings b on b.id = va.booking_id
  where va.is_active and b.customer_id = auth.uid() and b.status in ('assigned', 'in_progress');
revoke all on public.my_trip_assignments from anon, authenticated, public;
grant select on public.my_trip_assignments to authenticated;

-- ---------------------------------------------------------------------------
-- Coupons redemptions, payments, refunds, webhook events
-- ---------------------------------------------------------------------------
grant select on public.payments, public.refunds, public.coupon_redemptions to authenticated;
create policy payments_select on public.payments for select to authenticated
  using (public.has_permission('payments.read')
         or exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid())));
create policy refunds_select on public.refunds for select to authenticated
  using (public.has_permission('payments.read') or public.has_permission('refunds.manage')
         or exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid())));
create policy coupon_redemptions_select on public.coupon_redemptions for select to authenticated
  using (customer_id = (select auth.uid()) or public.has_permission('coupons.manage'));

grant select on public.payment_webhook_events to authenticated;
create policy webhook_events_select on public.payment_webhook_events for select to authenticated
  using (public.has_permission('payments.read'));

-- ---------------------------------------------------------------------------
-- Reviews: public sees approved; customers submit for their completed bookings.
-- ---------------------------------------------------------------------------
grant select on public.reviews to anon, authenticated;
grant insert (booking_id, customer_id, display_name, rating, title, body) on public.reviews to authenticated;
grant update (status, moderated_by, moderated_at) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;

create policy reviews_public_read on public.reviews for select to anon, authenticated
  using (status = 'approved' or customer_id = (select auth.uid()) or public.has_permission('reviews.manage'));
create policy reviews_customer_insert on public.reviews for insert to authenticated
  with check (
    customer_id = (select auth.uid())
    and status = 'pending'
    and exists (select 1 from public.bookings b
                where b.id = booking_id and b.customer_id = (select auth.uid()) and b.status = 'completed')
  );
create policy reviews_moderate on public.reviews for update to authenticated
  using (public.has_permission('reviews.manage')) with check (public.has_permission('reviews.manage'));
create policy reviews_delete on public.reviews for delete to authenticated
  using (public.has_permission('reviews.manage'));

-- Public testimonials expose no customer identifiers.
create view public.public_testimonials with (security_invoker = false) as
  select r.id, r.display_name, r.rating, r.title, r.body, r.created_at, b.booking_type
  from public.reviews r join public.bookings b on b.id = r.booking_id
  where r.status = 'approved';
revoke all on public.public_testimonials from anon, authenticated, public;
grant select on public.public_testimonials to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notifications (staff read), support, itinerary requests
-- ---------------------------------------------------------------------------
grant select on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated
  using (public.has_permission('bookings.read') or user_id = (select auth.uid()));

grant select, update on public.support_tickets to authenticated;
create policy tickets_select on public.support_tickets for select to authenticated
  using (customer_id = (select auth.uid()) or public.has_permission('support.manage'));
create policy tickets_staff_update on public.support_tickets for update to authenticated
  using (public.has_permission('support.manage')) with check (public.has_permission('support.manage'));

grant select on public.ticket_messages to authenticated;
grant insert (ticket_id, author_id, is_staff, body) on public.ticket_messages to authenticated;
create policy ticket_messages_select on public.ticket_messages for select to authenticated
  using (public.has_permission('support.manage')
         or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.customer_id = (select auth.uid())));
create policy ticket_messages_customer_insert on public.ticket_messages for insert to authenticated
  with check (
    author_id = (select auth.uid()) and not is_staff
    and exists (select 1 from public.support_tickets t
                where t.id = ticket_id and t.customer_id = (select auth.uid()) and t.status <> 'closed')
  );
create policy ticket_messages_staff_insert on public.ticket_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and is_staff and public.has_permission('support.manage'));

grant select, update on public.itinerary_requests to authenticated;
create policy itinerary_select on public.itinerary_requests for select to authenticated
  using (customer_id = (select auth.uid()) or public.has_permission('bookings.read'));
create policy itinerary_staff_update on public.itinerary_requests for update to authenticated
  using (public.has_permission('bookings.manage')) with check (public.has_permission('bookings.manage'));

-- ---------------------------------------------------------------------------
-- Privacy
-- ---------------------------------------------------------------------------
grant select on public.consent_records to authenticated;
create policy consent_select on public.consent_records for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('customers.read'));

grant select, insert (request_type, details, user_id) on public.data_requests to authenticated;
grant update (status, response_note, resolved_by, resolved_at) on public.data_requests to authenticated;
create policy data_requests_select on public.data_requests for select to authenticated
  using (user_id = (select auth.uid()) or public.has_permission('customers.read'));
create policy data_requests_insert on public.data_requests for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy data_requests_staff_update on public.data_requests for update to authenticated
  using (public.has_permission('settings.manage')) with check (public.has_permission('settings.manage'));

-- rate_limits: no API access at all (RLS enabled, no policies, no grants).

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated, public;
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.has_permission('audit.read'));

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid);
  v_row jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    v_actor,
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'user_id', v_row ->> 'vehicle_class', v_row ->> 'booking_id'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

do $$
declare
  t text;
begin
  foreach t in array array[
    'staff_members', 'destinations', 'packages', 'package_prices', 'vehicle_rates', 'cab_routes',
    'pricing_rules', 'coupons', 'site_settings', 'blog_posts', 'faqs', 'vehicles', 'drivers',
    'bookings', 'vehicle_assignments', 'payments', 'refunds', 'reviews', 'data_requests'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row_change()',
      t || '_audit', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: public media (images only, 5 MB) — staff with catalog/content rights upload.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy media_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media'
              and (public.has_permission('catalog.manage') or public.has_permission('content.manage')));
create policy media_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'media'
         and (public.has_permission('catalog.manage') or public.has_permission('content.manage')));
create policy media_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media'
         and (public.has_permission('catalog.manage') or public.has_permission('content.manage')));
