import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex flex-1 items-start justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
