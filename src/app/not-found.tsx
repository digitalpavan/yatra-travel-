import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ButtonLink, Container } from "@/components/ui";

export const metadata = { title: "Page not found", robots: { index: false, follow: false } };

/** Fallback for URLs that match no route at all. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Container className="py-20 text-center">
          <p className="text-sm font-semibold tracking-widest text-gold-600 uppercase">404</p>
          <h1 className="mt-2 text-3xl font-semibold">We couldn&apos;t find that page</h1>
          <p className="mx-auto mt-3 max-w-md text-muted">The link may be old or mistyped. These might help:</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/">Home</ButtonLink>
            <ButtonLink href="/packages" variant="outline">Tour packages</ButtonLink>
            <ButtonLink href="/cab-booking" variant="outline">Cab booking</ButtonLink>
          </div>
          <p className="mt-6 text-sm"><Link href="/contact" className="underline">Contact us</Link></p>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
