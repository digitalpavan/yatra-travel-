import Link from "next/link";
import { getViewer } from "@/lib/server/auth";
import { ROLE_LABELS, type Permission } from "@/lib/permissions";
import { NavLinks, type NavItem } from "@/components/admin/NavLinks";

const ITEMS: (NavItem & { permission: Permission | Permission[] })[] = [
  { href: "/admin", label: "Overview", permission: "reports.read" },
  { href: "/admin/bookings", label: "Bookings", permission: "bookings.read" },
  { href: "/admin/trips", label: "Trips", permission: ["bookings.read", "trips.own"] },
  { href: "/admin/packages", label: "Packages", permission: "catalog.manage" },
  { href: "/admin/destinations", label: "Destinations", permission: "catalog.manage" },
  { href: "/admin/fleet", label: "Fleet", permission: "fleet.manage" },
  { href: "/admin/pricing", label: "Pricing & coupons", permission: ["catalog.manage", "coupons.manage"] },
  { href: "/admin/payments", label: "Payments & refunds", permission: ["payments.read", "refunds.manage"] },
  { href: "/admin/support", label: "Support", permission: "support.manage" },
  { href: "/admin/reviews", label: "Reviews", permission: "reviews.manage" },
  { href: "/admin/content", label: "Blog & FAQs", permission: "content.manage" },
  { href: "/admin/settings", label: "Settings", permission: "settings.manage" },
  { href: "/admin/staff", label: "Staff", permission: "staff.manage" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.read" },
];

/** Role-aware navigation. Reads the viewer, so it must render inside <Suspense>. */
export async function AdminNav() {
  const viewer = await getViewer();
  if (!viewer || viewer.role === "customer") return null;

  const items =
    viewer.role === "driver"
      ? [{ href: "/admin/trips", label: "My trips" }]
      : ITEMS.filter((item) => {
          const needed = Array.isArray(item.permission) ? item.permission : [item.permission];
          return needed.some((p) => viewer.permissions.includes(p));
        }).map(({ href, label }) => ({ href, label }));

  return (
    <div className="flex flex-col gap-4">
      <NavLinks items={items} />
      <div className="hidden border-t border-forest-700 pt-4 text-xs text-forest-100 lg:block">
        <p className="truncate font-medium text-white" title={viewer.email ?? undefined}>
          {viewer.email ?? "Signed in"}
        </p>
        <p className="mt-0.5 text-gold-200">{ROLE_LABELS[viewer.role]}</p>
        <div className="mt-3 flex gap-3">
          <Link href="/" className="underline-offset-2 hover:text-white hover:underline">
            View site
          </Link>
          <Link href="/account" className="underline-offset-2 hover:text-white hover:underline">
            My account
          </Link>
        </div>
      </div>
    </div>
  );
}
