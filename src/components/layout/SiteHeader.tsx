import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { MobileNav } from "@/components/layout/MobileNav";
import { buttonClass } from "@/components/ui";
import { MAIN_NAV } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ivory/95 backdrop-blur supports-[backdrop-filter]:bg-ivory/80">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Yatra Travel home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="rounded-full px-3 py-2 text-sm font-medium text-forest-900 hover:bg-forest-50">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/account" className="px-2 text-sm font-medium text-forest-900 hover:underline">
            My account
          </Link>
          <Link href="/packages" className={buttonClass("gold", "sm")}>
            Book a trip
          </Link>
        </div>
        {/* MobileNav reads the URL (usePathname), so it must sit inside Suspense under Cache Components. */}
        <Suspense fallback={<span className="h-10 w-10 lg:hidden" aria-hidden />}>
          <MobileNav items={[...MAIN_NAV, { href: "/contact", label: "Contact" }, { href: "/account", label: "My account" }]} />
        </Suspense>
      </div>
    </header>
  );
}
