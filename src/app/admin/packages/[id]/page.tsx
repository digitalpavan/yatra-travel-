import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { AdminHeader, LoadError, Panel, sp } from "@/components/admin/AdminUI";
import { Alert, Badge } from "@/components/ui";
import { PACKAGE_FORM_COLUMNS, PackageForm, type PackageFormRow } from "../_components/PackageForm";
import { loadPackageFormOptions } from "../_components/options";
import { deletePackage, setPackagePublished } from "../actions";

export const metadata: Metadata = { title: "Edit package", robots: { index: false, follow: false } };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPackagePage({ params, searchParams }: PageProps<"/admin/packages/[id]">) {
  const { id } = await params;
  await requirePermission("catalog.manage", `/admin/packages/${id}`);
  if (!UUID_RE.test(id)) notFound();
  const saved = sp((await searchParams).saved);

  const supabase = await createSupabaseServerClient();
  const [{ data, error }, options] = await Promise.all([
    supabase.from("packages").select(PACKAGE_FORM_COLUMNS).eq("id", id).maybeSingle(),
    loadPackageFormOptions(),
  ]);
  if (!error && !data) notFound();
  const pkg = data as unknown as PackageFormRow | null;

  return (
    <div className="space-y-6">
      <AdminHeader
        title={pkg ? pkg.title : "Edit package"}
        back={{ href: "/admin/packages", label: "Packages" }}
        intro={
          pkg && (
            <span className="flex flex-wrap items-center gap-2">
              {pkg.is_published ? <Badge tone="green">Published</Badge> : <Badge tone="gray">Draft</Badge>}
              {pkg.is_featured && <Badge>Featured</Badge>}
              {pkg.is_published && (
                <Link href={`/packages/${pkg.slug}`} className="text-forest-800 underline-offset-2 hover:underline" target="_blank">
                  View on site ↗
                </Link>
              )}
            </span>
          )
        }
      />
      {saved === "1" && <Alert tone="success" title="Package created." />}
      {saved === "partial" && (
        <Alert tone="warning" title="Package created, but prices or destinations could not be saved.">
          Please review the prices and destinations below and save again.
        </Alert>
      )}
      {error || options.error || !pkg ? (
        <LoadError what="the package" />
      ) : (
        <>
          <PackageForm pkg={pkg} rates={options.rates} destinations={options.destinations} />
          <Panel title="Danger zone" description="Packages with bookings cannot be deleted — unpublish them instead.">
            <div className="flex flex-wrap gap-3">
              <ActionForm action={setPackagePublished}>
                <input type="hidden" name="id" value={pkg.id} />
                <input type="hidden" name="publish" value={pkg.is_published ? "false" : "true"} />
                <AdminSubmit variant="outline">{pkg.is_published ? "Unpublish" : "Publish"}</AdminSubmit>
              </ActionForm>
              <ActionForm action={deletePackage} confirm={`Delete “${pkg.title}” permanently? This cannot be undone.`}>
                <input type="hidden" name="id" value={pkg.id} />
                <AdminSubmit variant="danger" pendingLabel="Deleting…">
                  Delete package
                </AdminSubmit>
              </ActionForm>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
