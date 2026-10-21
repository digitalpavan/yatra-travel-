import "server-only";
import { unstable_rethrow } from "next/navigation";
import { AuthorizationError, getViewer, type Viewer } from "@/lib/server/auth";
import { failure, type ActionState } from "@/lib/actions";
import type { Permission } from "@/lib/permissions";
import { BookingError } from "@/lib/server/booking";
import { PaymentGatewayError, PaymentsNotConfiguredError } from "@/lib/server/razorpay";

export interface DbError {
  code?: string;
  message: string;
  hint?: string | null;
  details?: string | null;
}

const HINT_MESSAGES: Record<string, string> = {
  ALLOCATION_CONFLICT: "This vehicle or driver is already allocated during the trip period. Choose another.",
  VEHICLE_TOO_SMALL: "The selected vehicle does not have enough seats for this booking's passengers.",
  VEHICLE_INACTIVE: "The selected vehicle is not active.",
  DRIVER_INACTIVE: "The selected driver is not active.",
  INVALID_STATUS: "This action is not allowed for the booking's current status.",
  INVALID_TRANSITION: "That trip status change is not allowed from the current status.",
  NO_PAYMENT: "There is no captured payment on this booking to refund.",
  ACTIVE_BOOKINGS: "This customer has active bookings or pending refunds. Resolve them before anonymising.",
};

/** Messages raised by our own triggers/functions that are safe and useful to show verbatim. */
const PASSTHROUGH = [
  "Only an owner can grant owner or admin roles",
  "Only an owner can modify owner or admin staff",
  "Staff cannot change their own role",
  "At least one active owner is required",
  "Invalid refund amount",
];

/** Map a PostgREST / Postgres error to a friendly message. Logs the raw error. */
export function dbErrorMessage(error: DbError | null | undefined, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  console.error("[admin:db]", error.code, error.message, error.hint ?? "", error.details ?? "");
  if (error.hint && HINT_MESSAGES[error.hint]) return HINT_MESSAGES[error.hint];
  const pass = PASSTHROUGH.find((m) => error.message.includes(m));
  if (pass) return `${pass}.`;
  switch (error.code) {
    case "23505": {
      const m = /Key \(([^)]+)\)=\(([^)]*)\)/.exec(error.details ?? "");
      return m ? `“${m[2]}” is already in use for ${m[1].replace(/_/g, " ")}. Choose a different value.` : "That value is already in use. Choose a different one.";
    }
    case "23503":
      return "This record is in use by other records (e.g. bookings) and cannot be deleted. Archive, deactivate or unpublish it instead.";
    case "23514":
      return "One of the values is outside the allowed range. Please check the form.";
    case "23502":
      return "A required value is missing.";
    case "22P02":
    case "22023":
      return "One of the values is invalid.";
    case "42501":
      return "You do not have permission to do that.";
    case "PGRST116":
      return "The record was not found (it may have been deleted).";
    case "P0001":
    case "P0002":
      return error.message;
    default:
      return fallback;
  }
}

/** Like assertPermission, but passes when the viewer has ANY of the permissions. */
export async function assertAnyPermission(permissions: readonly Permission[]): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) throw new AuthorizationError("Please sign in again.");
  if (!permissions.some((p) => viewer.permissions.includes(p))) throw new AuthorizationError();
  return viewer;
}

/**
 * Wrap a server action body: checks the permission (any of, if an array), converts authorization
 * errors and unexpected exceptions into an ActionState. redirect()/notFound()
 * thrown inside `fn` are re-thrown so Next.js can handle them.
 */
export async function adminAction(
  permission: Permission | readonly Permission[],
  fn: (viewer: Viewer) => Promise<ActionState>,
): Promise<ActionState> {
  try {
    const viewer = await assertAnyPermission(typeof permission === "string" ? [permission] : permission);
    return await fn(viewer);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AuthorizationError) return failure(error.message);
    console.error("[admin:action]", error);
    // Domain errors from shared server modules carry user-safe messages.
    if (error instanceof BookingError || error instanceof PaymentsNotConfiguredError) return failure(error.message);
    if (error instanceof PaymentGatewayError) return failure(`Payment gateway error: ${error.message}`);
    return failure("Something went wrong. Please try again.");
  }
}

export function success(message: string): ActionState {
  return { ok: true, message };
}
