import { z } from "zod";

/** Normalise Indian mobile numbers: "98765 43210" → "+919876543210". */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^0[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(cleaned)) return `+${cleaned}`;
  return cleaned;
}

export const phoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+?[0-9]{10,15}$/, { error: "Enter a valid phone number, e.g. 98765 43210" }));

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email address" }).max(254));

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, { error: `${label} must be at least ${min} characters` })
    .max(max, { error: `${label} must be at most ${max} characters` });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Choose a date" });
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Choose a time" });
export const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120);
export const vehicleClassSchema = z.enum(["sedan", "suv", "muv", "tempo_traveller", "mini_bus"], {
  error: "Choose a vehicle",
});
export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,30}$/, { error: "Invalid coupon code" });

const bookingCommon = {
  vehicle_class: vehicleClassSchema,
  trip_date: dateSchema,
  pickup_time: timeSchema,
  pickup_location: text(3, 200, "Pickup location"),
  drop_location: optionalText(200),
  passengers: z.coerce.number().int().min(1, { error: "At least 1 passenger" }).max(60),
  luggage_bags: z.coerce.number().int().min(0).max(60).default(0),
  special_requests: optionalText(1000),
  coupon_code: z.preprocess((v) => (v === "" || v == null ? undefined : v), couponCodeSchema.optional()),
};

export const quoteRequestSchema = z.discriminatedUnion("booking_type", [
  z.object({
    booking_type: z.literal("package"),
    package_slug: slugSchema,
    ...bookingCommon,
  }),
  z.object({
    booking_type: z.literal("cab"),
    trip_type: z.enum(["one_way", "round_trip"]),
    route_slug: slugSchema,
    return_date: z.preprocess((v) => (v === "" ? undefined : v), dateSchema.optional()),
    ...bookingCommon,
  }),
]);
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

const bookingContact = z.object({
  contact_name: text(2, 120, "Name"),
  contact_phone: phoneSchema,
  contact_email: emailSchema,
  idempotency_key: z.string().regex(/^[A-Za-z0-9-]{8,80}$/, { error: "Invalid request key" }),
  accept_terms: checkbox.refine((v) => v, { error: "Please accept the terms and cancellation policy" }),
  whatsapp_opt_in: checkbox.default(false),
});

export const bookingRequestSchema = z.intersection(quoteRequestSchema, bookingContact);
export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export const contactSchema = z.object({
  name: text(2, 120, "Name"),
  email: emailSchema,
  phone: z.preprocess((v) => (v === "" ? undefined : v), phoneSchema.optional()),
  category: z.enum(["general", "booking", "payment", "cancellation", "feedback", "privacy"]).default("general"),
  booking_reference: z.preprocess(
    (v) => (v === "" ? undefined : typeof v === "string" ? v.trim().toUpperCase() : v),
    z.string().regex(/^YT[0-9]{6}-[A-Z2-9]{5}$/, { error: "Booking reference looks like YT261021-ABCDE" }).optional(),
  ),
  subject: text(3, 160, "Subject"),
  message: text(10, 5000, "Message"),
  website: z.string().max(0).optional(), // honeypot — must stay empty
});

export const itinerarySchema = z
  .object({
    name: text(2, 120, "Name"),
    email: emailSchema,
    phone: phoneSchema,
    travel_start: dateSchema,
    travel_end: dateSchema,
    passengers: z.coerce.number().int().min(1).max(60),
    pickup_city: text(2, 120, "Pickup city"),
    places: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    preferred_vehicle: z.preprocess((v) => (v === "" ? undefined : v), vehicleClassSchema.optional()),
    budget_note: optionalText(300),
    details: optionalText(3000),
    website: z.string().max(0).optional(),
  })
  .refine((v) => v.travel_end >= v.travel_start, { error: "End date must be on or after the start date", path: ["travel_end"] });

export const passwordSchema = z
  .string()
  .min(10, { error: "Use at least 10 characters" })
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), { error: "Include at least one letter and one number" });

export const signUpSchema = z.object({
  full_name: text(2, 120, "Name"),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  accept_terms: checkbox.refine((v) => v, { error: "Please accept the terms and privacy policy" }),
  marketing_opt_in: checkbox.default(false),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Enter your password" }).max(128),
  next: z.string().optional(),
});

export const profileSchema = z.object({
  full_name: text(2, 120, "Name"),
  phone: phoneSchema,
  whatsapp_opt_in: checkbox.default(false),
  marketing_opt_in: checkbox.default(false),
});

export const reviewSchema = z.object({
  booking_id: z.uuid(),
  display_name: text(2, 60, "Display name"),
  rating: z.coerce.number().int().min(1).max(5),
  title: optionalText(120),
  body: text(10, 2000, "Review"),
});

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** Flatten Zod errors into { field: message } for forms. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
