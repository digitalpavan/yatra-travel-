import Link from "next/link";
import { FaqList } from "@/components/content/FaqList";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs, Container, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { getFaqs } from "@/lib/data/catalog";
import { breadcrumbJsonLd, faqJsonLd, pageMetadata } from "@/lib/seo";
import type { Faq } from "@/lib/types";

export const metadata = pageMetadata({
  title: "FAQs — Tirumala Travel, Fares & Cancellations",
  description:
    "Answers to common questions about Tirumala transfers, darshan tickets, cab fares, payments, cancellations and custom trips with Yatra Travel in Tirupati.",
  path: "/faqs",
});

const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  tirumala: "Tirumala & darshan",
  pricing: "Fares & pricing",
  payments: "Payments",
  cancellation: "Cancellations & refunds",
  booking: "Bookings",
  privacy: "Privacy",
};

function labelFor(category: string) {
  return CATEGORY_LABELS[category] ?? category.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function slugFor(category: string) {
  return `faq-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export default async function FaqsPage() {
  const faqs = await getFaqs();
  const groups = new Map<string, Faq[]>();
  for (const f of faqs) groups.set(f.category, [...(groups.get(f.category) ?? []), f]);

  return (
    <>
      <PageHeader title="Frequently asked questions" intro="Quick answers about travelling to Tirumala, our fares, payments and cancellations.">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "FAQs" }]} />
      </PageHeader>

      <Container className="max-w-4xl py-10">
        {faqs.length === 0 ? (
          <EmptyState title="FAQs are being updated" action={<Link href="/contact" className={buttonClass("gold")}>Ask us a question</Link>}>
            We are preparing answers to common questions. Meanwhile, feel free to contact us.
          </EmptyState>
        ) : (
          <>
            {groups.size > 1 && (
              <nav aria-label="FAQ categories" className="mb-8">
                <ul className="flex flex-wrap gap-2">
                  {[...groups.keys()].map((c) => (
                    <li key={c}>
                      <a href={`#${slugFor(c)}`} className="inline-block rounded-full border border-line bg-white px-4 py-1.5 text-sm hover:border-forest-500">
                        {labelFor(c)}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <div className="space-y-10">
              {[...groups.entries()].map(([category, items]) => (
                <section key={category} aria-labelledby={slugFor(category)} className="scroll-mt-24">
                  <h2 id={slugFor(category)} className="mb-4 scroll-mt-24 text-2xl font-semibold">
                    {labelFor(category)}
                  </h2>
                  <FaqList faqs={items} />
                </section>
              ))}
            </div>
            <JsonLd data={faqJsonLd(faqs)} />
          </>
        )}
        <p className="mt-10 text-center text-sm text-muted">
          Didn&apos;t find your answer? <Link href="/contact" className="font-semibold text-forest-800 underline">Contact our team</Link>.
        </p>
      </Container>

      <JsonLd data={breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "FAQs", path: "/faqs" }])} />
    </>
  );
}
