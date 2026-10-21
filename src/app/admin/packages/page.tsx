import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatINR } from "@/lib/money";
import { PACKAGE_CATEGORY_LABELS, type PackageSummary } from "@/lib/types";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { AdminHeader, LoadError, Panel, TableWrap, Td, Th, sp } from "@/components/admin/AdminUI";
import { Alert, Badge, ButtonLink, EmptyState } from "@/components/ui";
import { setPackagePublished } from "./actions";

export const metadata: Metadata = { title: "Packages", robots: { index: false, follow: false } };

interface Row {
  id: string;
  slug: string;
  title: string;
  category: PackageSummary["category"];
  duration_days: number;
  duration_nights: number;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
  package_prices: { price_paise: number }[];
}

export default async function PackagesPage({ searchParams }: PageProps<"/admin/packages">) {
  await requirePermission("catalog.manage", "/admin/packages");
  const deleted = sp((await searchParams).deleted) === "1";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("packages")
    .select("id, slug, title, category, duration_days, duration_nights, is_published, is_featured, sort_order, package_prices(price_paise)")
    .order("sort_order")
    .order("title")
    .limit(500);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Packages"
        intro="Tour packages shown on the website. Prices are set per vehicle class."
        actions={<ButtonLink href="/admin/packages/new">New package</ButtonLink>}
      />
      {deleted && <Alert tone="success" title="Package deleted." />}
      <Panel>
        {error ? (
          <LoadError what="packages" />
        ) : rows.length === 0 ? (
          <EmptyState title="No packages yet" action={<ButtonLink href="/admin/packages/new">Create the first package</ButtonLink>} />
        ) : (
          <TableWrap label="Packages">
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Category</Th>
                <Th>Duration</Th>
                <Th>Status</Th>
                <Th className="text-right">From</Th>
                <Th className="text-right">Sort</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const prices = p.package_prices.map((x) => x.price_paise);
                return (
                  <tr key={p.id}>
                    <Td>
                      <Link href={`/admin/packages/${p.id}`} className="font-medium text-forest-800 underline-offset-2 hover:underline">
                        {p.title}
                      </Link>
                      <div className="font-mono text-xs text-muted">{p.slug}</div>
                    </Td>
                    <Td>{PACKAGE_CATEGORY_LABELS[p.category] ?? p.category}</Td>
                    <Td className="whitespace-nowrap">
                      {p.duration_days}D{p.duration_nights > 0 ? ` / ${p.duration_nights}N` : ""}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {p.is_published ? <Badge tone="green">Published</Badge> : <Badge tone="gray">Draft</Badge>}
                        {p.is_featured && <Badge>Featured</Badge>}
                      </div>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
                      {prices.length ? formatINR(Math.min(...prices)) : <span className="text-red-800">No prices</span>}
                    </Td>
                    <Td className="text-right">{p.sort_order}</Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <ButtonLink href={`/admin/packages/${p.id}`} variant="outline" size="sm">
                          Edit
                        </ButtonLink>
                        <ActionForm action={setPackagePublished} showErrorList={false}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="publish" value={p.is_published ? "false" : "true"} />
                          <AdminSubmit variant="ghost" size="sm" pendingLabel="…">
                            {p.is_published ? "Unpublish" : "Publish"}
                          </AdminSubmit>
                        </ActionForm>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
