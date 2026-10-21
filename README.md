# Yatra Travel

*Your Journey, Our Devotion.*

Yatra Travel is a dynamic travel website for a Tirupati-based operator. It covers Tirumala hill transfers, temple tours, sightseeing, local and outstation cabs, and custom itineraries. It also includes online booking with Razorpay payments, a customer dashboard and a role-based admin dashboard.

> **Status: not production-ready yet.**
>
> The automated suites pass: unit tests for pricing, cancellation, validation, signatures and webhooks, plus database tests for RLS, authorization, allocation, payments and refunds. Several things have **not** been verified yet:
> - a real Supabase project
> - Razorpay test mode
> - email or WhatsApp delivery
> - the multi-connection concurrency test (`npm run test:integration`)
>
> Complete the [pre-launch checklist](#pre-launch-checklist) and pass those integration tests before taking real bookings.

---

## Contents

1. [Architecture](#architecture)
2. [Local setup](#local-setup)
3. [Environment variables](#environment-variables)
4. [Database](#database)
5. [Security model](#security-model)
6. [Booking, payment and refund flow](#booking-payment-and-refund-flow)
7. [Testing](#testing)
8. [Deployment (Vercel + Supabase)](#deployment-vercel--supabase)
9. [Pre-launch checklist](#pre-launch-checklist)
10. [Project structure](#project-structure)

---

## Architecture

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.4** (App Router, React 19, TypeScript, Cache Components and partial prerendering) |
| Styling | Tailwind CSS v4 with brand tokens (temple gold `#c18e26`, deep green `#0f3d2e`, ivory `#faf6ec`, charcoal `#2b2b2b`) |
| Data and auth | **Supabase**: Postgres with row-level security (RLS) on every table, Auth (email and password), Storage (`media` bucket) |
| Payments | **Razorpay** Orders API plus Checkout. Signatures and webhooks are verified on the server. No card data touches our servers. |
| Email | **Resend** REST API (optional; every message is logged, including when sending is skipped) |
| WhatsApp | Click-to-chat (`wa.me`) link, plus optional **WhatsApp Cloud API** messages that use an approved template and require customer opt-in |
| Maps | Google Maps links built from coordinates (no API key needed). Fixed cab routes with known distances give instant fares. |
| Hosting | Vercel in the Mumbai region (`bom1`), with Vercel Cron |

Key design decisions:

- **Prices are never trusted from the browser.**
  - `src/lib/pricing.ts` is a pure, integer-paise pricing engine.
  - `src/lib/server/booking.ts` re-reads the rates, package prices, seasonal rules, coupons and tax settings fresh from the database. It then calls the transactional `create_booking` SQL function, which is callable by the service role only.
- **Capacity cannot be oversold.**
  - `create_booking` takes a per-vehicle-class advisory lock and checks availability. Availability counts confirmed bookings, unexpired payment holds and concrete allocations.
  - `vehicle_assignments` has **exclusion constraints**, so the same vehicle or driver can never be allocated to overlapping trips. This holds even under concurrent writes.
- **Payments are idempotent.**
  - `record_payment_captured` locks the payment row and is safe to call any number of times, whether from the Checkout callback or from webhook retries.
  - Webhook events are stored with a unique `(provider, event_id)`.
  - Late payments are handled: a booking whose hold expired is reinstated if capacity remains. Otherwise a full refund is queued, and duplicate payments are refunded the same way.
- **Authorization runs in three layers.**
  1. `proxy.ts` does an optimistic redirect for signed-out visitors.
  2. Every page, server action and route handler checks the session and the permission.
  3. Postgres RLS policies, column-level grants and permission checks inside the RPCs enforce it again in the database.
- **Public pages are server-rendered and cached** with `"use cache"` and `cacheTag`. Admin edits call `updateTag()` so changes appear immediately.

## Local setup

Prerequisites:
- Node.js 20.9 or newer (developed on Node 24)
- npm
- Docker, for the local Supabase stack (optional: you can point at a cloud project instead)

```bash
npm install
cp .env.example .env.local          # fill in values (see below)

# Option A — local Supabase (requires Docker)
npx supabase start                  # prints the local API URL and keys
npx supabase db reset               # applies migrations + supabase/seed.sql (DEMO data)

# Option B — a Supabase cloud project
npx supabase link --project-ref <ref>
npx supabase db push                # applies migrations
# then run supabase/seed.sql in the SQL editor ONLY on a staging project

npm run dev                         # http://localhost:3000
```

### Create the first owner account

1. Sign up through `/signup` and confirm your email.
2. In the Supabase SQL editor, which runs as the service role, run:

   ```sql
   insert into public.staff_members (user_id, role)
   select id, 'owner' from auth.users where email = 'owner@your-domain.in';
   ```

3. Sign in again. `/admin` is now available. From there, owners can add administrators, booking staff and drivers.

### Regenerate brand assets

```bash
npm run brand:assets   # SVG/PNG logo, favicon, apple-icon, OG image, placeholder illustrations
```

## Environment variables

See [`.env.example`](.env.example) for the full annotated list.

| Variable | Exposed to browser? | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | yes | yes | Canonical URLs, sitemap, email links |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | yes | Supabase client (RLS protects the data) |
| `SUPABASE_SECRET_KEY` | **no** | yes | Service role, used for bookings, webhooks and notifications |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | **no** (the key id is sent to Checkout at runtime) | for payments | Orders, captures and refunds |
| `RAZORPAY_WEBHOOK_SECRET` | **no** | for payments | Webhook signature verification |
| `RESEND_API_KEY`, `EMAIL_FROM`, `STAFF_ALERT_EMAIL` | **no** | recommended | Confirmation emails and staff alerts |
| `WHATSAPP_*` | **no** | optional | Cloud API template messages |
| `CRON_SECRET` | **no** | yes | Protects `/api/cron/expire-bookings` |
| `IP_HASH_SALT` | **no** | yes | Salted hashing of IP addresses |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | yes | optional | GA4, loaded only after the visitor consents |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | yes | optional | Search Console verification meta tag |

If an integration isn't configured, the app tells the user so. It never pretends to succeed:
- **Payments:** shows "online payment not available yet".
- **Email and WhatsApp:** each attempt is logged with status `skipped`.
- **Accounts:** sign-in explains that accounts aren't configured yet.

## Database

Migrations live in `supabase/migrations/`:

| File | Contents |
|---|---|
| `…01_core.sql` | Enums, `profiles` (auto-created on sign-up), `staff_members`, `role_permissions`, `has_permission()`, and staff guard triggers (only owners can grant owner or admin, nobody can change their own role, at least one owner must remain) |
| `…02_catalog.sql` | Destinations, packages, package prices per vehicle class, cab routes, vehicle rate card, pricing rules, coupons, site settings, blog, FAQs |
| `…03_operations.sql` | Vehicles, drivers, bookings, booking events, vehicle assignments (exclusion constraints), coupon redemptions, payments, webhook events, refunds, reviews, notifications, support tickets, itinerary requests, consent records, data requests, rate limits |
| `…04_functions.sql` | `create_booking`, `available_vehicle_count`, `expire_pending_bookings`, `record_payment_captured` and `record_payment_failed`, `cancel_booking`, the refund lifecycle, `assign_vehicle`, `update_trip_status`, `admin_overview`, `check_rate_limit`, `anonymize_customer` |
| `…05_rls.sql` | Revokes default privileges, explicit grants (including column-level), RLS policies, safe views (`public_testimonials`, `my_trip_assignments`), the append-only `audit_logs` with triggers, and the Storage bucket and policies |

All money is stored as **integer paise**. All times are `timestamptz`; the UI shows them in Asia/Kolkata time.

`supabase/seed.sql` is **demo data**:
- every price, distance and fleet record in it is illustrative
- the vehicles are labelled `DEMO-…`
- no reviews, bookings or payments are seeded

**Never run it on production.** Enter real data through `/admin` instead.

## Security model

| Threat | Mitigation |
|---|---|
| Data leaking between customers or IDOR | RLS restricts every table to the customer's own rows. Booking and payment lookups also filter on `customer_id`. Tests: `tests/db/security.test.ts` |
| Privilege escalation | Roles live in `staff_members`, never in user-editable profile fields. Grant and modify rules are enforced by triggers. Column-level grants stop customers editing `email`, `status` or amounts. |
| Forged prices or amounts | No client-side price is ever used. `create_booking`, `record_payment_*` and `cancel_booking` are callable by the service role only. The captured amount must equal the order amount. |
| Payment spoofing | Checkout signature (HMAC over `order_id\|payment_id`), then the payment is re-fetched from the Razorpay API. Webhook HMAC is checked over the raw body with a timing-safe comparison. |
| Duplicate events or double refunds | Webhook event table with a unique key. Idempotent RPCs. Refund rows are claimed (`mark_refund_processing` returns false on a second claim) before the gateway is called. |
| Double booking | Advisory lock plus capacity check in `create_booking`. Exclusion constraints on `vehicle_assignments`. Idempotency key on booking creation. |
| CSRF | Server Actions use Next.js's built-in Origin check. JSON endpoints require a same-site `Origin`. Cookies are SameSite=Lax. |
| XSS | React escaping, a safe Markdown renderer (no `dangerouslySetInnerHTML`), JSON-LD with `<` escaped, and a strict CSP (`next.config.ts`) |
| Injection | Parameterised Supabase queries, Zod validation of all input, and `search_path = ''` on all `security definer` functions |
| Abuse and brute force | Postgres-backed rate limits on login (per IP and per email), sign-up, password reset, contact, quotes, bookings and payments, plus a honeypot field on public forms. Supabase Auth has its own limits too. |
| Open redirects | `safeNextPath()` allows same-site relative paths only |
| Uploads | Storage bucket limited to JPEG, PNG, WebP and AVIF up to 5 MB. Uploading needs `catalog.manage` or `content.manage` (RLS). Server-side type and size checks. |
| Auditability | Append-only `audit_logs` written by triggers on all sensitive tables, with the acting user recorded |
| Secrets | Server-only modules import `server-only`. Nothing secret uses a `NEXT_PUBLIC_` name. The service-role key is never sent to the browser. |
| Card data | Never stored or seen. Razorpay Checkout handles PCI-DSS scope. |

**Backups and monitoring.** These are configured outside the code:
- Enable Supabase Point-in-Time Recovery (Pro plan), or schedule `pg_dump` backups.
- Enable Vercel log drains or connect Sentry for error monitoring.
- Watch `/admin` for failed notifications and webhook errors.

## Booking, payment and refund flow

```
Customer form ──POST /api/quote──▶ live server-side fare + availability
             ──POST /api/bookings─▶ prepareQuote() → create_booking()  [status: pending, hold N minutes]
/account/bookings/<ref> ─ Pay ──POST /api/payments/order──▶ Razorpay order (reused on retry)
Razorpay Checkout ─ success ──POST /api/payments/verify──▶ verify signature → fetch payment → capture if needed
                                                         → record_payment_captured()  [confirmed]
Razorpay ──webhook──▶ /api/webhooks/razorpay ──▶ verify HMAC → dedupe event → same idempotent RPCs
Vercel Cron (10 min) ──▶ /api/cron/expire-bookings ──▶ expire_pending_bookings()  [cancelled, coupon released]
Staff /admin/bookings/<ref> ─ assign vehicle + driver ──▶ assign_vehicle()  [assigned; exclusion constraints]
Driver /admin/trips ─ start / complete ──▶ update_trip_status()  [in_progress → completed]
Customer cancel ──▶ computeRefund(policy) on server → cancel_booking()  [cancelled | refund_pending]
Staff /admin/payments ─ process refund ──▶ claim → Razorpay refund API → refund.processed webhook  [refunded]
```

Booking statuses: `pending → confirmed → assigned → in_progress → completed`, plus `cancelled`, `refund_pending` and `refunded`.

## Testing

```bash
npm test                 # unit + database tests (no external services needed)
npm run test:unit        # pricing, cancellation, validation, permissions, signatures, webhook idempotency
npm run test:db          # migrations + RLS + authorization + allocation + payments + refunds (PGlite)
npm run test:integration # REAL multi-connection concurrency test (needs a disposable Supabase)
npm run typecheck
npm run lint
npm run build
```

- **Database tests** run the real migrations in [PGlite](https://pglite.dev) (Postgres compiled to WebAssembly), with minimal stubs for Supabase's `auth`, `storage` and API roles.
- **Full-fidelity database checks.** For checks against the real Supabase stack, run `npx supabase start` and point `npm run test:integration` at it:

  ```bash
  TEST_SUPABASE_URL=http://127.0.0.1:54321 TEST_SUPABASE_SECRET_KEY=<service key> npm run test:integration
  ```

**Manual QA still required before launch:**
- [ ] Razorpay **test mode**, end to end: successful UPI and card payments, failed payment, closing the window mid-payment, a duplicate webhook (use the dashboard's "resend"), and a refund
- [ ] Email delivery from your verified domain (confirmation, cancellation, refund, password reset)
- [ ] WhatsApp template delivery to an opted-in test number (if enabled)
- [ ] Mobile layouts on real Android and iOS devices, plus desktop browsers
- [ ] Accessibility: keyboard-only navigation, a screen reader pass, and a Lighthouse or axe audit
- [ ] SEO: Rich Results Test on package and destination pages, plus the Search Console sitemap submission
- [ ] Error and empty states with the database unreachable, and with each integration disabled

## Deployment (Vercel + Supabase)

1. **Supabase project** (region: Mumbai `ap-south-1`)
   - `npx supabase link --project-ref <ref> && npx supabase db push`
   - Auth → URL configuration:
     - Site URL: `https://your-domain.in`
     - Redirect URLs: `https://your-domain.in/auth/callback`
   - Auth → turn on email confirmations, set the password policy (10+ characters, letters and digits), add custom SMTP with your domain, and enable leaked-password protection.
   - Auth email templates: keep the default `{{ .ConfirmationURL }}` links. They are handled by `/auth/callback`.
   - Enable Point-in-Time Recovery, or another backup schedule.
2. **Vercel project**
   - Import the repository and set every variable from `.env.example` for Production and Preview.
   - Use separate Razorpay *test* keys for Preview.
   - `vercel.json` pins the region to `bom1` and schedules the hold-expiry cron every 10 minutes.
     - Sub-daily crons need a paid Vercel plan.
     - On Hobby, the schedule falls back to daily. Capacity is still correct, because availability ignores expired holds.
   - Add your domain. HTTPS and HSTS are applied automatically (see `next.config.ts`).
3. **Razorpay**
   - Complete KYC and activate live mode.
   - Enable automatic capture, or leave it off: `/api/payments/verify` captures authorised payments itself.
   - Webhook URL: `https://your-domain.in/api/webhooks/razorpay`
   - Webhook events: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`
   - Set the webhook secret, then copy it into `RAZORPAY_WEBHOOK_SECRET`.
4. **Resend:** verify your sending domain (SPF and DKIM), then set `EMAIL_FROM`.
5. **Search Console and Analytics** (only after configuring them): set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` and `NEXT_PUBLIC_GA_MEASUREMENT_ID`, then submit `https://your-domain.in/sitemap.xml`.
6. Create the owner account (see above). In `/admin` you then:
   - replace all demo data
   - fill in the contact and legal settings
   - enable WhatsApp click-to-chat

## Pre-launch checklist

### External accounts and API keys

- [ ] **Domain name and DNS** (for example `yatratravel.in`)
- [ ] **Supabase** project on the Pro plan (backups and PITR): URL, publishable key, secret key
- [ ] **Vercel** account (Pro plan for 10-minute cron and commercial use)
- [ ] **Razorpay** business account:
  - KYC
  - bank account
  - live key id and secret
  - webhook secret
  - **approval of the business category** (travel / tour operator)
  - settlement settings
- [ ] **Resend** (or other SMTP) with a verified domain; Supabase Auth custom SMTP
- [ ] *(Optional)* **Meta Business** account:
  - business verification
  - WhatsApp Business Platform phone number
  - permanent system-user access token
  - an **approved `booking_confirmed` utility template** with 3 variables
  - display name approval
- [ ] *(Optional)* Google Search Console property; GA4 property
- [ ] Error monitoring (Sentry, or Vercel log drains)

### Business and legal decisions (owner)

- [ ] **Real rate card:**
  - per-km rates
  - minimum km per day
  - driver allowance
  - package prices per vehicle
  - seasonal and festival rules
  - which of tolls, parking and permits are included
- [ ] **Real fleet and drivers:**
  - registration numbers
  - permits (including all-India or Tamil Nadu permits for interstate trips)
  - insurance and licence expiry dates
- [ ] **Verified distances and durations** for every cab route
- [ ] **GST:**
  - GSTIN
  - applicable rate and whether prices include tax (an accountant must confirm the correct rate and treatment for passenger transport and tour operator services)
  - whether tax invoices are needed (the current receipt is *not* a tax invoice)
- [ ] **Cancellation and refund tiers** (the seed contains a *demo* policy) and the payment hold time
- [ ] Legal entity name, registered address, phone, email and business hours
- [ ] **Grievance officer** name and contact (required under the DPDP Act and the IT Rules)
- [ ] Have a lawyer review the **privacy policy, terms, cancellation/refund policy and cookie policy**. These are templates.
- [ ] Data retention periods for bookings and financial records
- [ ] Licensed photographs to replace the placeholder illustrations, with alt text
- [ ] Original blog and travel guide content
- [ ] Confirm the wording on TTD: no affiliation, no darshan guarantees, no sale of temple tickets (enforced in site copy, but review it)
- [ ] Testimonials: only from real customers through the in-app review flow (already enforced)

### Technical sign-off

- [ ] `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` all pass in CI
- [ ] `npm run test:integration` passes against a staging Supabase
- [ ] Razorpay test-mode end-to-end matrix passes (see Testing)
- [ ] Webhook signature, duplicate-delivery and refund flows verified in staging
- [ ] RLS spot-checked with two real customer accounts and each staff role
- [ ] Security headers verified (securityheaders.com) and CSP has no violations in the browser console
- [ ] Backups verified with a test restore
- [ ] Demo seed data removed or replaced on production

## Project structure

```
src/
  app/
    (site)/          public pages (home, packages, destinations, cab booking, blog, policies…)
    (auth)/          login, signup, forgot/reset password + server actions
    account/         customer dashboard (bookings, payments, cancellation, reviews, support, privacy)
    admin/           admin dashboard (role-aware)
    api/             quote, bookings, payments, webhooks, cron, consent, export
    auth/callback/   Supabase email-link handler
    sitemap.ts robots.ts icon.svg apple-icon.png
  components/        UI primitives, layout, booking form, account and admin components
  lib/
    pricing.ts cancellation.ts validation.ts permissions.ts seo.ts dates.ts money.ts
    data/            cached public queries
    server/          server-only: auth, booking, payments, razorpay, notify, rate-limit, http
    supabase/        server / public / admin / browser clients
  proxy.ts           session refresh + optimistic route protection
supabase/            config.toml, migrations, seed.sql (demo)
tests/               unit, db (PGlite), integration
scripts/             brand asset generator
public/brand         logo SVG/PNG, OG image
```
