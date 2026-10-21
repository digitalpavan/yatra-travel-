"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, type ActionState } from "@/lib/actions";
import { TAGS } from "@/lib/data/catalog";
import { adminAction, dbErrorMessage, success } from "@/lib/server/admin/errors";
import { checkbox, formObject, lines, optInt, optRupeesToPaise, optText, parseForm, reqInt, reqText, uuid } from "@/lib/server/admin/forms";
import { resolveImage } from "@/lib/server/admin/images";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugSchema, timeSchema, vehicleClassSchema } from "@/lib/validation";
import type { ItineraryDay } from "@/lib/types";

const slugField = z
  .string({ error: "Slug is required" })
  .trim()
  .toLowerCase()
  .refine((v) => slugSchema.safeParse(v).success, {
    error: "Slug must use lowercase letters, numbers and single hyphens (max 120 characters)",
  });

const itineraryDaySchema = z.object({
  title: reqText(160, "Itinerary day title"),
  details: z.string().trim().max(3000, { error: "Itinerary day details must be at most 3000 characters" }),
});

const packageSchema = z
  .object({
    id: uuid.optional(),
    slug: slugField,
    title: reqText(140, "Title", 3),
    category: z.enum(["tirumala", "temple_circuit", "sightseeing", "multi_day"], { error: "Choose a category" }),
    summary: reqText(300, "Summary"),
    description: z.string().trim().max(20000, { error: "Description must be at most 20000 characters" }).default(""),
    duration_days: reqInt(1, 30, "Days"),
    duration_nights: reqInt(0, 30, "Nights"),
    min_passengers: reqInt(1, 60, "Minimum passengers"),
    max_passengers: reqInt(1, 60, "Maximum passengers"),
    inclusions: lines(50, 300, "Inclusion"),
    exclusions: lines(50, 300, "Exclusion"),
    highlights: lines(50, 300, "Highlight"),
    itinerary: z.array(itineraryDaySchema).max(30, { error: "At most 30 itinerary days" }),
    default_start_time: timeSchema,
    is_published: checkbox,
    is_featured: checkbox,
    sort_order: reqInt(-10000, 10000, "Sort order"),
    seo_title: optText(70, "SEO title"),
    seo_description: optText(170, "SEO description"),
  })
  .refine((v) => v.max_passengers >= v.min_passengers, {
    path: ["max_passengers"],
    error: "Maximum passengers must be at least the minimum",
  });

const priceField = optRupeesToPaise("Price").refine((v) => v === null || v > 0, { error: "Price must be greater than zero" });

function revalidatePackage(...slugs: (string | null | undefined)[]) {
  updateTag(TAGS.packages);
  for (const s of new Set(slugs.filter(Boolean))) updateTag(`package:${s}`);
  refresh();
}

