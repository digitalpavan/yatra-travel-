import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { BOOKING_STATUS_LABELS, type BookingStatus } from "@/lib/types";

type Variant = "primary" | "gold" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-forest-800 text-white hover:bg-forest-700 shadow-sm",
  gold: "bg-gold-400 text-forest-900 hover:bg-gold-300 shadow-sm",
  outline: "border border-forest-800/30 text-forest-800 hover:bg-forest-50",
  ghost: "text-forest-800 hover:bg-forest-50",
  danger: "bg-red-700 text-white hover:bg-red-800",
};
const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Container({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  as: Tag = "h2",
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  as?: "h1" | "h2";
  align?: "left" | "center";
}) {
  return (
    <div className={`mb-8 ${align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-3xl"}`}>
      {eyebrow && <p className="mb-2 text-xs font-semibold tracking-[0.2em] text-gold-600 uppercase">{eyebrow}</p>}
      <Tag className={Tag === "h1" ? "text-3xl font-semibold sm:text-4xl" : "text-2xl font-semibold sm:text-3xl"}>{title}</Tag>
      {intro && <div className="mt-3 text-muted">{intro}</div>}
    </div>
  );
}

export function PageHeader({ title, intro, children }: { title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <div className="border-b border-line bg-gradient-to-b from-ivory-dark to-ivory">
      <Container className="py-10 sm:py-14">
        {children}
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {intro && <div className="mt-3 max-w-3xl text-lg text-muted">{intro}</div>}
      </Container>
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl border border-line bg-white shadow-[var(--shadow-card)] ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "green" | "gray" | "red" | "blue" }) {
  const tones = {
    gold: "bg-gold-100 text-gold-700",
    green: "bg-forest-100 text-forest-800",
    gray: "bg-stone-100 text-stone-700",
    red: "bg-red-100 text-red-800",
    blue: "bg-sky-100 text-sky-800",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

const STATUS_TONES: Record<BookingStatus, "gold" | "green" | "gray" | "red" | "blue"> = {
  pending: "gold",
  confirmed: "green",
  assigned: "blue",
  in_progress: "blue",
  completed: "gray",
  cancelled: "red",
  refund_pending: "gold",
  refunded: "gray",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>;
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title?: string;
  children?: ReactNode;
}) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    success: "border-forest-100 bg-forest-50 text-forest-900",
    warning: "border-gold-200 bg-gold-50 text-gold-700",
    error: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      <p className="font-display text-lg text-forest-900">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-ivory-dark ${className}`} aria-hidden />;
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden>›</span>}
            {item.href ? (
              <Link href={item.href} className="hover:text-forest-800 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-charcoal">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------
const inputBase =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-charcoal placeholder:text-stone-400 focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-100 aria-[invalid=true]:border-red-500";

export function Field({
  label,
  name,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-forest-900">
        {label}
        {required && <span className="text-red-700" aria-hidden> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${name}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-error`} className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(name: string, error?: string, hint?: string) {
  return error ? `${name}-error` : hint ? `${name}-hint` : undefined;
}

export function Input({
  name,
  error,
  hint,
  className = "",
  ...props
}: ComponentProps<"input"> & { name: string; error?: string; hint?: string }) {
  return (
    <input
      id={props.id ?? name}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(name, error, hint)}
      className={`${inputBase} ${className}`}
      {...props}
    />
  );
}

export function Textarea({
  name,
  error,
  hint,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { name: string; error?: string; hint?: string }) {
  return (
    <textarea
      id={props.id ?? name}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(name, error, hint)}
      className={`${inputBase} min-h-28 ${className}`}
      {...props}
    />
  );
}

export function Select({
  name,
  error,
  hint,
  className = "",
  children,
  ...props
}: ComponentProps<"select"> & { name: string; error?: string; hint?: string }) {
  return (
    <select
      id={props.id ?? name}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy(name, error, hint)}
      className={`${inputBase} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({ name, label, error, ...props }: ComponentProps<"input"> & { name: string; label: ReactNode; error?: string }) {
  return (
    <div>
      <label className="flex items-start gap-2.5 text-sm text-charcoal">
        <input
          type="checkbox"
          name={name}
          id={props.id ?? name}
          aria-invalid={error ? true : undefined}
          className="mt-0.5 h-4 w-4 rounded border-line accent-forest-800"
          {...props}
        />
        <span>{label}</span>
      </label>
      {error && <p className="mt-1 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}
