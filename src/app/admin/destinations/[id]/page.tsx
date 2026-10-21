import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { AdminHeader, LoadError, Panel, sp } from "@/components/admin/AdminUI";
import { Alert, Badge } from "@/components/ui";
import { DESTINATION_FORM_COLUMNS, DestinationForm, type DestinationFormRow } from "../_components/DestinationForm";
import { deleteDestination, setDestinationPublished } from "../actions";

export const metadata: Metadata = { title: "Edit destination", robots: { index: false, follow: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditDestinationPage({ params, searchParams }: PageProps<"/admin/destinations/[id]">) {
  const { id } = await params;
  await requirePermission("catalog.manage", `/admin/destinations/${id}`);
  if (!UUID_RE.test(id)) notFound();
  const saved = sp((await searchParams).saved) === "1";

  const supabase = await createSupabaseServerClient();
  const [{ data, error }, used] = await Promise.all([
    supabase.from("destinations").select(DESTINATION_FORM_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("package_destinations").select("packages(id, title)").eq("destination_id", id),
  ]);
  if (!error && !data) notFound();
  const dest = data as unknown as DestinationFormRow | null;
  const packages = ((used.data ?? []) as unknown as { packages: { id: string; title: string } | null }[]).flatMap((r) =>
    r.packages ? [r.packages] : [],
  );

  return (
    <div className="space-y-6">
      <AdminHeader
        title={dest ? dest.name : "Edit destination"}
        back={{ href: "/admin/destinations", label: "Destinations" }}
        intro={
          dest && (
            <span className="flex flex-wrap items-center gap-2">
              {dest.is_published ? <Badge tone="green">Published</Badge> : <Badge tone="gray">Draft</Badge>}
              {dest.is_published && (
                <Link href={`/destinations/${dest.slug}`} className="text-forest-800 underline-offset-2 hover:underline" target="_blank">
                  View on site ↗
                </Link>
              )}
            </span>
          )
        }
      />
      {saved && <Alert tone="success" title="Destination created." />}
      {error || !dest ? (
        <LoadError what="the destination" />
      ) : (
        <>
          <DestinationForm dest={dest} />
          <Panel title="Used by packages">
            {used.error ? (
              <LoadError what="packages" />
            ) : packages.length === 0 ? (
              <p className="text-sm text-muted">Not used by any package.</p>
            ) : (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {packages.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/packages/${p.id}`} className="text-forest-800 underline-offset-2 hover:underline">
                      {p.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Danger zone" description="Destinations used by a package cannot be deleted — unpublish them instead.">
            <div className="flex flex-wrap gap-3">
              <ActionForm action={setDestinationPublished}>
                <input type="hidden" name="id" value={dest.id} />
                <input type="hidden" name="publish" value={dest.is_published ? "false" : "true"} />
                <AdminSubmit variant="outline">{dest.is_published ? "Unpublish" : "Publish"}</AdminSubmit>
              </ActionForm>
              <ActionForm action={deleteDestination} confirm={`Delete “${dest.name}” permanently? This cannot be undone.`}>
                <input type="hidden" name="id" value={dest.id} />
                <AdminSubmit variant="danger" pendingLabel="Deleting…">
                  Delete destination
                </AdminSubmit>
              </ActionForm>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
