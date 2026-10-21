"use server";

import { z } from "zod";
import { refresh, updateTag } from "next/cache";
import { failure, type ActionState } from "@/lib/actions";
import { TAGS } from "@/lib/data/catalog";
import type { SiteSettings } from "@/lib/types";
import type { Viewer } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminAction, dbErrorMessage, success } from "@/lib/server/admin/errors";
import { checkbox, parseForm, percentToBps, reqInt, reqText } from "@/lib/server/admin/forms";
import { emailSchema, phoneSchema } from "@/lib/validation";

type Key = keyof SiteSettings;

/** Upsert one site_settings row with the user (RLS) client. */
async function save<K extends Key>(viewer: Viewer, key: K, value: SiteSettings[K], formData: FormData): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("site_settings")
    .upsert({ key, value, is_public: true, updated_by: viewer.id }, { onConflict: "key" })
    .select("key");
  if (error) return failure(dbErrorMessage(error), formData);
  if (!data?.length) return failure("Not saved: not permitted.", formData);
  updateTag(TAGS.settings);
  refresh();
  return success("Settings saved.");
}

// --- Field helpers (blank → "") --------------------------------------------
const text = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} must be at most ${max} characters` })
    .default("");

const blankOr = <T extends z.ZodType<string>>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.union([z.literal(""), schema]));

const httpsUrl = (label: string) =>
  z
    .url({ error: `${label} must be a full https:// link`, protocol: /^https$/ })
    .max(500, { error: `${label} must be at most 500 characters` });

// --- Brand --------------------------------------------------------------------
const brandSchema = z.object({
  name: reqText(80, "Brand name"),
  tagline: text(160, "Tagline"),
  legal_name: text(160, "Legal name"),
  gstin: blankOr(
    z
      .string()
      .toUpperCase()
      .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, { error: "GSTIN must be 15 characters, e.g. 37ABCDE1234F1Z5" }),
  ).transform((v) => v.toUpperCase()),
});

export async function saveBrand(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("settings.manage", async (viewer) => {
    const parsed = parseForm(brandSchema, formData);
    if (!parsed.ok) return parsed.state;
    return save(viewer, "brand", parsed.data, formData);
  });
}

// --- Contact ------------------------------------------------------------------
const contactSchema = z.object({
  phone: blankOr(phoneSchema),
  email: blankOr(emailSchema),
  address: text(300, "Address"),
  hours: text(160, "Hours"),
  map_url: blankOr(httpsUrl("Map link")),
});

export async function saveContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("settings.manage", async (viewer) => {
    const parsed = parseForm(contactSchema, formData);
    if (!parsed.ok) return parsed.state;
    return save(viewer, "contact", parsed.data, formData);
  });
}

// --- Social -------------------------------------------------------------------
const socialSchema = z.object({
  facebook: blankOr(httpsUrl("Facebook")),
  instagram: blankOr(httpsUrl("Instagram")),
  youtube: blankOr(httpsUrl("YouTube")),
  x: blankOr(httpsUrl("X")),
});

export async function saveSocial(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("settings.manage", async (viewer) => {
    const parsed = parseForm(socialSchema, formData);
    if (!parsed.ok) return parsed.state;
    return save(viewer, "social", parsed.data, formData);
  });
}

// --- WhatsApp -----------------------------------------------------------------
const whatsappSchema = z
  .object({
    enabled: checkbox,
    number: z.preprocess(
      (v) => (typeof v === "string" ? v.replace(/[\s\-+()]/g, "") : ""),
      z.union([
        z.literal(""),
        z.string().regex(/^[1-9]\d{9,14}$/, { error: "Enter digits with the country code, e.g. 919876543210" }),
      ]),
    ),
    default_message: text(500, "Default message"),
  })
  .refine((v) => !v.enabled || v.number !== "", { error: "A WhatsApp number is required when enabled", path: ["number"] });

export async function saveWhatsapp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("settings.manage", async (viewer) => {
    const parsed = parseForm(whatsappSchema, formData);
    if (!parsed.ok) return parsed.state;
    return save(viewer, "whatsapp", parsed.data, formData);
  });
}

// --- Booking ------------------------------------------------------------------
const bookingSchema = z.object({
  hold_minutes: reqInt(5, 120, "Payment hold"),
  min_lead_hours: reqInt(0, 720, "Minimum lead time"),
  max_advance_days: reqInt(1, 730, "Maximum advance booking"),
  tax_rate: percentToBps(0, 100, "Tax rate"),
  tax_label: reqText(30, "Tax label"),
  prices_include_tax: checkbox,
});

export async function saveBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("settings.manage", async (viewer) => {
    const parsed = parseForm(bookingSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { tax_rate, ...rest } = parsed.data;
    return save(viewer, "booking", { ...rest, tax_rate_bps: tax_rate }, formData);
  });
}

// --- Cancellation policy ------------------------------------------------------
const tierSchema = z.object({
  min_hours_before: reqInt(0, 8760, "Hours before trip"),
  refund: percentToBps(0, 100, "Refund"),
});

export async function saveCancellation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("settings.manage", async (viewer) => {
    const hours = formData.getAll("tier_hours").map(String);
    const refunds = formData.getAll("tier_refund").map(String);
    const tiers: SiteSettings["cancellation_policy"]["tiers"] = [];
    const errors: Record<string, string> = {};
    hours.forEach((h, i) => {
      if (h.trim() === "" && (refunds[i] ?? "").trim() === "") return; // ignore empty rows
      const parsed = tierSchema.safeParse({ min_hours_before: h, refund: refunds[i] ?? "" });
      if (!parsed.success) {
        errors[`tier_${i + 1}`] = `Row ${i + 1}: ${parsed.error.issues[0]?.message ?? "invalid"}`;
        return;
      }
      tiers.push({ min_hours_before: parsed.data.min_hours_before, refund_bps: parsed.data.refund });
    });
    if (Object.keys(errors).length) return failure("Please correct the refund tiers.", formData, errors);
    if (tiers.length === 0) return failure("Add at least one refund tier.", formData, { tiers: "At least one tier is required" });
    if (tiers.length > 20) return failure("At most 20 refund tiers.", formData);
    const seen = new Set<number>();
    for (const t of tiers) {
      if (seen.has(t.min_hours_before))
        return failure("Please correct the refund tiers.", formData, {
          tiers: `Two tiers use ${t.min_hours_before} hours — each tier needs a different number of hours`,
        });
      seen.add(t.min_hours_before);
    }
    tiers.sort((a, b) => b.min_hours_before - a.min_hours_before);

    const note = parseForm(z.object({ note: text(1000, "Note") }), formData);
    if (!note.ok) return note.state;
    const value: SiteSettings["cancellation_policy"] = note.data.note ? { tiers, note: note.data.note } : { tiers };
    return save(viewer, "cancellation_policy", value, formData);
  });
}

// --- Legal --------------------------------------------------------------------
const legalSchema = z.object({
  policy_version: reqText(40, "Policy version"),
  last_updated: blankOr(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Last updated must be a date" })),
  grievance_officer_name: text(120, "Grievance officer name"),
  grievance_officer_email: blankOr(emailSchema),
});

export async function saveLegal(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("settings.manage", async (viewer) => {
    const parsed = parseForm(legalSchema, formData);
    if (!parsed.ok) return parsed.state;
    return save(viewer, "legal", parsed.data, formData);
  });
}
