"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, type ActionState } from "@/lib/actions";
import { TAGS } from "@/lib/data/catalog";
import { adminAction, dbErrorMessage, success } from "@/lib/server/admin/errors";
import { checkbox, commaList, optIstDateTime, optText, parseForm, reqInt, reqText, uuid } from "@/lib/server/admin/forms";
import { resolveImage } from "@/lib/server/admin/images";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugSchema } from "@/lib/validation";

// ---------------------------------------------------------------------------
// Blog posts
// ---------------------------------------------------------------------------

const postSchema = z.object({
  id: uuid.optional(),
  slug: z
    .string({ error: "Slug is required" })
    .trim()
    .toLowerCase()
    .refine((v) => slugSchema.safeParse(v).success, {
      error: "Slug must use lowercase letters, numbers and single hyphens (max 120 characters)",
    }),
  title: reqText(160, "Title", 3),
  excerpt: reqText(300, "Excerpt"),
  body_markdown: z.string().max(100_000, { error: "Body must be at most 100,000 characters" }).default(""),
  tags: commaList(20, 40),
  status: z.enum(["draft", "published", "archived"], { error: "Choose a status" }),
  published_at: optIstDateTime("Publish date"),
  seo_title: optText(70, "SEO title"),
  seo_description: optText(170, "SEO description"),
});

function revalidatePost(...slugs: (string | null | undefined)[]) {
  updateTag(TAGS.blog);
  for (const s of new Set(slugs.filter(Boolean))) updateTag(`post:${s}`);
  refresh();
}

export async function savePost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("content.manage", async (viewer) => {
    const parsed = parseForm(postSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { id, published_at: explicitPublishedAt, ...fields } = parsed.data;
    const supabase = await createSupabaseServerClient();

    type Current = { id: string; slug: string; cover_url: string | null; published_at: string | null };
    let current: Current | null = null;
    if (id) {
      const { data, error } = await supabase.from("blog_posts").select("id, slug, cover_url, published_at").eq("id", id).maybeSingle();
      if (error) return failure(dbErrorMessage(error), formData);
      if (!data) return failure("Not found or not permitted.", formData);
      current = data as unknown as Current;
    }

    // Explicit date wins (a future date schedules the post); otherwise keep the
    // existing date, or stamp "now" the first time a post is published.
    const published_at =
      explicitPublishedAt ?? current?.published_at ?? (fields.status === "published" ? new Date().toISOString() : null);

    const cover = await resolveImage(formData, { folder: "blog", name: "cover", altName: "cover_alt", currentUrl: current?.cover_url ?? null });
    if (!cover.ok) return failure(cover.error, formData, { [cover.field]: cover.error });

    const row = { ...fields, published_at, cover_url: cover.url, cover_alt: cover.alt };

    if (current) {
      const { data, error } = await supabase.from("blog_posts").update(row).eq("id", current.id).select("id");
      if (error) return failure(dbErrorMessage(error), formData);
      if (!data?.length) return failure("Not found or not permitted.", formData);
      revalidatePost(fields.slug, current.slug);
      return success("Post saved.");
    }

    const { data, error } = await supabase
      .from("blog_posts")
      .insert({ ...row, author_id: viewer.id })
      .select("id")
      .single();
    if (error) return failure(dbErrorMessage(error), formData);
    revalidatePost(fields.slug);
    redirect(`/admin/content/posts/${(data as { id: string }).id}?saved=1`);
  });
}

export async function deletePost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("content.manage", async () => {
    const parsed = parseForm(z.object({ id: uuid }), formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("blog_posts").delete().eq("id", parsed.data.id).select("slug");
    if (error) return failure(dbErrorMessage(error));
    if (!data?.length) return failure("Not found or not permitted.");
    revalidatePost((data[0] as { slug: string }).slug);
    redirect("/admin/content?deleted=post");
  });
}

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------

const faqSchema = z.object({
  id: uuid.optional(),
  question: reqText(300, "Question", 5),
  answer: reqText(3000, "Answer", 5),
  category: z
    .string()
    .trim()
    .toLowerCase()
    .max(40, { error: "Category must be at most 40 characters" })
    .transform((v) => v || "general"),
  sort_order: reqInt(-10000, 10000, "Sort order"),
  is_published: checkbox,
});

export async function saveFaq(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("content.manage", async () => {
    const parsed = parseForm(faqSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { id, ...row } = parsed.data;
    const supabase = await createSupabaseServerClient();
    if (id) {
      const { data, error } = await supabase.from("faqs").update(row).eq("id", id).select("id");
      if (error) return failure(dbErrorMessage(error), formData);
      if (!data?.length) return failure("Not found or not permitted.", formData);
    } else {
      const { error } = await supabase.from("faqs").insert(row);
      if (error) return failure(dbErrorMessage(error), formData);
    }
    updateTag(TAGS.faqs);
    refresh();
    return success(id ? "FAQ saved." : "FAQ added.");
  });
}

export async function deleteFaq(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("content.manage", async () => {
    const parsed = parseForm(z.object({ id: uuid }), formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("faqs").delete().eq("id", parsed.data.id).select("id");
    if (error) return failure(dbErrorMessage(error));
    if (!data?.length) return failure("Not found or not permitted.");
    updateTag(TAGS.faqs);
    refresh();
    return success("FAQ deleted.");
  });
}
