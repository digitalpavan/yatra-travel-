import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/dates";
import { Badge, EmptyState } from "@/components/ui";
import { AdminHeader, LoadError, Pagination, Panel, pageParam, sp } from "@/components/admin/AdminUI";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { moderateReview } from "./actions";

export const metadata: Metadata = { title: "Reviews", robots: { index: false, follow: false } };

const PAGE_SIZE = 20;
const TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;
type Tab = (typeof TABS)[number]["value"];

interface ReviewRow {
  id: string;
  display_name: string;
  rating: number;
  title: string | null;
  body: string;
  status: Tab;
  moderated_at: string | null;
  created_at: string;
  bookings: { reference: string } | null;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-gold-600" aria-label={`${rating} out of 5 stars`} title={`${rating} / 5`}>
      <span aria-hidden>{"★".repeat(rating) + "☆".repeat(5 - rating)}</span>
    </span>
  );
}

export default async function ReviewsPage({ searchParams }: PageProps<"/admin/reviews">) {
  await requirePermission("reviews.manage", "/admin/reviews");
  const params = await searchParams;
  const requested = sp(params.status);
  const status: Tab = TABS.some((t) => t.value === requested) ? (requested as Tab) : "pending";
  const page = pageParam(params.page);

  const supabase = await createSupabaseServerClient();
  const { data, error, count } = await supabase
    .from("reviews")
    .select("id, display_name, rating, title, body, status, moderated_at, created_at, bookings(reference)", { count: "exact" })
    .eq("status", status)
    // Pending: oldest first (queue). Others: most recent first.
    .order("created_at", { ascending: status === "pending" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data ?? []) as unknown as ReviewRow[];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Reviews"
        back={{ href: "/admin", label: "Overview" }}
        intro="Customers can review completed trips. Approved reviews appear as testimonials on the website (display name, rating, title and text only)."
      />
      <nav aria-label="Filter reviews by status" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={t.value === "pending" ? "/admin/reviews" : `/admin/reviews?status=${t.value}`}
            aria-current={t.value === status ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${t.value === status ? "border-forest-800 bg-forest-800 text-white" : "border-line text-forest-800 hover:bg-forest-50"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Panel>
        {error ? (
          <LoadError what="reviews" />
        ) : rows.length === 0 ? (
          <EmptyState title={status === "pending" ? "No reviews waiting for moderation" : `No ${status} reviews`} />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Stars rating={r.rating} />
                    <span className="font-semibold">{r.display_name}</span>
                    <Badge tone={r.status === "approved" ? "green" : r.status === "rejected" ? "gray" : "gold"}>{r.status}</Badge>
                    {r.bookings && (
                      <Link className="text-forest-800 hover:underline" href={`/admin/bookings/${r.bookings.reference}`}>
                        {r.bookings.reference}
                      </Link>
                    )}
                    <span className="text-xs text-muted">
                      Submitted {formatDateTime(r.created_at)}
                      {r.moderated_at && <> · moderated {formatDateTime(r.moderated_at)}</>}
                    </span>
                  </div>
                  {r.title && <p className="mt-2 font-semibold text-forest-900">{r.title}</p>}
                  <p className="mt-1 text-sm break-words whitespace-pre-line text-charcoal">{r.body}</p>
                  <ActionForm action={moderateReview} className="mt-3">
                    <input type="hidden" name="id" value={r.id} />
                    <div className="flex flex-wrap gap-2">
                      {r.status !== "approved" && (
                        <AdminSubmit size="sm" name="status" value="approved">
                          Approve
                        </AdminSubmit>
                      )}
                      {r.status !== "rejected" && (
                        <AdminSubmit size="sm" variant="outline" name="status" value="rejected">
                          {r.status === "approved" ? "Unpublish (reject)" : "Reject"}
                        </AdminSubmit>
                      )}
                    </div>
                  </ActionForm>
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={count ?? null}
              basePath="/admin/reviews"
              params={{ status: status === "pending" ? undefined : status }}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
