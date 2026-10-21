import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/(auth)/actions";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Container, LoadingBlock } from "@/components/ui";

const NAV = [
  { href: "/account", label: "Overview" },
  { href: "/account/bookings", label: "My bookings" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/support", label: "Support" },
  { href: "/account/privacy", label: "Privacy & data" },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Container className="grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
          <aside aria-label="Account">
            <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:gap-1">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-forest-900 hover:bg-forest-50">
                  {item.label}
                </Link>
              ))}
              <form action={signOut} className="shrink-0 lg:mt-4">
                <button type="submit" className="rounded-lg px-3 py-2 text-left text-sm font-medium text-red-800 hover:bg-red-50">
                  Sign out
                </button>
              </form>
            </nav>
          </aside>
          <div className="min-w-0">
            <Suspense fallback={<LoadingBlock />}>{children}</Suspense>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
