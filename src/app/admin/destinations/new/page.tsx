import type { Metadata } from "next";
import { requirePermission } from "@/lib/server/auth";
import { AdminHeader } from "@/components/admin/AdminUI";
import { DestinationForm } from "../_components/DestinationForm";

export const metadata: Metadata = { title: "New destination", robots: { index: false, follow: false } };

export default async function NewDestinationPage() {
  await requirePermission("catalog.manage", "/admin/destinations/new");
  return (
    <div className="space-y-6">
      <AdminHeader title="New destination" back={{ href: "/admin/destinations", label: "Destinations" }} />
      <DestinationForm dest={null} />
    </div>
  );
}
