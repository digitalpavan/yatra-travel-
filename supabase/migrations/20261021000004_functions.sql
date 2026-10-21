-- =============================================================================
-- Transactional functions. Functions marked "service role only" are called by
-- trusted server code after authentication, validation and server-side pricing.
-- =============================================================================

-- Unique, human-friendly reference: YT<yymmdd>-<5 chars> (no ambiguous 0/O/1/I).
create or replace function public.generate_reference()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(5);
  v_suffix text := '';
begin
  for i in 0..4 loop
    v_suffix := v_suffix || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return 'YT' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' || v_suffix;
end;
$$;

-- Attribute changes made by trusted server code to the acting user in audit logs.
create or replace function public.set_actor(p_actor uuid)
returns void
language sql
set search_path = ''
as $$
  select set_config('app.actor_id', coalesce(p_actor::text, ''), true);
$$;

-- ---------------------------------------------------------------------------
-- Availability
-- Capacity per vehicle class = active vehicles − overlapping commitments, where
-- commitments are (a) unassigned bookings that are confirmed or hold an unexpired
-- payment window, plus (b) active vehicle assignments of vehicles in that class.
-- ---------------------------------------------------------------------------
create or replace function public.available_vehicle_count(
  p_class public.vehicle_class,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_booking uuid default null
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with fleet as (
    select count(*)::int as n from public.vehicles v
    where v.vehicle_class = p_class and v.status = 'active'
  ),
  unassigned as (
    select count(*)::int as n from public.bookings b
    where b.vehicle_class = p_class
      and (b.id is distinct from p_exclude_booking)
      and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start, p_end, '[)')
      and (
        b.status in ('confirmed', 'assigned', 'in_progress')
        or (b.status = 'pending' and b.payment_due_by > now())
      )
      and not exists (
        select 1 from public.vehicle_assignments va where va.booking_id = b.id and va.is_active
      )
  ),
  assigned as (
    select count(*)::int as n from public.vehicle_assignments va
    join public.vehicles v on v.id = va.vehicle_id
    where v.vehicle_class = p_class
      and va.is_active
      and (va.booking_id is distinct from p_exclude_booking)
      and va.period && tstzrange(p_start, p_end, '[)')
  )
  select greatest(0, fleet.n - unassigned.n - assigned.n) from fleet, unassigned, assigned;
$$;

-- ---------------------------------------------------------------------------
-- create_booking (service role only)
-- p jsonb: server-validated booking fields with server-computed prices.
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(p jsonb, p_coupon_id uuid default null)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.vehicle_class := (p ->> 'vehicle_class')::public.vehicle_class;
  v_start timestamptz := (p ->> 'start_at')::timestamptz;
  v_end timestamptz := (p ->> 'end_at')::timestamptz;
  v_customer uuid := (p ->> 'customer_id')::uuid;
  v_existing public.bookings;
  v_booking public.bookings;
  v_coupon public.coupons;
  v_redemptions integer;
  v_attempt integer := 0;
