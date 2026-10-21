import Link from "next/link";
import { LogoMark } from "@/components/brand/Logo";
import { getSiteSettings } from "@/lib/data/catalog";
import { FOOTER_NAV, TTD_DISCLAIMER } from "@/lib/site";

const SOCIAL_LABELS: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", x: "X (Twitter)" };

export async function SiteFooter() {
  const settings = await getSiteSettings();
  const socials = Object.entries(settings.social).filter(([, url]) => Boolean(url));

  return (
    <footer className="mt-16 bg-forest-900 text-forest-100">
      <div className="temple-divider" aria-hidden />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.3fr_2fr]">
        <div>
          <div className="flex items-center gap-3">
            <LogoMark className="h-12 w-12" />
            <div>
              <p className="font-display text-xl text-white">{settings.brand.name}</p>
              <p className="text-sm text-gold-200">{settings.brand.tagline}</p>
            </div>
          </div>
          <address className="mt-5 space-y-1 text-sm not-italic">
            {settings.contact.address && <p>{settings.contact.address}</p>}
            {settings.contact.phone && (
              <p>
                Phone: <a className="hover:underline" href={`tel:${settings.contact.phone.replace(/\s/g, "")}`}>{settings.contact.phone}</a>
              </p>
            )}
            {settings.contact.email && (
              <p>
                Email: <a className="hover:underline" href={`mailto:${settings.contact.email}`}>{settings.contact.email}</a>
              </p>
            )}
            {settings.contact.hours && <p>{settings.contact.hours}</p>}
          </address>
          {socials.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-3 text-sm" aria-label="Social media">
              {socials.map(([key, url]) => (
                <li key={key}>
                  <a href={url} rel="noopener noreferrer me" target="_blank" className="rounded-full border border-forest-700 px-3 py-1 hover:bg-forest-800">
                    {SOCIAL_LABELS[key] ?? key}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {Object.entries(FOOTER_NAV).map(([heading, links]) => (
            <nav key={heading} aria-label={heading}>
              <p className="mb-3 text-sm font-semibold text-gold-200">{heading}</p>
              <ul className="space-y-2 text-sm">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-white hover:underline">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-forest-800">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs text-forest-300 sm:px-6">
          <p>{TTD_DISCLAIMER}</p>
          <p>
            © {settings.brand.legal_name || settings.brand.name}
            {settings.brand.gstin && ` · GSTIN ${settings.brand.gstin}`}
          </p>
        </div>
      </div>
    </footer>
  );
}
