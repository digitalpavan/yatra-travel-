"use server";

import { z } from "zod";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { failure, type ActionState } from "@/lib/actions";
import { TAGS } from "@/lib/data/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminAction, dbErrorMessage, success, type DbError } from "@/lib/server/admin/errors";
import {
  checkbox,
  commaList,
  optDate,
  optText,
  parseForm,
  formObject,
  reqInt,
  reqText,
  rupeesToPaiseField,
  uuid,
} from "@/lib/server/admin/forms";
import { emailSchema, phoneSchema, vehicleClassSchema } from "@/lib/validation";

const NOT_FOUND = "Not found or not permitted.";

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------
const vehicleSchema = z.object({
  registration_number: z
    .string({ error: "Registration number is required" })
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/\s+/g, " "))
    .pipe(
      z.string().regex(/^[A-Z0-9 -]{4,15}$/, {
        error: "Registration number must be 4–15 letters, digits, spaces or hyphens (e.g. AP 03 TA 1234)",
      }),
    ),
  vehicle_class: vehicleClassSchema,
  model: reqText(120, "Model"),
  seats: reqInt(1, 60, "Seats"),
  is_ac: checkbox,
  status: z.enum(["active", "maintenance", "retired"], { error: "Choose a status" }),
  permit_valid_until: optDate("Permit valid until"),
  insurance_valid_until: optDate("Insurance valid until"),
  notes: optText(1000, "Notes"),
});

function vehicleDbFailure(error: DbError, formData: FormData): ActionState {
  if (error.code === "23505" && (error.details ?? error.message).includes("registration_number")) {
    return failure("Please correct the highlighted fields.", formData, {
      registration_number: "A vehicle with this registration number already exists",
    });
  }
  return failure(dbErrorMessage(error), formData);
}

export async function createVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("fleet.manage", async () => {
    const parsed = parseForm(vehicleSchema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("vehicles").insert(parsed.data);
    if (error) return vehicleDbFailure(error, formData);
    refresh();
    redirect("/admin/fleet?created=vehicle#vehicles");
  });
}

export async function updateVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("fleet.manage", async () => {
    const parsed = parseForm(vehicleSchema.extend({ id: uuid }), formData);
    if (!parsed.ok) return parsed.state;
    const { id, ...values } = parsed.data;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("vehicles").update(values).eq("id", id).select("id");
    if (error) return vehicleDbFailure(error, formData);
    if (!data?.length) return failure(NOT_FOUND);
    refresh();
    return success("Vehicle saved.");
  });
}

export async function deleteVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("fleet.manage", async () => {
    const parsed = parseForm(z.object({ id: uuid }), formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("vehicles").delete().eq("id", parsed.data.id).select("id");
    if (error) {
      if (error.code === "23503") {
        return failure(
          "This vehicle has trip assignments and cannot be deleted. Set its status to “Retired” instead to keep the history.",
        );
      }
      return failure(dbErrorMessage(error));
    }
    if (!data?.length) return failure(NOT_FOUND);
    refresh();
    return success("Vehicle deleted.");
  });
}

// ---------------------------------------------------------------------------
// Drivers
// ---------------------------------------------------------------------------
const driverSchema = z.object({
  full_name: reqText(120, "Full name", 2),
  phone: phoneSchema,
  license_number: z
    .string({ error: "Licence number is required" })
    .trim()
    .toUpperCase()
    .min(4, { error: "Licence number is required" })
    .max(30, { error: "Licence number must be at most 30 characters" }),
  license_valid_until: optDate("Licence valid until"),
  languages: commaList(10, 40),
  status: z.enum(["active", "inactive"], { error: "Choose a status" }),
  user_email: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    emailSchema.optional(),
  ),
});

type DriverInput = z.output<typeof driverSchema>;

/** Resolve the optional account email to a profile id. */
async function resolveDriverUser(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: DriverInput,
  formData: FormData,
): Promise<{ ok: true; userId: string | null } | { ok: false; state: ActionState }> {
  if (!input.user_email) return { ok: true, userId: null };
  const { data, error } = await supabase.from("profiles").select("id").eq("email", input.user_email).limit(2);
  if (error) return { ok: false, state: failure(dbErrorMessage(error), formData) };
  const rows = (data ?? []) as { id: string }[];
  if (rows.length !== 1) {
    return {
      ok: false,
      state: failure("Please correct the highlighted fields.", formData, { user_email: "No account with that email" }),
    };
  }
  return { ok: true, userId: rows[0].id };
}

