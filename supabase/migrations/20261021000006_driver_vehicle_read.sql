-- Drivers may read the vehicle on their own active assignments, so "My trips"
-- can show the registration number. No other vehicles are visible to them.
create policy vehicles_driver_read on public.vehicles
  for select to authenticated
  using (
    exists (
      select 1
      from public.vehicle_assignments va
      join public.drivers d on d.id = va.driver_id
      where va.vehicle_id = vehicles.id
        and va.is_active
        and d.user_id = (select auth.uid())
    )
  );
