import { Badge } from "@/components/ui";
import type { PostStatus } from "./PostForm";

export function PostStatusBadge({ status, publishedAt, now }: { status: PostStatus; publishedAt: string | null; now: number }) {
  if (status === "published") {
    return publishedAt && Date.parse(publishedAt) > now ? <Badge tone="blue">Scheduled</Badge> : <Badge tone="green">Published</Badge>;
  }
  return status === "archived" ? <Badge tone="gray">Archived</Badge> : <Badge>Draft</Badge>;
}

/** Current time for "scheduled" checks (server render only). */
export function nowMs(): number {
  return Date.now();
}
