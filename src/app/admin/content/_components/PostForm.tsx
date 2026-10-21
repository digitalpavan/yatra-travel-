import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { ImageField } from "@/components/admin/ImageField";
import { Panel } from "@/components/admin/AdminUI";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { TIME_ZONE } from "@/lib/dates";
import { savePost } from "../actions";

export type PostStatus = "draft" | "published" | "archived";

export interface PostFormRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_markdown: string;
  cover_url: string | null;
  cover_alt: string | null;
  tags: string[];
  status: PostStatus;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

export const POST_FORM_COLUMNS =
  "id, slug, title, excerpt, body_markdown, cover_url, cover_alt, tags, status, published_at, seo_title, seo_description";

const LABELS: Record<string, string> = {
  slug: "Slug",
  title: "Title",
  excerpt: "Excerpt",
  body_markdown: "Body",
  cover: "Cover image",
  cover_alt: "Cover alt text",
  tags: "Tags",
  status: "Status",
  published_at: "Publish date",
  seo_title: "SEO title",
  seo_description: "SEO description",
};

/** ISO timestamp → "YYYY-MM-DDTHH:MM" in IST for <input type="datetime-local">. */
function toIstLocal(iso: string | null): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function PostForm({ post }: { post: PostFormRow | null }) {
  return (
    <ActionForm action={savePost} encType="multipart/form-data" labels={LABELS} className="space-y-6">
      {post && <input type="hidden" name="id" value={post.id} />}
      <Panel title="Post">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" name="title" required>
            <Input name="title" defaultValue={post?.title ?? ""} required minLength={3} maxLength={160} />
          </Field>
          <Field label="Slug (URL)" name="slug" required hint="Lowercase letters, numbers and hyphens">
            <Input
              name="slug"
              defaultValue={post?.slug ?? ""}
              required
              maxLength={120}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              hint="Lowercase letters, numbers and hyphens"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Excerpt" name="excerpt" required hint="Up to 300 characters, shown in post lists.">
              <Textarea name="excerpt" defaultValue={post?.excerpt ?? ""} required maxLength={300} rows={3} hint="Up to 300 characters, shown in post lists." />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Body (Markdown)" name="body_markdown">
              <Textarea name="body_markdown" defaultValue={post?.body_markdown ?? ""} rows={24} className="font-mono text-[13px]" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Tags" name="tags" hint="Comma separated, e.g. tirumala, travel tips">
              <Input name="tags" defaultValue={(post?.tags ?? []).join(", ")} hint="Comma separated, e.g. tirumala, travel tips" />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel title="Cover image">
        <ImageField name="cover" altName="cover_alt" currentUrl={post?.cover_url} currentAlt={post?.cover_alt} label="Cover image" />
      </Panel>

      <Panel title="Publishing & SEO">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status" name="status" required>
            <Select name="status" defaultValue={post?.status ?? "draft"} required>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <Field
            label="Publish date (IST)"
            name="published_at"
            hint="Optional. Leave blank to publish now. A future date schedules the post — it appears on the site from then."
          >
            <Input
              type="datetime-local"
              name="published_at"
              defaultValue={toIstLocal(post?.published_at ?? null)}
              hint="Optional. Leave blank to publish now. A future date schedules the post — it appears on the site from then."
            />
          </Field>
          <Field label="SEO title" name="seo_title" hint="Up to 70 characters.">
            <Input name="seo_title" defaultValue={post?.seo_title ?? ""} maxLength={70} />
          </Field>
          <Field label="SEO description" name="seo_description" hint="Up to 170 characters.">
            <Textarea name="seo_description" defaultValue={post?.seo_description ?? ""} maxLength={170} rows={3} />
          </Field>
        </div>
      </Panel>

      <div className="flex justify-end">
        <AdminSubmit>{post ? "Save post" : "Create post"}</AdminSubmit>
      </div>
    </ActionForm>
  );
}
