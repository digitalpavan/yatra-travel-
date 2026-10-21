"use server";

import { z } from "zod";
import { refresh, updateTag } from "next/cache";
import { failure, type ActionState } from "@/lib/actions";
import { TAGS } from "@/lib/data/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminAction, dbErrorMessage, success, type DbError } from "@/lib/server/admin/errors";
import {
  checkbox,
  formObject,
  optInt,
  optIstDateTime,
  optRupeesToPaise,
  optText,
  parseForm,
  percentToBps,
  reqDate,
  reqInt,
  reqText,
  uuid,
} from "@/lib/server/admin/forms";
import { couponCodeSchema, slugSchema } from "@/lib/validation";

const NOT_FOUND = "Not found or not permitted.";
const FIX = "Please correct the highlighted fields.";
const idSchema = z.object({ id: uuid });

/** FormData → object including the multi-value applies_to checkboxes. */
function withAppliesTo(formData: FormData): Record<string, unknown> {
  return { ...formObject(formData), applies_to: [...new Set(formData.getAll("applies_to").map(String))] };
}

const appliesTo = z
  .array(z.enum(["package", "cab"], { error: "Invalid booking type" }))
  .min(1, { error: "Choose at least one: packages or cabs" });

// ---------------------------------------------------------------------------
// Cab routes (catalog.manage)
// ---------------------------------------------------------------------------
const routeSchema = z
  .object({
    slug: z
      .string({ error: "Slug is required" })
      .trim()
      .toLowerCase()
      .min(1, { error: "Slug is required, e.g. tirupati-to-chennai" })
      .max(120, { error: "Slug must be at most 120 characters" })
      .refine((v) => slugSchema.safeParse(v).success, {
        error: "Use lower-case letters, digits and single hyphens, e.g. tirupati-to-chennai",
      }),
    origin: reqText(120, "Origin"),
    destination: reqText(120, "Destination"),
    distance_km: reqInt(1, 2000, "Distance"),
    typical_duration_minutes: reqInt(5, 2880, "Typical duration"),
    notes: optText(1000, "Notes"),
    is_active: checkbox,
    sort_order: optInt(-1000, 100000, "Sort order").transform((v) => v ?? 0),
  })
  .refine((v) => v.origin.toLowerCase() !== v.destination.toLowerCase(), {
    error: "Destination must differ from the origin",
    path: ["destination"],
  });

function routeDbFailure(error: DbError, formData: FormData): ActionState {
  if (error.code === "23505") {
    const text = error.details ?? error.message;
    if (text.includes("slug")) return failure(FIX, formData, { slug: "Another route already uses this slug" });
    if (text.includes("origin")) return failure(FIX, formData, { destination: "A route between these places already exists" });
  }
  return failure(dbErrorMessage(error), formData);
}

