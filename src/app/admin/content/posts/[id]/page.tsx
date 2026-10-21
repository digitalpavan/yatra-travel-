import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { AdminHeader, LoadError, Panel, sp } from "@/components/admin/AdminUI";
import { Alert } from "@/components/ui";
import { POST_FORM_COLUMNS, PostForm, type PostFormRow } from "../../_components/PostForm";
import { PostStatusBadge, nowMs } from "../../_components/PostStatusBadge";
import { deletePost } from "../../actions";

export const metadata: Metadata = { title: "Edit blog post", robots: { index: false, follow: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPostPage({ params, searchParams }: PageProps<"/admin/content/posts/[id]">) {
  const { id } = await params;
  await requirePermission("content.manage", `/admin/content/posts/${id}`);
  if (!UUID_RE.test(id)) notFound();
  const saved = sp((await searchParams).saved) === "1";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("blog_posts").select(POST_FORM_COLUMNS).eq("id", id).maybeSingle();
  if (!error && !data) notFound();
  const post = data as unknown as PostFormRow | null;
  const now = nowMs();

  return (
    <div className="space-y-6">
      <AdminHeader
        title={post ? post.title : "Edit blog post"}
        back={{ href: "/admin/content", label: "Blog & FAQs" }}
        intro={
          post && (
            <span className="flex flex-wrap items-center gap-2">
              <PostStatusBadge status={post.status} publishedAt={post.published_at} now={now} />
              {post.published_at && <span>Publish date: {formatDateTime(post.published_at)}</span>}
            </span>
          )
        }
      />
      {saved && <Alert tone="success" title="Post created." />}
      {error || !post ? (
        <LoadError what="the post" />
      ) : (
        <>
          <PostForm post={post} />
          <Panel title="Danger zone" description="To hide a post without deleting it, set its status to Draft or Archived.">
            <ActionForm action={deletePost} confirm={`Delete “${post.title}” permanently? This cannot be undone.`}>
              <input type="hidden" name="id" value={post.id} />
              <AdminSubmit variant="danger" pendingLabel="Deleting…">
                Delete post
              </AdminSubmit>
            </ActionForm>
          </Panel>
        </>
      )}
    </div>
  );
}
