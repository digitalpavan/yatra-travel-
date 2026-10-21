import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DestinationOption, RateOption } from "./PackageForm";

/** Vehicle classes and destinations shown in the package form. */
export async function loadPackageFormOptions(): Promise<{ rates: RateOption[]; destinations: DestinationOption[]; error: boolean }> {
  const supabase = await createSupabaseServerClient();
  const [rates, destinations] = await Promise.all([
    supabase.from("vehicle_rates").select("vehicle_class, label, seats, is_active").order("sort_order").order("seats"),
    supabase.from("destinations").select("id, name, category, is_published").order("sort_order").order("name"),
  ]);
  return {
    rates: (rates.data ?? []) as unknown as RateOption[],
    destinations: (destinations.data ?? []) as unknown as DestinationOption[],
    error: Boolean(rates.error || destinations.error),
  };
}
