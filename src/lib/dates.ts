/** All customer-facing dates are in India Standard Time (UTC+05:30, no DST). */
export const IST_OFFSET = "+05:30";
export const TIME_ZONE = "Asia/Kolkata";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Current time for request-time rendering. Call only after the component has
 * opted into dynamic rendering (e.g. after `await connection()` or cookies()).
 */
export function requestTime(): number {
  return Date.now();
}

/** Combine a local IST date ("2030-01-10") and time ("05:30") into a Date. */
export function istDateTime(date: string, time = "00:00"): Date {
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) throw new Error("Invalid date or time");
  const d = new Date(`${date}T${time}:00${IST_OFFSET}`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  // Reject impossible dates like 2030-02-31 that JS would roll over.
  if (istDateString(d) !== date) throw new Error("Invalid date");
  return d;
}

/** The IST calendar date (YYYY-MM-DD) of an instant. */
export function istDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Whole IST calendar days spanned by [start, end], inclusive (min 1). */
export function istCalendarDays(start: Date, end: Date): number {
  const a = Date.parse(`${istDateString(start)}T00:00:00Z`);
  const b = Date.parse(`${istDateString(end)}T00:00:00Z`);
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

export function formatDateTime(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatDate(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, dateStyle: "medium" }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  );
}
