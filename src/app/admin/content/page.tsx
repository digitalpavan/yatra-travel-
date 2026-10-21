import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { AdminHeader, LoadError, Panel, TableWrap, Td, Th, sp } from "@/components/admin/AdminUI";
import { Alert, Badge, ButtonLink, Checkbox, EmptyState, Input, Textarea } from "@/components/ui";
import { PostStatusBadge, nowMs } from "./_components/PostStatusBadge";
import type { PostStatus } from "./_components/PostForm";
import { deleteFaq, saveFaq } from "./actions";

export const metadata: Metadata = { title: "Blog & FAQs", robots: { index: false, follow: false } };

interface PostRow {
  id: string;
  slug: string;
  title: string;
  status: PostStatus;
  published_at: string | null;
  updated_at: string;
  tags: string[];
}

interface FaqRow {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
  is_published: boolean;
}

const FAQ_LABELS = { question: "Question", answer: "Answer", category: "Category", sort_order: "Sort order" };

function FaqFields({ faq, idPrefix, categories }: { faq: FaqRow | null; idPrefix: string; categories: string[] }) {
  const id = (n: string) => `${idPrefix}-${n}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {faq && <input type="hidden" name="id" value={faq.id} />}
      <div className="sm:col-span-2">
        <label htmlFor={id("question")} className="mb-1.5 block text-sm font-medium text-forest-900">
          Question <span className="text-red-700" aria-hidden>*</span>
        </label>
        <Input id={id("question")} name="question" defaultValue={faq?.question ?? ""} required minLength={5} maxLength={300} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={id("answer")} className="mb-1.5 block text-sm font-medium text-forest-900">
          Answer <span className="text-red-700" aria-hidden>*</span>
        </label>
        <Textarea id={id("answer")} name="answer" defaultValue={faq?.answer ?? ""} required minLength={5} maxLength={3000} rows={4} />
      </div>
      <div>
        <label htmlFor={id("category")} className="mb-1.5 block text-sm font-medium text-forest-900">
          Category
        </label>
        <Input id={id("category")} name="category" defaultValue={faq?.category ?? "general"} maxLength={40} list="faq-categories" />
        {categories.length > 0 && idPrefix === "faq-new" && (
          <datalist id="faq-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
      </div>
      <div>
        <label htmlFor={id("sort_order")} className="mb-1.5 block text-sm font-medium text-forest-900">
          Sort order
        </label>
        <Input id={id("sort_order")} type="number" name="sort_order" defaultValue={faq?.sort_order ?? 0} />
      </div>
      <div className="sm:col-span-2">
        <Checkbox id={id("is_published")} name="is_published" label="Published" defaultChecked={faq?.is_published ?? true} />
      </div>
    </div>
  );
}

export default async function ContentPage({ searchParams }: PageProps<"/admin/content">) {
  await requirePermission("content.manage", "/admin/content");
  const deleted = sp((await searchParams).deleted) === "post";

  const supabase = await createSupabaseServerClient();
  const [posts, faqs] = await Promise.all([
    supabase
      .from("blog_posts")
      .select("id, slug, title, status, published_at, updated_at, tags")
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase.from("faqs").select("id, question, answer, category, sort_order, is_published").order("category").order("sort_order").limit(500),
  ]);
  const postRows = (posts.data ?? []) as unknown as PostRow[];
  const faqRows = (faqs.data ?? []) as unknown as FaqRow[];
  const categories = [...new Set(faqRows.map((f) => f.category))].sort();
  const now = nowMs();

  return (
    <div className="space-y-6">
      <AdminHeader title="Blog & FAQs" intro="Articles for the blog and the questions shown on the FAQ page." />
      {deleted && <Alert tone="success" title="Post deleted." />}

      <Panel id="posts" title="Blog posts" actions={<ButtonLink href="/admin/content/posts/new" size="sm">New post</ButtonLink>}>
        {posts.error ? (
          <LoadError what="blog posts" />
        ) : postRows.length === 0 ? (
          <EmptyState title="No blog posts yet" />
        ) : (
          <TableWrap label="Blog posts">
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Status</Th>
                <Th>Publish date</Th>
                <Th>Tags</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {postRows.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/admin/content/posts/${p.id}`} className="font-medium text-forest-800 underline-offset-2 hover:underline">
                      {p.title}
                    </Link>
                    <div className="font-mono text-xs text-muted">{p.slug}</div>
                  </Td>
                  <Td>
                    <PostStatusBadge status={p.status} publishedAt={p.published_at} now={now} />
                  </Td>
                  <Td className="whitespace-nowrap">{p.published_at ? formatDateTime(p.published_at) : "—"}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {p.tags.map((t) => (
                        <Badge key={t} tone="gray">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDateTime(p.updated_at)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Panel id="faqs" title="FAQs" description="Grouped by category on the public FAQ page; lower sort numbers appear first.">
        <details className="mb-6 rounded-xl border border-line p-4">
          <summary className="cursor-pointer font-semibold text-forest-800">Add FAQ</summary>
          <ActionForm action={saveFaq} resetOnSuccess labels={FAQ_LABELS} className="mt-4 space-y-4">
            <FaqFields faq={null} idPrefix="faq-new" categories={categories} />
            <AdminSubmit>Add FAQ</AdminSubmit>
          </ActionForm>
        </details>

        {faqs.error ? (
          <LoadError what="FAQs" />
        ) : faqRows.length === 0 ? (
          <EmptyState title="No FAQs yet" />
        ) : (
          <ul className="space-y-2">
            {faqRows.map((f) => (
              <li key={f.id}>
                <details className="rounded-xl border border-line">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
                    <span className="min-w-0 flex-1 font-medium">{f.question}</span>
                    <Badge tone="blue">{f.category}</Badge>
                    {!f.is_published && <Badge tone="gray">Hidden</Badge>}
                    <span className="text-xs text-muted">#{f.sort_order}</span>
                  </summary>
                  <div className="space-y-4 border-t border-line px-4 py-4">
                    <ActionForm action={saveFaq} labels={FAQ_LABELS} className="space-y-4">
                      <FaqFields faq={f} idPrefix={`faq-${f.id}`} categories={categories} />
                      <AdminSubmit size="sm">Save FAQ</AdminSubmit>
                    </ActionForm>
                    <ActionForm action={deleteFaq} confirm="Delete this FAQ permanently?">
                      <input type="hidden" name="id" value={f.id} />
                      <AdminSubmit variant="danger" size="sm" pendingLabel="Deleting…">
                        Delete FAQ
                      </AdminSubmit>
                    </ActionForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
