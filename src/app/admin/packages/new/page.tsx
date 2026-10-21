import type { Metadata } from "next";
import { requirePermission } from "@/lib/server/auth";
import { AdminHeader, LoadError } from "@/components/admin/AdminUI";
import { PackageForm } from "../_components/PackageForm";
import { loadPackageFormOptions } from "../_components/options";

export const metadata: Metadata = { title: "New package", robots: { index: false, follow: false } };

export default async function NewPackagePage() {
  await requirePermission("catalog.manage", "/admin/packages/new");
  const { rates, destinations, error } = await loadPackageFormOptions();

  return (
    <div className="space-y-6">
      <AdminHeader title="New package" back={{ href: "/admin/packages", label: "Packages" }} intro="New packages start unpublished unless you tick Published." />
      {error ? <LoadError what="vehicle classes or destinations" /> : <PackageForm pkg={null} rates={rates} destinations={destinations} />}
    </div>
  );
}
