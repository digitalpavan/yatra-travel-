import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/lib/types";
import type { Quote } from "@/lib/pricing";

/** Customer-facing reads. All go through the user-scoped client, so RLS enforces ownership. */

export interface MyBooking {
  id: string;
  reference: string;
  booking_type: "package" | "cab";
  trip_type: "package" | "one_way" | "round_trip";
  vehicle_class: string;
  pickup_location: string;
  drop_location: string | null;
  start_at: string;
  end_at: string;
  passengers: number;
  luggage_bags: number;
  special_requests: string | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  status: BookingStatus;
  price_breakdown: Quote & { summary?: string; vehicle_label?: string };
  total_paise: number;
  amount_paid_paise: number;
  amount_refunded_paise: number;
  payment_due_by: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
}

const BOOKING_COLUMNS =
  "id, reference, booking_type, trip_type, vehicle_class, pickup_location, drop_location, start_at, end_at, passengers, luggage_bags, special_requests, contact_name, contact_phone, contact_email, status, price_breakdown, total_paise, amount_paid_paise, amount_refunded_paise, payment_due_by, cancel_reason, cancelled_at, created_at";

export async function getMyBookings(userId: string): Promise<MyBooking[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("customer_id", userId)
    .order("start_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as MyBooking[];
}

export async function getMyBooking(userId: string, reference: string) {
  if (!/^YT[0-9]{6}-[A-Z2-9]{5}$/.test(reference)) return null;
  const supabase = await createSupabaseServerClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("reference", reference)
    .eq("customer_id", userId)
    .maybeSingle<MyBooking>();
  if (!booking) return null;

  const [events, payments, refunds, assignment, review] = await Promise.all([
    supabase.from("booking_events").select("id, status, note, created_at").eq("booking_id", booking.id).order("created_at"),
    supabase
      .from("payments")
      .select("id, provider_order_id, provider_payment_id, amount_paise, status, method, failure_reason, captured_at, created_at")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false }),
    supabase.from("refunds").select("id, amount_paise, status, reason, processed_at, created_at").eq("booking_id", booking.id).order("created_at"),
    supabase.from("my_trip_assignments").select("vehicle_model, registration_number, driver_name, driver_phone").eq("booking_id", booking.id).maybeSingle(),
    supabase.from("reviews").select("id, status, rating").eq("booking_id", booking.id).maybeSingle(),
  ]);

  return {
    booking,
    events: (events.data ?? []) as { id: number; status: BookingStatus | null; note: string; created_at: string }[],
    payments: (payments.data ?? []) as {
      id: string;
      provider_order_id: string;
      provider_payment_id: string | null;
      amount_paise: number;
      status: string;
      method: string | null;
      failure_reason: string | null;
      captured_at: string | null;
      created_at: string;
    }[],
    refunds: (refunds.data ?? []) as { id: string; amount_paise: number; status: string; reason: string; processed_at: string | null; created_at: string }[],
    assignment: assignment.data as { vehicle_model: string; registration_number: string; driver_name: string; driver_phone: string } | null,
    review: review.data as { id: string; status: string; rating: number } | null,
  };
}
