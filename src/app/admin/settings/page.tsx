import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { integrations } from "@/lib/server/env";
import { mergeSettings } from "@/lib/data/catalog";
import { formatDateTime } from "@/lib/dates";
import { Badge, Checkbox, Field, Input, Textarea } from "@/components/ui";
import { AdminHeader, LoadError, Panel } from "@/components/admin/AdminUI";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { SettingsTiersEditor } from "@/components/admin/SettingsTiersEditor";
import { saveBooking, saveBrand, saveCancellation, saveContact, saveLegal, saveSocial, saveWhatsapp } from "./actions";

export const metadata: Metadata = { title: "Site settings", robots: { index: false, follow: false } };

const INTEGRATIONS: { key: keyof typeof integrations; label: string; hint: string }[] = [
  { key: "supabaseAdmin", label: "Supabase service role", hint: "Server-side jobs, webhooks and privacy requests" },
  { key: "razorpay", label: "Razorpay payments", hint: "Online payment at checkout" },
  { key: "razorpayWebhook", label: "Razorpay webhook", hint: "Payment and refund status updates" },
  { key: "email", label: "Transactional email", hint: "Booking confirmations and staff alerts" },
  { key: "whatsapp", label: "WhatsApp Cloud API", hint: "WhatsApp booking confirmations" },
];

