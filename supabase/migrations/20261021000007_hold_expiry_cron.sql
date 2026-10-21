-- Expire unpaid booking holds every 10 minutes inside the database (pg_cron).
-- Capacity checks already ignore lapsed holds; this job marks them cancelled
-- and releases coupons. Vercel Cron (daily on the Hobby plan) remains a backup.
-- Skipped where pg_cron is unavailable (e.g. the PGlite test harness).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'expire-pending-bookings',
      '*/10 * * * *',
      'select public.expire_pending_bookings()'
    );
  end if;
end
$$;