function driverDbFailure(error: DbError, formData: FormData): ActionState {
  if (error.code === "23505") {
    const text = error.details ?? error.message;
    if (text.includes("license_number")) {
      return failure("Please correct the highlighted fields.", formData, {
        license_number: "Another driver already has this licence number",
      });
    }
    if (text.includes("user_id")) {
      return failure("Please correct the highlighted fields.", formData, {
        user_email: "That account is already linked to another driver",
      });
    }
  }
  return failure(dbErrorMessage(error), formData);
}

function driverRow(input: DriverInput, userId: string | null) {
  return {
    full_name: input.full_name,
    phone: input.phone,
    license_number: input.license_number,
    license_valid_until: input.license_valid_until,
    languages: input.languages,
    status: input.status,
    user_id: userId,
  };
}

export async function createDriver(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("fleet.manage", async () => {
    const parsed = parseForm(driverSchema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const user = await resolveDriverUser(supabase, parsed.data, formData);
    if (!user.ok) return user.state;
    const { error } = await supabase.from("drivers").insert(driverRow(parsed.data, user.userId));
    if (error) return driverDbFailure(error, formData);
    refresh();
    redirect("/admin/fleet?created=driver#drivers");
  });
}

export async function updateDriver(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("fleet.manage", async () => {
    const parsed = parseForm(driverSchema.extend({ id: uuid }), formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const user = await resolveDriverUser(supabase, parsed.data, formData);
    if (!user.ok) return user.state;
    const { data, error } = await supabase
      .from("drivers")
      .update(driverRow(parsed.data, user.userId))
      .eq("id", parsed.data.id)
      .select("id");
    if (error) return driverDbFailure(error, formData);
    if (!data?.length) return failure(NOT_FOUND);
    refresh();
    return success("Driver saved.");
  });
}

export async function deleteDriver(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("fleet.manage", async () => {
    const parsed = parseForm(z.object({ id: uuid }), formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("drivers").delete().eq("id", parsed.data.id).select("id");
    if (error) {
      if (error.code === "23503") {
        return failure(
          "This driver has trip assignments and cannot be deleted. Set their status to “Inactive” instead to keep the history.",
        );
      }
      return failure(dbErrorMessage(error));
    }
    if (!data?.length) return failure(NOT_FOUND);
    refresh();
    return success("Driver deleted.");
  });
}

// ---------------------------------------------------------------------------
// Vehicle rate card (rows are seeded per class; update only)
// ---------------------------------------------------------------------------
const rateSchema = z.object({
  vehicle_class: vehicleClassSchema,
  label: reqText(60, "Label"),
  example_models: z.string().trim().max(200, { error: "Example models must be at most 200 characters" }).default(""),
  seats: reqInt(1, 60, "Seats"),
  luggage_bags: reqInt(0, 60, "Luggage bags"),
  base_fare: rupeesToPaiseField("Base fare"),
  per_km: rupeesToPaiseField("Per-km rate"),
  min_km_per_day: reqInt(0, 2000, "Minimum km per day"),
  driver_allowance_per_day: rupeesToPaiseField("Driver allowance per day"),
  is_active: checkbox,
  sort_order: reqInt(-1000, 100000, "Sort order"),
});

export async function updateVehicleRate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("fleet.manage", async () => {
    const parsed = parseForm(rateSchema, formData, { example_models: "", ...formObject(formData) });
    if (!parsed.ok) return parsed.state;
    const d = parsed.data;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("vehicle_rates")
      .update({
        label: d.label,
        example_models: d.example_models,
        seats: d.seats,
        luggage_bags: d.luggage_bags,
        base_fare_paise: d.base_fare,
        per_km_paise: d.per_km,
        min_km_per_day: d.min_km_per_day,
        driver_allowance_per_day_paise: d.driver_allowance_per_day,
        is_active: d.is_active,
        sort_order: d.sort_order,
      })
      .eq("vehicle_class", d.vehicle_class)
      .select("vehicle_class");
    if (error) return failure(dbErrorMessage(error), formData);
    if (!data?.length) return failure(NOT_FOUND);
    updateTag(TAGS.rates);
    refresh();
    return success(`${d.label} rates saved.`);
  });
}
