const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

/** Format integer paise as Indian rupees, e.g. 357000 → "₹3,570". */
export function formatINR(paise: number): string {
  return paise % 100 === 0 ? inrWhole.format(paise / 100) : inr.format(paise / 100);
}

/** Parse a rupee amount typed by staff (e.g. "3,570.50") into integer paise. */
export function rupeesToPaise(input: string | number): number {
  const n = typeof input === "number" ? input : Number(String(input).replace(/[,\s₹]/g, ""));
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid amount");
  return Math.round(n * 100);
}