begin
  if v_customer is null then
    raise exception 'customer_id is required' using errcode = '22023';
  end if;

  perform public.set_actor(v_customer);

  -- Idempotent retries (double-click, network retry) return the original booking.
  if p ? 'idempotency_key' then
    select * into v_existing from public.bookings
    where customer_id = v_customer and idempotency_key = p ->> 'idempotency_key';
    if found then
      return v_existing;
    end if;
  end if;

  -- Serialise capacity checks per vehicle class so concurrent requests cannot oversell.
  perform pg_advisory_xact_lock(hashtext('vehicle_class:' || v_class::text));

  if public.available_vehicle_count(v_class, v_start, v_end) < 1 then
    raise exception 'No vehicle of this type is available for the selected dates'
      using errcode = 'P0001', hint = 'NO_AVAILABILITY';
  end if;

  if p_coupon_id is not null then
    select * into v_coupon from public.coupons where id = p_coupon_id for update;
    if not found or not v_coupon.is_active
       or now() < v_coupon.valid_from
       or (v_coupon.valid_until is not null and now() > v_coupon.valid_until)
       or (v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit) then
      raise exception 'Coupon is no longer valid' using errcode = 'P0001', hint = 'COUPON_INVALID';
    end if;
    select count(*) into v_redemptions from public.coupon_redemptions
    where coupon_id = p_coupon_id and customer_id = v_customer;
    if v_redemptions >= v_coupon.per_customer_limit then
      raise exception 'Coupon usage limit reached for this account' using errcode = 'P0001', hint = 'COUPON_LIMIT';
    end if;
  end if;

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.bookings (
        reference, customer_id, idempotency_key, booking_type, trip_type, package_id, cab_route_id,
        vehicle_class, pickup_location, drop_location, start_at, end_at, trip_days, passengers,
        luggage_bags, special_requests, contact_name, contact_phone, contact_email, status,
        coupon_id, price_breakdown, subtotal_paise, adjustment_paise, discount_paise, tax_paise,
        total_paise, payment_due_by
      ) values (
        public.generate_reference(), v_customer, p ->> 'idempotency_key',
        (p ->> 'booking_type')::public.booking_type, (p ->> 'trip_type')::public.trip_type,
        (p ->> 'package_id')::uuid, (p ->> 'cab_route_id')::uuid, v_class,
        p ->> 'pickup_location', p ->> 'drop_location', v_start, v_end,
        coalesce((p ->> 'trip_days')::int, 1), (p ->> 'passengers')::int,
        coalesce((p ->> 'luggage_bags')::int, 0), nullif(p ->> 'special_requests', ''),
        p ->> 'contact_name', p ->> 'contact_phone', p ->> 'contact_email', 'pending',
        p_coupon_id, p -> 'price_breakdown', (p ->> 'subtotal_paise')::int,
        coalesce((p ->> 'adjustment_paise')::int, 0), coalesce((p ->> 'discount_paise')::int, 0),
        coalesce((p ->> 'tax_paise')::int, 0), (p ->> 'total_paise')::int,
        now() + make_interval(mins => coalesce((p ->> 'hold_minutes')::int, 30))
      )
      returning * into v_booking;
      exit;
    exception when unique_violation then
      -- Reference collision (extremely rare): retry with a new reference.
      if v_attempt >= 5 then
        raise;
      end if;
    end;
  end loop;

  if p_coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, booking_id, customer_id)
    values (p_coupon_id, v_booking.id, v_customer);
    update public.coupons set used_count = used_count + 1 where id = p_coupon_id;
  end if;

  insert into public.booking_events (booking_id, status, note, actor_id)
  values (v_booking.id, 'pending', 'Booking created — awaiting payment', v_customer);

  return v_booking;
end;
$$;

