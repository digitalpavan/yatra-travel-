import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { ButtonLink, Container } from "@/components/ui";

export const metadata = { title: "Page not found", robots: { index: false, follow: true } };

const LINKS = [
  { href: "/packages", label: "Tour packages" },
  { href: "/tirumala-tirupati", label: "Tirumala travel guide" },
  { href: "/temple-tours", label: "Temple tours" },
  { href: "/destinations", label: "Destinations" },
  { href: "/cab-booking", label: "Cab booking" },
  { href: "/faqs", label: "FAQs" },
];

export default function NotFound() {
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-xl text-center">
        <LogoMark className="mx-auto h-14 w-14" />
        <p className="mt-6 text-xs font-semibold tracking-[0.2em] text-gold-600 uppercase">Error 404</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">This path doesn&apos;t lead anywhere</h1>
        <p className="mt-3 text-muted">
          The page you were looking for may have moved or no longer exists. Let us guide you back on the right road.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" variant="gold" size="lg">Go to the home page</ButtonLink>
          <ButtonLink href="/contact" variant="outline" size="lg">Contact us</ButtonLink>
        </div>
        <nav aria-label="Popular pages" className="mt-10 border-t border-line pt-6">
          <ul className="flex flex-wrap justify-center gap-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-block rounded-full border border-line bg-white px-4 py-1.5 text-sm hover:border-forest-500">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </Container>
  );
}
