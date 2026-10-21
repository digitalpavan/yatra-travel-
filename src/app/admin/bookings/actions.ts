"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { integrations } from "@/lib/server/env";
import { notifyBookingUpdate } from "@/lib/server/notify";
import { adminAction, dbErrorMessage, success } from "@/lib/server/admin/errors";
import { optText, parseForm, reqText, rupeesToPaiseField, uuid } from "@/lib/server/admin/forms";
import { failure, type ActionState } from "@/lib/actions";
import { formatINR } from "@/lib/money";

const assignSchema = z.object({
  booking_id: uuid,
  vehicle_id: z.uuid({ error: "Choose a vehicle" }),
  driver_id: z.uuid({ error: "Choose a driver" }),
});

export async function assignVehicleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("bookings.manage", async () => {
    const parsed = parseForm(assignSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { booking_id, vehicle_id, driver_id } = parsed.data;
    const supabase = await createSupabaseServerClient();
    // The RPC re-checks bookings.manage, status, seats, active flags and overlaps.
    const { error } = await supabase.rpc("assign_vehicle", {
      p_booking_id: booking_id,
      p_vehicle_id: vehicle_id,
      p_driver_id: driver_id,
    });
    if (error) return failure(dbErrorMessage(error), formData);
    await notifyBookingUpdate(booking_id, "assigned");
    refresh();
    return success("Vehicle and driver assigned. The customer has been notified (see Notifications for delivery status).");
  });
}

const tripStatusSchema = z.object({
  booking_id: uuid,
  status: z.enum(["in_progress", "completed"], { error: "Invalid status" }),
});

/** Start / complete a trip. Drivers (trips.own, only their trips) and booking managers. */
export async function updateTripStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction(["bookings.manage", "trips.own"], async () => {
    const parsed = parseForm(tripStatusSchema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    // The RPC verifies the caller is the assigned driver or has bookings.manage, and the transition.
    const { error } = await supabase.rpc("update_trip_status", {
      p_booking_id: parsed.data.booking_id,
      p_status: parsed.data.status,
    });
    if (error) return failure(dbErrorMessage(error));
    refresh();
    return success(parsed.data.status === "in_progress" ? "Trip marked as started." : "Trip marked as completed.");
  });
}

const detailsSchema = z.object({
  booking_id: uuid,
  pickup_location: reqText(200, "Pickup location", 3),
  drop_location: optText(200, "Drop location"),
  special_requests: optText(1000, "Special requests"),
});

export async function updateBookingDetailsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("bookings.manage", async () => {
    const parsed = parseForm(detailsSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { booking_id, ...fields } = parsed.data;
    const supabase = await createSupabaseServerClient();
    // Column grants limit staff updates to these three operational fields.
    const { data, error } = await supabase.from("bookings").update(fields).eq("id", booking_id).select("id");
    if (error) return failure(dbErrorMessage(error), formData);
    if (!data?.length) return failure("Booking not found or not permitted.", formData);
    refresh();
    return success("Trip details updated.");
  });
}

const cancelSchema = z.object({
  booking_id: uuid,
  reason: reqText(500, "Reason", 3),
  refund: z.preprocess((v) => (v === undefined || v === null || v === "" ? "0" : v), rupeesToPaiseField("Refund amount")),
});

export async function cancelBookingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("bookings.manage", async (viewer) => {
    const parsed = parseForm(cancelSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { booking_id, reason, refund } = parsed.data;
    if (!integrations.supabaseAdmin()) {
      return failure("Cancellation is unavailable: the server's Supabase service key is not configured.", formData);
    }

    // Read the booking with the staff member's own client (RLS) for authoritative amounts.
    const supabase = await createSupabaseServerClient();
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, status, amount_paid_paise, amount_refunded_paise")
      .eq("id", booking_id)
      .maybeSingle<{ id: string; status: string; amount_paid_paise: number; amount_refunded_paise: number }>();
    if (error) return failure(dbErrorMessage(error), formData);
    if (!booking) return failure("Booking not found.", formData);
    if (!["pending", "confirmed", "assigned"].includes(booking.status)) {
      return failure("Only pending, confirmed or assigned bookings can be cancelled.", formData);
    }
    const remaining = Math.max(0, booking.amount_paid_paise - booking.amount_refunded_paise);
    const refundPaise = booking.amount_paid_paise > 0 ? refund : 0;
    if (refundPaise > remaining) {
      return failure(`Refund cannot exceed ${formatINR(remaining)} (paid minus already refunded).`, formData, {
        refund: `Maximum ${formatINR(remaining)}`,
      });
    }

    const { error: rpcError } = await createSupabaseAdminClient().rpc("cancel_booking", {
      p_booking_id: booking.id,
      p_actor: viewer.id,
      p_reason: reason,
      p_refund_paise: refundPaise,
    });
    if (rpcError) return failure(dbErrorMessage(rpcError), formData);
    await notifyBookingUpdate(booking.id, "cancelled");
    refresh();
    return success(
      refundPaise > 0
        ? `Booking cancelled. A refund of ${formatINR(refundPaise)} is queued — process it under Payments & refunds.`
        : "Booking cancelled.",
    );
  });
}
