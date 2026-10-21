import type { Metadata } from "next";
import { requirePermission } from "@/lib/server/auth";
import { AdminHeader } from "@/components/admin/AdminUI";
import { PostForm } from "../../_components/PostForm";

export const metadata: Metadata = { title: "New blog post", robots: { index: false, follow: false } };

export default async function NewPostPage() {
  await requirePermission("content.manage", "/admin/content/posts/new");
  return (
    <div className="space-y-6">
      <AdminHeader title="New blog post" back={{ href: "/admin/content", label: "Blog & FAQs" }} />
      <PostForm post={null} />
    </div>
  );
}