export default async function SettingsPage() {
  await requirePermission("settings.manage", "/admin/settings");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("site_settings").select("key, value, updated_at");
  const rows = (data ?? []) as { key: string; value: unknown; updated_at: string }[];
  const s = mergeSettings(rows);
  const updated = new Map(rows.map((r) => [r.key, r.updated_at]));
  const lastSaved = (key: string): ReactNode => {
    const at = updated.get(key);
    return at ? `Last saved ${formatDateTime(at)}` : "Using defaults (not saved yet)";
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Site settings"
        back={{ href: "/admin", label: "Overview" }}
        intro="Business details and booking rules shown on the public site. Each section saves separately and is visible publicly."
      />

      {error && <LoadError what="saved settings — the forms below show defaults; saving will overwrite" />}

      <Panel title="Integration status" id="integrations" description="Configured through server environment variables. Values are never shown here.">
        <ul className="divide-y divide-line/70 text-sm">
          {INTEGRATIONS.map((i) => {
            const ok = integrations[i.key]();
            return (
              <li key={i.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium text-charcoal">{i.label}</span>
                  <span className="block text-xs text-muted">{i.hint}</span>
                </span>
                <Badge tone={ok ? "green" : "red"}>{ok ? "Configured" : "Not configured"}</Badge>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Brand" id="brand" description={lastSaved("brand")}>
        <ActionForm action={saveBrand} labels={{ name: "Brand name", tagline: "Tagline", legal_name: "Legal name", gstin: "GSTIN" }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand name" name="name" required>
              <Input name="name" required maxLength={80} defaultValue={s.brand.name} />
            </Field>
            <Field label="Tagline" name="tagline">
              <Input name="tagline" maxLength={160} defaultValue={s.brand.tagline} />
            </Field>
            <Field label="Legal name" name="legal_name" hint="Registered business name shown on invoices and policies">
              <Input name="legal_name" maxLength={160} defaultValue={s.brand.legal_name} />
            </Field>
            <Field label="GSTIN" name="gstin" hint="Leave blank if not registered">
              <Input name="gstin" maxLength={15} className="uppercase" defaultValue={s.brand.gstin} />
            </Field>
          </div>
          <Save />
        </ActionForm>
      </Panel>

      <Panel title="Contact" id="contact" description={lastSaved("contact")}>
        <ActionForm
          action={saveContact}
          labels={{ phone: "Phone", email: "Email", address: "Address", hours: "Hours", map_url: "Map link" }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" name="contact_phone">
              <Input name="phone" id="contact_phone" type="tel" defaultValue={s.contact.phone} placeholder="98765 43210" />
            </Field>
            <Field label="Email" name="contact_email">
              <Input name="email" id="contact_email" type="email" defaultValue={s.contact.email} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address" name="address">
                <Textarea name="address" maxLength={300} className="min-h-20" defaultValue={s.contact.address} />
              </Field>
            </div>
            <Field label="Hours" name="hours" hint="e.g. Open 24 × 7 or Mon–Sun, 5 AM – 10 PM">
              <Input name="hours" maxLength={160} defaultValue={s.contact.hours} />
            </Field>
            <Field label="Map link" name="map_url" hint="https:// link to Google Maps, or blank">
              <Input name="map_url" type="url" maxLength={500} defaultValue={s.contact.map_url} />
            </Field>
          </div>
          <Save />
        </ActionForm>
      </Panel>

      <Panel title="Social links" id="social" description={lastSaved("social")}>
        <ActionForm action={saveSocial} labels={{ facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", x: "X" }}>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["facebook", "Facebook"],
                ["instagram", "Instagram"],
                ["youtube", "YouTube"],
                ["x", "X (Twitter)"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label} name={`social_${key}`} hint="Full https:// link, or blank to hide">
                <Input name={key} id={`social_${key}`} type="url" maxLength={500} defaultValue={s.social[key]} />
              </Field>
            ))}
          </div>
          <Save />
        </ActionForm>
      </Panel>

      <Panel title="WhatsApp chat button" id="whatsapp" description={lastSaved("whatsapp")}>
        <ActionForm action={saveWhatsapp} labels={{ number: "WhatsApp number", default_message: "Default message" }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Checkbox name="enabled" id="whatsapp_enabled" label="Show the WhatsApp chat button on the site" defaultChecked={s.whatsapp.enabled} />
            </div>
            <Field label="WhatsApp number" name="whatsapp_number" hint="Digits with country code, no + or spaces, e.g. 919876543210">
              <Input name="number" id="whatsapp_number" inputMode="numeric" maxLength={20} defaultValue={s.whatsapp.number} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Default message" name="default_message">
                <Textarea name="default_message" maxLength={500} className="min-h-20" defaultValue={s.whatsapp.default_message} />
              </Field>
            </div>
          </div>
          <Save />
        </ActionForm>
      </Panel>

      <Panel title="Booking rules" id="booking" description={lastSaved("booking")}>
        <ActionForm
          action={saveBooking}
          labels={{
            hold_minutes: "Payment hold",
            min_lead_hours: "Minimum lead time",
            max_advance_days: "Maximum advance booking",
            tax_rate: "Tax rate",
            tax_label: "Tax label",
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Payment hold (minutes)" name="hold_minutes" required hint="How long an unpaid booking holds the slot (5–120)">
              <Input name="hold_minutes" type="number" min={5} max={120} required defaultValue={s.booking.hold_minutes} />
            </Field>
            <Field label="Minimum lead time (hours)" name="min_lead_hours" required hint="Earliest pickup after booking (0–720)">
              <Input name="min_lead_hours" type="number" min={0} max={720} required defaultValue={s.booking.min_lead_hours} />
            </Field>
            <Field label="Maximum advance booking (days)" name="max_advance_days" required hint="1–730">
              <Input name="max_advance_days" type="number" min={1} max={730} required defaultValue={s.booking.max_advance_days} />
            </Field>
            <Field label="Tax rate (%)" name="tax_rate" required hint="0–100, e.g. 5 for 5% GST">
              <Input
                name="tax_rate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                required
                defaultValue={(s.booking.tax_rate_bps / 100).toString()}
              />
            </Field>
            <Field label="Tax label" name="tax_label" required>
              <Input name="tax_label" required maxLength={30} defaultValue={s.booking.tax_label} />
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox name="prices_include_tax" label="Listed prices already include tax" defaultChecked={s.booking.prices_include_tax} />
            </div>
          </div>
          <Save />
        </ActionForm>
      </Panel>

      <Panel title="Cancellation policy" id="cancellation" description={lastSaved("cancellation_policy")}>
        <ActionForm action={saveCancellation} labels={{ tiers: "Refund tiers", note: "Note" }}>
          <div className="space-y-4">
            <SettingsTiersEditor initial={s.cancellation_policy.tiers} />
            <Field label="Note (optional)" name="note" hint="Shown under the refund table on the cancellation policy page">
              <Textarea name="note" maxLength={1000} className="min-h-20" defaultValue={s.cancellation_policy.note ?? ""} />
            </Field>
          </div>
          <Save />
        </ActionForm>
      </Panel>

      <Panel title="Legal" id="legal" description={lastSaved("legal")}>
        <ActionForm
          action={saveLegal}
          labels={{
            policy_version: "Policy version",
            last_updated: "Last updated",
            grievance_officer_name: "Grievance officer name",
            grievance_officer_email: "Grievance officer email",
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Policy version" name="policy_version" required hint="Recorded with each customer's consent">
              <Input name="policy_version" required maxLength={40} defaultValue={s.legal.policy_version} />
            </Field>
            <Field label="Last updated" name="last_updated">
              <Input name="last_updated" type="date" defaultValue={s.legal.last_updated} />
            </Field>
            <Field label="Grievance officer name" name="grievance_officer_name">
              <Input name="grievance_officer_name" maxLength={120} defaultValue={s.legal.grievance_officer_name} />
            </Field>
            <Field label="Grievance officer email" name="grievance_officer_email">
              <Input name="grievance_officer_email" type="email" defaultValue={s.legal.grievance_officer_email} />
            </Field>
          </div>
          <Save />
        </ActionForm>
      </Panel>
    </div>
  );
}

function Save() {
  return (
    <div className="mt-4">
      <AdminSubmit>Save</AdminSubmit>
    </div>
  );
}