-- Release a coupon redemption when an unpaid booking is cancelled/expired.
create or replace function public.release_coupon(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon uuid;
begin
  delete from public.coupon_redemptions where booking_id = p_booking_id returning coupon_id into v_coupon;
  if v_coupon is not null then
    update public.coupons set used_count = greatest(0, used_count - 1) where id = v_coupon;
  end if;
end;
$$;

-- Cancel unpaid bookings whose payment window has passed (run by cron).
create or replace function public.expire_pending_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select b.id from public.bookings b
    where b.status = 'pending' and b.payment_due_by < now()
      and not exists (select 1 from public.payments p where p.booking_id = b.id and p.status = 'captured')
    for update skip locked
  loop
    update public.bookings
      set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Payment not completed within the hold period'
      where id = v_row.id;
    perform public.release_coupon(v_row.id);
    insert into public.booking_events (booking_id, status, note)
    values (v_row.id, 'cancelled', 'Booking expired because payment was not completed in time');
    v_count := v_count + 1;
  end loop;

  delete from public.rate_limits where window_start < now() - interval '1 day';
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments (service role only). Idempotent: safe for webhook re-deliveries and
-- for the client-side verify call racing the webhook.
-- ---------------------------------------------------------------------------
create or replace function public.record_payment_captured(
  p_order_id text,
  p_payment_id text,
  p_amount_paise integer,
  p_method text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments;
  v_booking public.bookings;
begin
  select * into v_payment from public.payments where provider_order_id = p_order_id for update;
  if not found then
    raise exception 'Unknown payment order %', p_order_id using errcode = 'P0002';
  end if;

  if v_payment.status in ('captured', 'refunded', 'partially_refunded') then
    return jsonb_build_object('outcome', 'already_processed', 'booking_id', v_payment.booking_id);
  end if;

  if p_amount_paise <> v_payment.amount_paise then
    raise exception 'Captured amount % does not match order amount %', p_amount_paise, v_payment.amount_paise
      using errcode = 'P0001', hint = 'AMOUNT_MISMATCH';
  end if;

  update public.payments
    set status = 'captured', provider_payment_id = p_payment_id, method = p_method,
        captured_at = now(), failure_code = null, failure_reason = null
    where id = v_payment.id;

  select * into v_booking from public.bookings where id = v_payment.booking_id for update;
  update public.bookings set amount_paid_paise = amount_paid_paise + p_amount_paise where id = v_booking.id;

  if v_booking.status = 'pending' and v_booking.payment_due_by > now() then
    -- Capacity was held for this booking until payment_due_by.
    update public.bookings set status = 'confirmed', payment_due_by = null where id = v_booking.id;
    insert into public.booking_events (booking_id, status, note)
    values (v_booking.id, 'confirmed', 'Payment received — booking confirmed');
    return jsonb_build_object('outcome', 'confirmed', 'booking_id', v_booking.id);
  end if;

  if (v_booking.status = 'pending'
      or (v_booking.status = 'cancelled' and v_booking.cancelled_by is null))
     and v_booking.start_at > now() then
    -- Payment arrived after the hold lapsed. Confirm only if capacity still exists.
    perform pg_advisory_xact_lock(hashtext('vehicle_class:' || v_booking.vehicle_class::text));
    if public.available_vehicle_count(v_booking.vehicle_class, v_booking.start_at, v_booking.end_at, v_booking.id) > 0 then
      update public.bookings
        set status = 'confirmed', payment_due_by = null, cancelled_at = null, cancel_reason = null
        where id = v_booking.id;
      insert into public.booking_events (booking_id, status, note)
      values (v_booking.id, 'confirmed', 'Late payment received — booking reinstated and confirmed');
      return jsonb_build_object('outcome', 'confirmed', 'booking_id', v_booking.id);
    end if;
  end if;

  -- Booking cannot accept this payment (cancelled with no capacity, or already paid):
  -- queue a full refund of this payment for staff to process.
  insert into public.refunds (booking_id, payment_id, amount_paise, reason, status)
  values (v_booking.id, v_payment.id, p_amount_paise,
          case when v_booking.status = 'cancelled'
               then 'Payment received after booking was cancelled; no vehicle available'
               else 'Duplicate payment for an already-paid booking' end,
          'approved');
  if v_booking.status in ('pending', 'cancelled') then
    update public.bookings
      set status = 'refund_pending', cancelled_at = coalesce(cancelled_at, now()),
          cancel_reason = coalesce(cancel_reason, 'Payment received after the hold expired; no vehicle available')
      where id = v_booking.id;
    perform public.release_coupon(v_booking.id);
  end if;
  insert into public.booking_events (booking_id, status, note)
  values (v_booking.id, case when v_booking.status in ('pending', 'cancelled') then 'refund_pending'::public.booking_status end,
          'Payment received but could not be applied — a full refund has been queued');
  return jsonb_build_object('outcome', 'refund_required', 'booking_id', v_booking.id);
end;
$$;

create or replace function public.record_payment_failed(
  p_order_id text,
  p_payment_id text,
  p_code text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payments
    set status = 'failed',
        provider_payment_id = coalesce(provider_payment_id, p_payment_id),
        failure_code = left(p_code, 100),
        failure_reason = left(p_reason, 500)
    where provider_order_id = p_order_id and status in ('created', 'authorized');
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancellation (service role only; refund amount computed by server policy)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_actor uuid,
  p_reason text,
  p_refund_paise integer
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_payment public.payments;
begin
  perform public.set_actor(p_actor);
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_booking.status not in ('pending', 'confirmed', 'assigned') then
    raise exception 'Booking cannot be cancelled in status %', v_booking.status
      using errcode = 'P0001', hint = 'INVALID_STATUS';
  end if;

  update public.vehicle_assignments set is_active = false, released_at = now()
    where booking_id = v_booking.id and is_active;

  if v_booking.amount_paid_paise = 0 then
    update public.bookings
      set status = 'cancelled', cancelled_at = now(), cancelled_by = p_actor,
          cancel_reason = p_reason, cancel_requested_at = coalesce(cancel_requested_at, now())
      where id = v_booking.id returning * into v_booking;
    perform public.release_coupon(v_booking.id);
    insert into public.booking_events (booking_id, status, note, actor_id)
    values (v_booking.id, 'cancelled', 'Booking cancelled', p_actor);
    return v_booking;
  end if;

  if p_refund_paise < 0 or p_refund_paise > v_booking.amount_paid_paise - v_booking.amount_refunded_paise then
    raise exception 'Invalid refund amount' using errcode = '22023';
  end if;

  if p_refund_paise = 0 then
    update public.bookings
      set status = 'cancelled', cancelled_at = now(), cancelled_by = p_actor,
          cancel_reason = p_reason, cancel_requested_at = coalesce(cancel_requested_at, now())
      where id = v_booking.id returning * into v_booking;
    insert into public.booking_events (booking_id, status, note, actor_id)
    values (v_booking.id, 'cancelled', 'Booking cancelled — not eligible for a refund under the cancellation policy', p_actor);
    return v_booking;
  end if;

  select * into v_payment from public.payments
    where booking_id = v_booking.id and status in ('captured', 'partially_refunded')
    order by captured_at desc limit 1;
  if not found then
    raise exception 'No captured payment to refund' using errcode = 'P0001', hint = 'NO_PAYMENT';
  end if;

  insert into public.refunds (booking_id, payment_id, amount_paise, reason, status, requested_by)
  values (v_booking.id, v_payment.id, p_refund_paise, coalesce(p_reason, 'Customer cancellation'), 'requested', p_actor);

  update public.bookings
    set status = 'refund_pending', cancelled_at = now(), cancelled_by = p_actor,
        cancel_reason = p_reason, cancel_requested_at = coalesce(cancel_requested_at, now())
    where id = v_booking.id returning * into v_booking;
  insert into public.booking_events (booking_id, status, note, actor_id)
  values (v_booking.id, 'refund_pending',
          format('Booking cancelled — refund of ₹%s requested', to_char(p_refund_paise / 100.0, 'FM999999990.00')), p_actor);
  return v_booking;
end;
$$;

-- Refund lifecycle (service role only), idempotent on provider_refund_id.
-- Claims the refund (returns false if another request already claimed it) so the
-- gateway refund API is called at most once per claim.
create or replace function public.mark_refund_processing(p_refund_id uuid, p_provider_refund_id text, p_actor uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.set_actor(p_actor);
  update public.refunds
    set status = 'processing', provider_refund_id = p_provider_refund_id, reviewed_by = p_actor,
        failure_reason = null
    where id = p_refund_id and status in ('requested', 'approved', 'failed');
  return found;
end;
$$;

create or replace function public.set_refund_provider_id(p_refund_id uuid, p_provider_refund_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.refunds set provider_refund_id = p_provider_refund_id
  where id = p_refund_id and provider_refund_id is null;
$$;

create or replace function public.reject_refund(p_refund_id uuid, p_actor uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.refunds;
begin
  perform public.set_actor(p_actor);
  update public.refunds set status = 'rejected', reviewed_by = p_actor, failure_reason = left(p_reason, 500)
    where id = p_refund_id and status in ('requested', 'approved', 'failed')
    returning * into v_refund;
  if found then
    update public.bookings set status = 'cancelled' where id = v_refund.booking_id and status = 'refund_pending'
      and not exists (select 1 from public.refunds r where r.booking_id = v_refund.booking_id
                      and r.id <> v_refund.id and r.status in ('requested', 'approved', 'processing'));
    insert into public.booking_events (booking_id, note, actor_id)
    values (v_refund.booking_id, 'Refund request reviewed and declined: ' || left(p_reason, 300), p_actor);
  end if;
end;
$$;

create or replace function public.record_refund_processed(p_provider_refund_id text, p_refund_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_refund public.refunds;
  v_payment public.payments;
  v_total_refunded integer;
begin
  select * into v_refund from public.refunds
    where provider_refund_id = p_provider_refund_id or (p_refund_id is not null and id = p_refund_id)
    for update;
  if not found then
    raise exception 'Unknown refund %', p_provider_refund_id using errcode = 'P0002';
  end if;
  if v_refund.status = 'processed' then
    return jsonb_build_object('outcome', 'already_processed');
  end if;

  update public.refunds
    set status = 'processed', provider_refund_id = coalesce(provider_refund_id, p_provider_refund_id),
        processed_at = now(), failure_reason = null
    where id = v_refund.id;

  select * into v_payment from public.payments where id = v_refund.payment_id for update;
  select coalesce(sum(amount_paise), 0) into v_total_refunded
    from public.refunds where payment_id = v_payment.id and status = 'processed';
  update public.payments
    set status = case when v_total_refunded >= v_payment.amount_paise then 'refunded' else 'partially_refunded' end::public.payment_status
    where id = v_payment.id;

  update public.bookings
    set amount_refunded_paise = amount_refunded_paise + v_refund.amount_paise,
        status = case when status = 'refund_pending' then 'refunded'::public.booking_status else status end
    where id = v_refund.booking_id;
  insert into public.booking_events (booking_id, status, note)
  select v_refund.booking_id, b.status,
         format('Refund of ₹%s processed by the payment gateway', to_char(v_refund.amount_paise / 100.0, 'FM999999990.00'))
  from public.bookings b where b.id = v_refund.booking_id;
  return jsonb_build_object('outcome', 'processed');
end;
$$;

create or replace function public.record_refund_failed(p_provider_refund_id text, p_reason text, p_refund_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.refunds
    set status = 'failed', failure_reason = left(p_reason, 500),
        provider_refund_id = coalesce(provider_refund_id, p_provider_refund_id)
    where (provider_refund_id = p_provider_refund_id or (p_refund_id is not null and id = p_refund_id))
      and status <> 'processed';
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff/driver operations (callable by authenticated users; permission checked inside)
-- ---------------------------------------------------------------------------
create or replace function public.assign_vehicle(p_booking_id uuid, p_vehicle_id uuid, p_driver_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_vehicle public.vehicles;
  v_driver public.drivers;
  v_assignment_id uuid;
begin
  if not public.has_permission('bookings.manage') then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if v_booking.status not in ('confirmed', 'assigned') then
    raise exception 'Only confirmed bookings can be assigned (current: %)', v_booking.status
      using errcode = 'P0001', hint = 'INVALID_STATUS';
  end if;

  select * into v_vehicle from public.vehicles where id = p_vehicle_id;
  if not found or v_vehicle.status <> 'active' then
    raise exception 'Vehicle is not active' using errcode = 'P0001', hint = 'VEHICLE_INACTIVE';
  end if;
  if v_vehicle.seats < v_booking.passengers then
    raise exception 'Vehicle has % seats but booking has % passengers', v_vehicle.seats, v_booking.passengers
      using errcode = 'P0001', hint = 'VEHICLE_TOO_SMALL';
  end if;

  select * into v_driver from public.drivers where id = p_driver_id;
  if not found or v_driver.status <> 'active' then
    raise exception 'Driver is not active' using errcode = 'P0001', hint = 'DRIVER_INACTIVE';
  end if;

  update public.vehicle_assignments set is_active = false, released_at = now()
    where booking_id = p_booking_id and is_active;

  begin
    insert into public.vehicle_assignments (booking_id, vehicle_id, driver_id, period, assigned_by)
    values (p_booking_id, p_vehicle_id, p_driver_id,
            tstzrange(v_booking.start_at, v_booking.end_at, '[)'), auth.uid())
    returning id into v_assignment_id;
  exception when exclusion_violation then
    raise exception 'This vehicle or driver is already allocated during the trip period'
      using errcode = 'P0001', hint = 'ALLOCATION_CONFLICT';
  end;

  update public.bookings set status = 'assigned' where id = p_booking_id;
  insert into public.booking_events (booking_id, status, note, actor_id)
  values (p_booking_id, 'assigned', 'Vehicle and driver assigned', auth.uid());
  return v_assignment_id;
end;
$$;

create or replace function public.update_trip_status(p_booking_id uuid, p_status public.booking_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_is_driver boolean;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.vehicle_assignments va
    join public.drivers d on d.id = va.driver_id
    where va.booking_id = p_booking_id and va.is_active and d.user_id = auth.uid()
  ) and public.has_permission('trips.own') into v_is_driver;

  if not (v_is_driver or public.has_permission('bookings.manage')) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if not (
    (v_booking.status = 'assigned' and p_status = 'in_progress')
    or (v_booking.status = 'in_progress' and p_status = 'completed')
  ) then
    raise exception 'Invalid status transition % -> %', v_booking.status, p_status
      using errcode = 'P0001', hint = 'INVALID_TRANSITION';
  end if;

  update public.bookings set status = p_status where id = p_booking_id;
  if p_status = 'completed' then
    update public.vehicle_assignments set released_at = now() where booking_id = p_booking_id and is_active;
  end if;
  insert into public.booking_events (booking_id, status, note, actor_id)
  values (p_booking_id, p_status,
          case p_status when 'in_progress' then 'Trip started' else 'Trip completed' end, auth.uid());
end;
$$;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.has_permission('reports.read') then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'bookings_by_status', (
      select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
      from (select status, count(*) as n from public.bookings group by status) s
    ),
    'upcoming_7_days', (
      select count(*) from public.bookings
      where status in ('confirmed', 'assigned') and start_at between now() and now() + interval '7 days'
    ),
    'unassigned_upcoming', (
      select count(*) from public.bookings where status = 'confirmed' and start_at > now()
    ),
    'captured_30_days_paise', (
      select coalesce(sum(amount_paise), 0) from public.payments
      where status in ('captured', 'refunded', 'partially_refunded') and captured_at > now() - interval '30 days'
    ),
    'refunded_30_days_paise', (
      select coalesce(sum(amount_paise), 0) from public.refunds
      where status = 'processed' and processed_at > now() - interval '30 days'
    ),
    'refunds_awaiting_action', (
      select count(*) from public.refunds where status in ('requested', 'approved', 'failed')
    ),
    'open_tickets', (select count(*) from public.support_tickets where status in ('open', 'in_progress')),
    'new_itinerary_requests', (select count(*) from public.itinerary_requests where status = 'new'),
    'pending_reviews', (select count(*) from public.reviews where status = 'pending'),
    'failed_notifications_7_days', (
      select count(*) from public.notifications where status = 'failed' and created_at > now() - interval '7 days'
    )
  ) into v_result;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (service role only). Returns true when the request is allowed.
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privacy: anonymise a customer's personal data while retaining financial records
-- required by law (service role only).
-- ---------------------------------------------------------------------------
create or replace function public.anonymize_customer(p_user_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.set_actor(p_actor);
  if exists (
    select 1 from public.bookings
    where customer_id = p_user_id and status in ('pending', 'confirmed', 'assigned', 'in_progress', 'refund_pending')
  ) then
    raise exception 'Customer has active bookings or pending refunds' using errcode = 'P0001', hint = 'ACTIVE_BOOKINGS';
  end if;

  update public.bookings
    set contact_name = 'Deleted customer', contact_phone = '0000000000',
        contact_email = 'deleted@invalid.local', special_requests = null,
        pickup_location = 'Redacted', drop_location = case when drop_location is null then null else 'Redacted' end
    where customer_id = p_user_id;
  update public.reviews set display_name = 'Verified traveller' where customer_id = p_user_id;
  update public.support_tickets
    set name = 'Deleted customer', email = 'deleted@invalid.local', phone = null
    where customer_id = p_user_id;
  update public.itinerary_requests
    set name = 'Deleted customer', email = 'deleted@invalid.local', phone = '0000000000', details = null
    where customer_id = p_user_id;
  update public.profiles
    set full_name = null, phone = null, email = null, whatsapp_opt_in = false,
        marketing_opt_in = false, anonymized_at = now()
    where id = p_user_id;
end;
$$;