/** Create or update a package with its prices, destinations and image. */
export async function savePackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("catalog.manage", async () => {
    // Itinerary rows: zip the repeated fields; rows with both fields blank are dropped.
    const titles = formData.getAll("itinerary_title").map(String);
    const details = formData.getAll("itinerary_details").map(String);
    const itinerary = titles
      .map((title, i) => ({ title, details: details[i] ?? "" }))
      .filter((r) => r.title.trim() || r.details.trim());

    const parsed = parseForm(packageSchema, formData, { ...formObject(formData), itinerary });
    if (!parsed.ok) return parsed.state;
    const { id, itinerary: days, ...fields } = parsed.data;

    // Prices: only classes rendered in the form are touched. Blank = not offered.
    const prices: { vehicle_class: string; price_paise: number | null }[] = [];
    const priceErrors: Record<string, string> = {};
    for (const vc of vehicleClassSchema.options) {
      const key = `price_${vc}`;
      if (!formData.has(key)) continue;
      const p = priceField.safeParse(formData.get(key));
      if (!p.success) priceErrors[key] = p.error.issues[0]?.message ?? "Invalid price";
      else prices.push({ vehicle_class: vc, price_paise: p.data });
    }
    if (Object.keys(priceErrors).length) return failure("Please correct the highlighted fields.", formData, priceErrors);

    // Destinations with positions.
    const destIds = [...new Set(formData.getAll("dest").map(String))];
    const destRows: { destination_id: string; position: number }[] = [];
    const destErrors: Record<string, string> = {};
    destIds.forEach((destId, i) => {
      if (!uuid.safeParse(destId).success) {
        destErrors.dest = "Invalid destination";
        return;
      }
      const pos = optInt(0, 999, "Position").safeParse(formData.get(`dest_pos_${destId}`) ?? "");
      if (!pos.success) destErrors[`dest_pos_${destId}`] = pos.error.issues[0]?.message ?? "Invalid position";
      else destRows.push({ destination_id: destId, position: pos.data ?? i });
    });
    if (Object.keys(destErrors).length) return failure("Please correct the highlighted fields.", formData, destErrors);

    const supabase = await createSupabaseServerClient();

    let current: { id: string; slug: string; image_url: string | null } | null = null;
    if (id) {
      const { data, error } = await supabase.from("packages").select("id, slug, image_url").eq("id", id).maybeSingle();
      if (error) return failure(dbErrorMessage(error), formData);
      if (!data) return failure("Not found or not permitted.", formData);
      current = data as unknown as { id: string; slug: string; image_url: string | null };
    }

    const image = await resolveImage(formData, { folder: "packages", currentUrl: current?.image_url ?? null });
    if (!image.ok) return failure(image.error, formData, { [image.field]: image.error });

    const itineraryJson: ItineraryDay[] = days.map((d, i) => ({ day: i + 1, title: d.title, details: d.details }));
    const row = { ...fields, itinerary: itineraryJson, image_url: image.url, image_alt: image.alt };

    let packageId: string;
    if (current) {
      const { data, error } = await supabase.from("packages").update(row).eq("id", current.id).select("id");
      if (error) return failure(dbErrorMessage(error), formData);
      if (!data?.length) return failure("Not found or not permitted.", formData);
      packageId = current.id;
    } else {
      const { data, error } = await supabase.from("packages").insert(row).select("id").single();
      if (error) return failure(dbErrorMessage(error), formData);
      packageId = (data as { id: string }).id;
    }

    // Prices
    const toDelete = prices.filter((p) => p.price_paise === null).map((p) => p.vehicle_class);
    const toUpsert = prices
      .filter((p) => p.price_paise !== null)
      .map((p) => ({ package_id: packageId, vehicle_class: p.vehicle_class, price_paise: p.price_paise }));
    let followUpError: string | null = null;
    if (toDelete.length) {
      const { error } = await supabase.from("package_prices").delete().eq("package_id", packageId).in("vehicle_class", toDelete);
      if (error) followUpError = dbErrorMessage(error);
    }
    if (!followUpError && toUpsert.length) {
      const { error } = await supabase.from("package_prices").upsert(toUpsert, { onConflict: "package_id,vehicle_class" });
      if (error) followUpError = dbErrorMessage(error);
    }

    // Destinations: replace the whole set.
    if (!followUpError) {
      const { error } = await supabase.from("package_destinations").delete().eq("package_id", packageId);
      if (error) followUpError = dbErrorMessage(error);
      else if (destRows.length) {
        const { error: insError } = await supabase
          .from("package_destinations")
          .insert(destRows.map((d) => ({ ...d, package_id: packageId })));
        if (insError) followUpError = dbErrorMessage(insError);
      }
    }

    // Destination rows embed package lists too.
    updateTag(TAGS.destinations);
    revalidatePackage(fields.slug, current?.slug);

    if (followUpError) {
      const msg = `The package details were saved, but prices or destinations could not be updated: ${followUpError}`;
      if (!current) redirect(`/admin/packages/${packageId}?saved=partial`);
      return failure(msg, formData);
    }
    if (!current) redirect(`/admin/packages/${packageId}?saved=1`);
    return success("Package saved.");
  });
}

const idSchema = z.object({ id: uuid });

/** Publish / unpublish quick action. */
export async function setPackagePublished(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("catalog.manage", async () => {
    const parsed = parseForm(z.object({ id: uuid, publish: z.enum(["true", "false"]) }), formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const publish = parsed.data.publish === "true";
    const { data, error } = await supabase
      .from("packages")
      .update({ is_published: publish, ...(publish ? {} : { is_featured: false }) })
      .eq("id", parsed.data.id)
      .select("slug");
    if (error) return failure(dbErrorMessage(error));
    if (!data?.length) return failure("Not found or not permitted.");
    revalidatePackage((data[0] as { slug: string }).slug);
    return success(publish ? "Package published." : "Package unpublished.");
  });
}

/** Delete a package (fails when bookings reference it). */
export async function deletePackage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("catalog.manage", async () => {
    const parsed = parseForm(idSchema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("packages").delete().eq("id", parsed.data.id).select("slug");
    if (error) {
      if (error.code === "23503")
        return failure("This package is referenced by bookings and cannot be deleted. Unpublish it instead to hide it from the website.");
      return failure(dbErrorMessage(error));
    }
    if (!data?.length) return failure("Not found or not permitted.");
    updateTag(TAGS.destinations);
    revalidatePackage((data[0] as { slug: string }).slug);
    redirect("/admin/packages?deleted=1");
  });
}
