import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { LoadingBlock, Skeleton } from "@/components/ui";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = {
  title: { template: "%s · Admin | Yatra Travel", default: "Admin | Yatra Travel" },
  robots: { index: false, follow: false },
};

function NavFallback() {
  return (
    <div className="flex gap-2 lg:flex-col" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-8 w-24 bg-forest-700 lg:w-full" />
      ))}
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-screen bg-ivory lg:flex">
      <a
        href="#admin-main"
        className="sr-only z-50 rounded-lg bg-gold-400 px-4 py-2 font-semibold text-forest-900 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <aside className="bg-forest-800 px-4 py-3 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:py-6">
        <Link href="/admin" className="mb-3 flex items-center gap-2.5 lg:mb-8">
          <LogoMark className="h-9 w-9 shrink-0" />
          <span className="leading-tight">
            <span className="block font-display text-lg font-semibold text-white">
              Yatra <span className="text-gold-300">Travel</span>
            </span>
            <span className="block text-[11px] tracking-[0.18em] text-gold-200 uppercase">Admin</span>
          </span>
        </Link>
        <Suspense fallback={<NavFallback />}>
          <AdminNav />
        </Suspense>
      </aside>
      <main id="admin-main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<LoadingBlock />}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}
