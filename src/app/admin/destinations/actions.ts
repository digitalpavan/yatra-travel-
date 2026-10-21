"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, type ActionState } from "@/lib/actions";
import { TAGS } from "@/lib/data/catalog";
import { adminAction, dbErrorMessage, success } from "@/lib/server/admin/errors";
import { checkbox, optInt, optNumber, optText, parseForm, reqInt, reqText, uuid } from "@/lib/server/admin/forms";
import { resolveImage } from "@/lib/server/admin/images";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugSchema } from "@/lib/validation";

const slugField = z
  .string({ error: "Slug is required" })
  .trim()
  .toLowerCase()
  .refine((v) => slugSchema.safeParse(v).success, {
    error: "Slug must use lowercase letters, numbers and single hyphens (max 120 characters)",
  });

const destinationSchema = z.object({
  id: uuid.optional(),
  slug: slugField,
  name: reqText(120, "Name", 2),
  category: z.enum(["temple", "sightseeing", "nature", "heritage", "city"], { error: "Choose a category" }),
  region: reqText(120, "Region"),
  short_description: reqText(300, "Short description"),
  description: z.string().trim().max(20000, { error: "Description must be at most 20000 characters" }).default(""),
  latitude: optNumber(-90, 90, "Latitude"),
  longitude: optNumber(-180, 180, "Longitude"),
  distance_from_tirupati_km: optInt(0, 5000, "Distance"),
  best_time_to_visit: optText(200, "Best time to visit"),
  visitor_note: optText(500, "Visitor note"),
  is_published: checkbox,
  sort_order: reqInt(-10000, 10000, "Sort order"),
  seo_title: optText(70, "SEO title"),
  seo_description: optText(170, "SEO description"),
});

function revalidateDestination(...slugs: (string | null | undefined)[]) {
  updateTag(TAGS.destinations);
  updateTag(TAGS.packages); // package pages embed destination names/slugs
  for (const s of new Set(slugs.filter(Boolean))) updateTag(`destination:${s}`);
  refresh();
}

export async function saveDestination(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("catalog.manage", async () => {
    const parsed = parseForm(destinationSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { id, ...fields } = parsed.data;
    const supabase = await createSupabaseServerClient();

    let current: { id: string; slug: string; image_url: string | null } | null = null;
    if (id) {
      const { data, error } = await supabase.from("destinations").select("id, slug, image_url").eq("id", id).maybeSingle();
      if (error) return failure(dbErrorMessage(error), formData);
      if (!data) return failure("Not found or not permitted.", formData);
      current = data as unknown as { id: string; slug: string; image_url: string | null };
    }

    const image = await resolveImage(formData, { folder: "destinations", currentUrl: current?.image_url ?? null });
    if (!image.ok) return failure(image.error, formData, { [image.field]: image.error });
    const row = { ...fields, image_url: image.url, image_alt: image.alt };

    if (current) {
      const { data, error } = await supabase.from("destinations").update(row).eq("id", current.id).select("id");
      if (error) return failure(dbErrorMessage(error), formData);
      if (!data?.length) return failure("Not found or not permitted.", formData);
      revalidateDestination(fields.slug, current.slug);
      return success("Destination saved.");
    }

    const { data, error } = await supabase.from("destinations").insert(row).select("id").single();
    if (error) return failure(dbErrorMessage(error), formData);
    revalidateDestination(fields.slug);
    redirect(`/admin/destinations/${(data as { id: string }).id}?saved=1`);
  });
}

export async function setDestinationPublished(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("catalog.manage", async () => {
    const parsed = parseForm(z.object({ id: uuid, publish: z.enum(["true", "false"]) }), formData);
    if (!parsed.ok) return parsed.state;
    const publish = parsed.data.publish === "true";
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("destinations").update({ is_published: publish }).eq("id", parsed.data.id).select("slug");
    if (error) return failure(dbErrorMessage(error));
    if (!data?.length) return failure("Not found or not permitted.");
    revalidateDestination((data[0] as { slug: string }).slug);
    return success(publish ? "Destination published." : "Destination unpublished.");
  });
}

export async function deleteDestination(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("catalog.manage", async () => {
    const parsed = parseForm(z.object({ id: uuid }), formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("destinations").delete().eq("id", parsed.data.id).select("slug");
    if (error) {
      if (error.code === "23503") return failure("This destination is used by a package and cannot be deleted. Unpublish it instead, or remove it from those packages first.");
      return failure(dbErrorMessage(error));
    }
    if (!data?.length) return failure("Not found or not permitted.");
    revalidateDestination((data[0] as { slug: string }).slug);
    redirect("/admin/destinations?deleted=1");
  });
}