export async function createRoute(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("catalog.manage", async () => {
    const parsed = parseForm(routeSchema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("cab_routes").insert(parsed.data);
    if (error) return routeDbFailure(error, formData);
    updateTag(TAGS.routes);
    refresh();
    return success("Route added.");
  });
}

export async function updateRoute(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("catalog.manage", async () => {
    const parsedId = parseForm(idSchema, formData);
    if (!parsedId.ok) return parsedId.state;
    const parsed = parseForm(routeSchema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("cab_routes").update(parsed.data).eq("id", parsedId.data.id).select("id");
    if (error) return routeDbFailure(error, formData);
    if (!data?.length) return failure(NOT_FOUND);
    updateTag(TAGS.routes);
    refresh();
    return success("Route saved.");
  });
}

export async function deleteRoute(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("catalog.manage", async () => {
    const parsed = parseForm(idSchema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("cab_routes").delete().eq("id", parsed.data.id).select("id");
    if (error) {
      if (error.code === "23503") return failure("This route is used by bookings and cannot be deleted. Untick “Active” to hide it instead.");
      return failure(dbErrorMessage(error));
    }
    if (!data?.length) return failure(NOT_FOUND);
    updateTag(TAGS.routes);
    refresh();
    return success("Route deleted.");
  });
}

// ---------------------------------------------------------------------------
// Pricing rules (coupons.manage)
// ---------------------------------------------------------------------------
const ruleSchema = z
  .object({
    name: reqText(120, "Name"),
    starts_on: reqDate("Start date"),
    ends_on: reqDate("End date"),
    adjustment: percentToBps(-50, 100, "Adjustment"),
    applies_to: appliesTo,
    is_active: checkbox,
  })
  .refine((v) => v.ends_on >= v.starts_on, { error: "End date must be on or after the start date", path: ["ends_on"] })
  .refine((v) => v.adjustment !== 0, { error: "Adjustment cannot be 0%", path: ["adjustment"] });

function ruleRow(d: z.output<typeof ruleSchema>) {
  return {
    name: d.name,
    starts_on: d.starts_on,
    ends_on: d.ends_on,
    adjustment_bps: d.adjustment,
    applies_to: d.applies_to,
    is_active: d.is_active,
  };
}

export async function createRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("coupons.manage", async () => {
    const parsed = parseForm(ruleSchema, formData, withAppliesTo(formData));
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("pricing_rules").insert(ruleRow(parsed.data));
    if (error) return failure(dbErrorMessage(error), formData);
    refresh();
    return success("Pricing rule added.");
  });
}

export async function updateRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("coupons.manage", async () => {
    const parsedId = parseForm(idSchema, formData);
    if (!parsedId.ok) return parsedId.state;
    const parsed = parseForm(ruleSchema, formData, withAppliesTo(formData));
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("pricing_rules").update(ruleRow(parsed.data)).eq("id", parsedId.data.id).select("id");
    if (error) return failure(dbErrorMessage(error), formData);
    if (!data?.length) return failure(NOT_FOUND);
    refresh();
    return success("Pricing rule saved.");
  });
}

export async function deleteRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("coupons.manage", async () => {
    const parsed = parseForm(idSchema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("pricing_rules").delete().eq("id", parsed.data.id).select("id");
    if (error) return failure(dbErrorMessage(error));
    if (!data?.length) return failure(NOT_FOUND);
    refresh();
    return success("Pricing rule deleted.");
  });
}

// ---------------------------------------------------------------------------
// Coupons (coupons.manage)
// ---------------------------------------------------------------------------
const RUPEES_RE = /^\d{1,9}(\.\d{1,2})?$/;

const couponSchema = z
  .object({
    code: z.string({ error: "Code is required" }).pipe(couponCodeSchema),
    description: optText(300, "Description"),
    discount_type: z.enum(["percent", "flat"], { error: "Choose a discount type" }),
    discount_value: z.string({ error: "Discount is required" }).trim().transform((v) => v.replace(/[,\s₹%]/g, "")),
    max_discount: optRupeesToPaise("Maximum discount"),
    min_order: optRupeesToPaise("Minimum order").transform((v) => v ?? 0),
    applies_to: appliesTo,
    valid_from: optIstDateTime("Valid from"),
    valid_until: optIstDateTime("Valid until"),
    usage_limit: optInt(1, 10_000_000, "Total usage limit"),
    per_customer_limit: reqInt(1, 1000, "Per-customer limit"),
    is_active: checkbox,
  })
  .transform((v, ctx) => {
    let discount = 0;
    if (v.discount_type === "percent") {
      const n = Number(v.discount_value);
      if (!v.discount_value || !Number.isFinite(n) || n < 0.01 || n > 100) {
        ctx.addIssue({ code: "custom", path: ["discount_value"], message: "Percentage must be between 0.01 and 100" });
        return z.NEVER;
      }
      discount = Math.round(n * 100);
    } else {
      if (!RUPEES_RE.test(v.discount_value) || Number(v.discount_value) <= 0) {
        ctx.addIssue({ code: "custom", path: ["discount_value"], message: "Flat discount must be a rupee amount above 0, e.g. 250" });
        return z.NEVER;
      }
      discount = Math.round(Number(v.discount_value) * 100);
    }
    if (v.max_discount !== null && v.max_discount <= 0) {
      ctx.addIssue({ code: "custom", path: ["max_discount"], message: "Maximum discount must be above ₹0 (or leave blank)" });
      return z.NEVER;
    }
    if (!v.valid_from) {
      ctx.addIssue({ code: "custom", path: ["valid_from"], message: "Valid from is required" });
      return z.NEVER;
    }
    if (v.valid_until && v.valid_until <= v.valid_from) {
      ctx.addIssue({ code: "custom", path: ["valid_until"], message: "Valid until must be after valid from" });
      return z.NEVER;
    }
    return {
      code: v.code,
      description: v.description,
      discount_type: v.discount_type,
      discount_value: discount,
      max_discount_paise: v.max_discount,
      min_order_paise: v.min_order,
      applies_to: v.applies_to,
      valid_from: v.valid_from,
      valid_until: v.valid_until,
      usage_limit: v.usage_limit,
      per_customer_limit: v.per_customer_limit,
      is_active: v.is_active,
    };
  });

function couponDbFailure(error: DbError, formData: FormData): ActionState {
  if (error.code === "23505" && (error.details ?? error.message).includes("code")) {
    return failure(FIX, formData, { code: "Another coupon already uses this code" });
  }
  return failure(dbErrorMessage(error), formData);
}

export async function createCoupon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("coupons.manage", async () => {
    const parsed = parseForm(couponSchema, formData, withAppliesTo(formData));
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("coupons").insert(parsed.data);
    if (error) return couponDbFailure(error, formData);
    refresh();
    return success(`Coupon ${parsed.data.code} created.`);
  });
}

export async function updateCoupon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("coupons.manage", async () => {
    const parsedId = parseForm(idSchema, formData);
    if (!parsedId.ok) return parsedId.state;
    const parsed = parseForm(couponSchema, formData, withAppliesTo(formData));
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("coupons").update(parsed.data).eq("id", parsedId.data.id).select("id");
    if (error) return couponDbFailure(error, formData);
    if (!data?.length) return failure(NOT_FOUND);
    refresh();
    return success(`Coupon ${parsed.data.code} saved.`);
  });
}

export async function deleteCoupon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("coupons.manage", async () => {
    const parsed = parseForm(idSchema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("coupons").delete().eq("id", parsed.data.id).select("id");
    if (error) {
      if (error.code === "23503") return failure("This coupon has been redeemed and cannot be deleted. Untick “Active” to stop further use instead.");
      return failure(dbErrorMessage(error));
    }
    if (!data?.length) return failure(NOT_FOUND);
    refresh();
    return success("Coupon deleted.");
  });
}
