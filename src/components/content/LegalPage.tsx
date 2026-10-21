import Link from "next/link";
import type { ReactNode } from "react";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Container, PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { breadcrumbJsonLd } from "@/lib/seo";
import type { SiteSettings } from "@/lib/types";

export function formatPolicyDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(`${value}T00:00:00+05:30`) : value || "Not yet published";
}

/** Shared frame for policy pages: header, breadcrumbs, template notice and "last updated". */
export function LegalPage({
  title,
  intro,
  path,
  settings,
  contents,
  children,
}: {
  title: string;
  intro: string;
  path: string;
  settings: SiteSettings;
  contents?: { id: string; label: string }[];
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} intro={intro}>
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: title }]} />
      </PageHeader>
      <Container className="grid gap-10 py-10 lg:grid-cols-[1fr_16rem]">
        <article className="min-w-0">
          <div role="note" className="mb-6 rounded-xl border-2 border-dashed border-gold-400 bg-gold-50 px-4 py-3 text-sm text-gold-700">
            <p className="font-semibold">Template — to be reviewed by a qualified legal professional before launch.</p>
            <p className="mt-1">
              This page is a starting draft for a travel business in India. It is not legal advice and must be checked against the
              business&apos;s actual practices before it is relied upon.
            </p>
          </div>
          <p className="mb-8 text-sm text-muted">
            Last updated: <strong className="text-charcoal">{formatPolicyDate(settings.legal.last_updated)}</strong>
            {settings.legal.policy_version && <> · Version {settings.legal.policy_version}</>}
          </p>
          <div className="prose-yatra [&_h2]:scroll-mt-24">{children}</div>
        </article>
        {contents && contents.length > 0 && (
          <aside className="order-first lg:order-last">
            <nav aria-label="On this page" className="rounded-2xl border border-line bg-white p-5 text-sm lg:sticky lg:top-24">
              <p className="mb-2 font-semibold text-forest-900">On this page</p>
              <ol className="space-y-1.5">
                {contents.map((c) => (
                  <li key={c.id}>
                    <a href={`#${c.id}`} className="text-muted hover:text-forest-800 hover:underline">
                      {c.label}
                    </a>
                  </li>
                ))}
              </ol>
              <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                Questions? <Link href="/contact" className="underline">Contact us</Link>
              </p>
            </nav>
          </aside>
        )}
      </Container>
      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: title, path }])} />
    </>
  );
}

/** Grievance Officer block (DPDP Act 2023 / IT Rules 2011). Shows placeholders when not yet appointed. */
export function GrievanceOfficer({ settings }: { settings: SiteSettings }) {
  const { grievance_officer_name: name, grievance_officer_email: email } = settings.legal;
  return (
    <div className="not-prose rounded-xl border border-line bg-white p-4 text-sm">
      <p className="font-semibold text-forest-900">Grievance Officer</p>
      <dl className="mt-2 grid gap-1 sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted">Name</dt>
        <dd>{name || <em className="text-muted">To be appointed</em>}</dd>
        <dt className="text-muted">Email</dt>
        <dd>
          {email ? (
            <a href={`mailto:${email}`} className="underline">
              {email}
            </a>
          ) : (
            <em className="text-muted">To be appointed</em>
          )}
        </dd>
        {settings.brand.legal_name && (
          <>
            <dt className="text-muted">Business</dt>
            <dd>{settings.brand.legal_name}</dd>
          </>
        )}
        {settings.contact.address && (
          <>
            <dt className="text-muted">Address</dt>
            <dd>{settings.contact.address}</dd>
          </>
        )}
      </dl>
      <p className="mt-3 text-xs text-muted">
        You can also raise a grievance through our <Link href="/contact" className="underline">support form</Link> by choosing the
        &ldquo;Privacy&rdquo; category.
      </p>
    </div>
  );
}
