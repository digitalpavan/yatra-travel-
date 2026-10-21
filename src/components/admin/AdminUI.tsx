import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, Card } from "@/components/ui";

/** Page title row for admin screens. */
export function AdminHeader({
  title,
  intro,
  actions,
  back,
}: {
  title: string;
  intro?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-sm text-muted hover:text-forest-800 hover:underline">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {intro && <div className="mt-1 text-sm text-muted">{intro}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Section card with a heading. */
export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  id,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <Card className={`p-4 sm:p-6 ${className}`}>
      <section aria-labelledby={title && id ? `${id}-title` : undefined} id={id}>
        {(title || actions) && (
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              {title && (
                <h2 id={id ? `${id}-title` : undefined} className="text-lg font-semibold">
                  {title}
                </h2>
              )}
              {description && <div className="mt-0.5 text-sm text-muted">{description}</div>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </section>
    </Card>
  );
}

/** Horizontally scrollable table wrapper (mobile friendly). */
export function TableWrap({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0" role={label ? "region" : undefined} aria-label={label} tabIndex={label ? 0 : undefined}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={`border-b border-line bg-ivory-dark/60 px-3 py-2 text-xs font-semibold tracking-wide text-forest-900 uppercase ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`border-b border-line/70 px-3 py-2.5 align-top ${className}`}>{children}</td>;
}

/** Definition list of label/value rows. */
export function KeyValues({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="font-medium break-words text-charcoal">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Previous/next pagination using query strings. */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number | null;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const totalPages = total == null ? null : Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const hasNext = totalPages == null ? false : page < totalPages;
  const linkClass = "rounded-full border border-line px-3 py-1.5 text-sm font-medium text-forest-800 hover:bg-forest-50";
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-2 text-sm">
      <p className="text-muted">
        {total != null ? `${total} result${total === 1 ? "" : "s"} · page ${page} of ${totalPages}` : `Page ${page}`}
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link className={linkClass} href={href(page - 1)} rel="prev">
            ← Previous
          </Link>
        )}
        {hasNext && (
          <Link className={linkClass} href={href(page + 1)} rel="next">
            Next →
          </Link>
        )}
      </div>
    </nav>
  );
}

/** Shown when a query fails (never fabricate data). */
export function LoadError({ what = "data" }: { what?: string }) {
  return (
    <Alert tone="error" title={`Could not load ${what}`}>
      Please refresh the page. If the problem continues, check the database connection and your permissions.
    </Alert>
  );
}

/** Small stat tile for the overview. */
export function StatTile({
  label,
  value,
  href,
  tone = "default",
  hint,
}: {
  label: string;
  value: ReactNode;
  href?: string;
  tone?: "default" | "attention";
  hint?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold sm:text-3xl ${tone === "attention" ? "text-gold-600" : "text-forest-900"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  );
  const cls = `block rounded-2xl border bg-white p-4 shadow-[var(--shadow-card)] ${tone === "attention" ? "border-gold-300" : "border-line"}`;
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-forest-300`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Parse a positive page number from searchParams. */
export function pageParam(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 && n < 100_000 ? n : 1;
}

/** First value of a search param as a trimmed string (or undefined). */
export function sp(v: string | string[] | undefined, max = 100): string | undefined {
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s.slice(0, max) : undefined;
}
