import type { Faq } from "@/lib/types";

/** Accessible accordion of FAQs using native <details>/<summary>. */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {faqs.map((f) => (
        <details key={f.id} className="group p-5">
          <summary className="cursor-pointer list-none font-semibold text-forest-900 marker:hidden">
            <span className="flex items-center justify-between gap-4">
              {f.question}
              <span aria-hidden className="text-gold-500 transition group-open:rotate-45">+</span>
            </span>
          </summary>
          <p className="mt-3 text-sm whitespace-pre-line text-muted">{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
