import "server-only";
import { z } from "zod";
import { invalid, type ActionState } from "@/lib/actions";
import { istDateTime } from "@/lib/dates";

/**
 * Zod building blocks for admin forms (FormData strings → typed values).
 * Blank optional inputs become null so they can be written straight to the DB.
 */

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** Required trimmed text. */
export const reqText = (max: number, label = "This field", min = 1) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, { error: min <= 1 ? `${label} is required` : `${label} must be at least ${min} characters` })
    .max(max, { error: `${label} must be at most ${max} characters` });

/** Optional trimmed text; blank → null. */
export const optText = (max: number, label = "This field") =>
  z.preprocess(
    blankToUndefined,
    z.string().trim().max(max, { error: `${label} must be at most ${max} characters` }).optional(),
  ).transform((v) => v ?? null);

/** HTML checkbox → boolean. */
export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** Required integer within range. */
export const reqInt = (min: number, max: number, label = "Value") =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: `${label} is required` })
      .int({ error: `${label} must be a whole number` })
      .min(min, { error: `${label} must be at least ${min}` })
      .max(max, { error: `${label} must be at most ${max}` }),
  );

/** Optional integer; blank → null. */
export const optInt = (min: number, max: number, label = "Value") =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int({ error: `${label} must be a whole number` })
      .min(min, { error: `${label} must be at least ${min}` })
      .max(max, { error: `${label} must be at most ${max}` })
      .optional(),
  ).transform((v) => v ?? null);

/** Optional decimal number; blank → null. */
export const optNumber = (min: number, max: number, label = "Value") =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: `${label} must be a number` })
      .min(min, { error: `${label} must be at least ${min}` })
      .max(max, { error: `${label} must be at most ${max}` })
      .optional(),
  ).transform((v) => v ?? null);

const RUPEES_RE = /^\d{1,9}(\.\d{1,2})?$/;
const cleanRupees = (v: unknown) => (typeof v === "string" ? v.replace(/[,\s₹]/g, "") : v);

/** Required rupee amount (e.g. "3,570.50") → integer paise. */
export const rupeesToPaiseField = (label = "Amount") =>
  z.preprocess(
    cleanRupees,
    z
      .string({ error: `${label} is required` })
      .min(1, { error: `${label} is required` })
      .regex(RUPEES_RE, { error: `${label} must be an amount in rupees, e.g. 1500 or 1500.50` }),
  ).transform((v) => Math.round(Number(v) * 100));

/** Optional rupee amount → paise; blank → null. */
export const optRupeesToPaise = (label = "Amount") =>
  z.preprocess(
    (v) => blankToUndefined(cleanRupees(v)),
    z.string().regex(RUPEES_RE, { error: `${label} must be an amount in rupees, e.g. 1500 or 1500.50` }).optional(),
  ).transform((v) => (v === undefined ? null : Math.round(Number(v) * 100)));

/** Percent typed by staff (e.g. "12.5") → basis points (1250). */
export const percentToBps = (min: number, max: number, label = "Percentage") =>
  z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: `${label} is required` })
      .min(min, { error: `${label} must be at least ${min}%` })
      .max(max, { error: `${label} must be at most ${max}%` }),
  ).transform((v) => Math.round(v * 100));

/** Optional YYYY-MM-DD date; blank → null. */
export const optDate = (label = "Date") =>
  z.preprocess(
    blankToUndefined,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: `${label} must be a date` }).optional(),
  ).transform((v) => v ?? null);

export const reqDate = (label = "Date") =>
  z.string({ error: `${label} is required` }).regex(/^\d{4}-\d{2}-\d{2}$/, { error: `${label} is required` });

/** <input type="datetime-local"> value interpreted as IST → ISO string; blank → null. */
export const optIstDateTime = (label = "Date and time") =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: `${label} is invalid` })
      .optional(),
  ).transform((v, ctx) => {
    if (v === undefined) return null;
    try {
      const [date, time] = v.split("T");
      return istDateTime(date, time).toISOString();
    } catch {
      ctx.addIssue({ code: "custom", message: `${label} is invalid` });
      return z.NEVER;
    }
  });

/** Textarea with one item per line → string[] (blank lines dropped). */
export const lines = (maxItems = 50, maxLen = 300, label = "Item") =>
  z
    .preprocess(
      (v) =>
        typeof v === "string"
          ? v
              .split(/\r?\n/)
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      z.array(z.string().max(maxLen, { error: `${label} lines must be at most ${maxLen} characters` })).max(maxItems, {
        error: `At most ${maxItems} lines`,
      }),
    );

/** Comma-separated list → string[]. */
export const commaList = (maxItems = 20, maxLen = 60) =>
  z.preprocess(
    (v) =>
      typeof v === "string"
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    z.array(z.string().max(maxLen)).max(maxItems),
  );

export const uuid = z.uuid({ error: "Invalid id" });

/** Object of string entries from FormData (last value wins). Use formData.getAll for multi-value fields. */
export function formObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/** safeParse a schema against FormData (or a prepared object). */
export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
  input: Record<string, unknown> = formObject(formData),
): { ok: true; data: z.output<T> } | { ok: false; state: ActionState } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, state: invalid(parsed.error, formData) };
  return { ok: true, data: parsed.data };
}
