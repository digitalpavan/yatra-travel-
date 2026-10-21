import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DESTINATION_CATEGORY_LABELS, type Destination } from "@/lib/types";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { AdminHeader, LoadError, Panel, TableWrap, Td, Th, sp } from "@/components/admin/AdminUI";
import { Alert, Badge, ButtonLink, EmptyState } from "@/components/ui";
import { setDestinationPublished } from "./actions";

export const metadata: Metadata = { title: "Destinations", robots: { index: false, follow: false } };

interface Row {
  id: string;
  slug: string;
  name: string;
  category: Destination["category"];
  region: string;
  distance_from_tirupati_km: number | null;
  is_published: boolean;
  sort_order: number;
  image_url: string | null;
}

export default async function DestinationsPage({ searchParams }: PageProps<"/admin/destinations">) {
  await requirePermission("catalog.manage", "/admin/destinations");
  const deleted = sp((await searchParams).deleted) === "1";

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("destinations")
    .select("id, slug, name, category, region, distance_from_tirupati_km, is_published, sort_order, image_url")
    .order("sort_order")
    .order("name")
    .limit(500);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Destinations"
        intro="Temples and places shown on the website and linked from packages."
        actions={<ButtonLink href="/admin/destinations/new">New destination</ButtonLink>}
      />
      {deleted && <Alert tone="success" title="Destination deleted." />}
      <Panel>
        {error ? (
          <LoadError what="destinations" />
        ) : rows.length === 0 ? (
          <EmptyState title="No destinations yet" action={<ButtonLink href="/admin/destinations/new">Create the first destination</ButtonLink>} />
        ) : (
          <TableWrap label="Destinations">
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Category</Th>
                <Th>Region</Th>
                <Th className="text-right">Distance</Th>
                <Th>Status</Th>
                <Th className="text-right">Sort</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <Td>
                    <Link href={`/admin/destinations/${d.id}`} className="font-medium text-forest-800 underline-offset-2 hover:underline">
                      {d.name}
                    </Link>
                    <div className="font-mono text-xs text-muted">{d.slug}</div>
                  </Td>
                  <Td>{DESTINATION_CATEGORY_LABELS[d.category] ?? d.category}</Td>
                  <Td>{d.region}</Td>
                  <Td className="text-right whitespace-nowrap">{d.distance_from_tirupati_km != null ? `${d.distance_from_tirupati_km} km` : "—"}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {d.is_published ? <Badge tone="green">Published</Badge> : <Badge tone="gray">Draft</Badge>}
                      {!d.image_url && <Badge tone="gold">No image</Badge>}
                    </div>
                  </Td>
                  <Td className="text-right">{d.sort_order}</Td>
                  <Td className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <ButtonLink href={`/admin/destinations/${d.id}`} variant="outline" size="sm">
                        Edit
                      </ButtonLink>
                      <ActionForm action={setDestinationPublished} showErrorList={false}>
                        <input type="hidden" name="id" value={d.id} />
                        <input type="hidden" name="publish" value={d.is_published ? "false" : "true"} />
                        <AdminSubmit variant="ghost" size="sm" pendingLabel="…">
                          {d.is_published ? "Unpublish" : "Publish"}
                        </AdminSubmit>
                      </ActionForm>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </div>
  );
}
