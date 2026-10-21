"use server";

import { failure, invalid, type ActionState } from "@/lib/actions";
import { istDateString } from "@/lib/dates";
import { getSessionUser } from "@/lib/server/auth";
import { integrations } from "@/lib/server/env";
import { notifyStaff } from "@/lib/server/notify";
import { RateLimitError, enforceRateLimit } from "@/lib/server/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { VEHICLE_CLASS_LABELS } from "@/lib/types";
import { itinerarySchema } from "@/lib/validation";
import { GENERIC_FAILURE_MESSAGE, NOT_CONFIGURED_MESSAGE, insertWithReference } from "../_lib/requests";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function submitItineraryRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  // Honeypot: real visitors never see or fill this field.
  if (str(formData, "website")) return failure("We could not submit your request. Please try again.");

  const places = str(formData, "places")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const parsed = itinerarySchema.safeParse({
    name: str(formData, "name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    travel_start: str(formData, "travel_start"),
    travel_end: str(formData, "travel_end"),
    passengers: str(formData, "passengers"),
    pickup_city: str(formData, "pickup_city"),
    places,
    preferred_vehicle: str(formData, "preferred_vehicle"),
    budget_note: str(formData, "budget_note"),
    details: str(formData, "details"),
    website: "",
  });
  if (!parsed.success) {
    const state = invalid(parsed.error, formData);
    // Errors on individual places (e.g. places.3) are shown on the single text input.
    if (state.errors) {
      for (const key of Object.keys(state.errors)) {
        if (key.startsWith("places.")) state.errors.places ??= "Each place must be under 120 characters (max 20 places).";
      }
    }
    return state;
  }
  const input = parsed.data;

  if (input.travel_start < istDateString(new Date())) {
    return failure("Please correct the highlighted fields.", formData, { travel_start: "Start date cannot be in the past" });
  }

  if (!integrations.supabaseAdmin()) return failure(NOT_CONFIGURED_MESSAGE, formData);

  try {
    await enforceRateLimit("itinerary");
  } catch (error) {
    if (error instanceof RateLimitError) return failure(error.message, formData);
    throw error;
  }

  let created: { id: string; reference: string } | null = null;
  try {
    const user = await getSessionUser();
    created = await insertWithReference(createSupabaseAdminClient(), "itinerary_requests", "IT", {
      customer_id: user?.id ?? null,
      name: input.name,
      email: input.email,
      phone: input.phone,
      travel_start: input.travel_start,
      travel_end: input.travel_end,
      passengers: input.passengers,
      pickup_city: input.pickup_city,
      places: input.places,
      preferred_vehicle: input.preferred_vehicle ?? null,
      budget_note: input.budget_note ?? null,
      details: input.details ?? null,
    });
  } catch (error) {
    console.error("[itinerary] submit failed", (error as Error).message);
  }
  if (!created) return failure(GENERIC_FAILURE_MESSAGE, formData);

  await notifyStaff("New custom itinerary request", [
    `Reference: ${created.reference}`,
    `Name: ${input.name}`,
    `Phone: ${input.phone}`,
    `Email: ${input.email}`,
    `Dates: ${input.travel_start} to ${input.travel_end}`,
    `Passengers: ${input.passengers}`,
    `Pickup city: ${input.pickup_city}`,
    `Places: ${input.places.length ? input.places.join(", ") : "—"}`,
    `Preferred vehicle: ${input.preferred_vehicle ? VEHICLE_CLASS_LABELS[input.preferred_vehicle] : "No preference"}`,
    ...(input.budget_note ? [`Budget: ${input.budget_note}`] : []),
    ...(input.details ? [`Details: ${input.details}`] : []),
  ]);

  return {
    ok: true,
    message: `Thank you! Your request has been received. Your reference is ${created.reference}. Our team will contact you to discuss the plan and share a quote.`,
  };
}
