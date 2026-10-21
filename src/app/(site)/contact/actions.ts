"use server";

import { failure, invalid, type ActionState } from "@/lib/actions";
import { getSessionUser } from "@/lib/server/auth";
import { integrations } from "@/lib/server/env";
import { notifyStaff } from "@/lib/server/notify";
import { RateLimitError, enforceRateLimit } from "@/lib/server/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { contactSchema } from "@/lib/validation";
import { GENERIC_FAILURE_MESSAGE, NOT_CONFIGURED_MESSAGE, insertWithReference } from "../_lib/requests";

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
}

export async function submitSupportRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (str(formData, "website")) return failure("We could not send your message. Please try again.");

  const parsed = contactSchema.safeParse({
    name: str(formData, "name"),
    email: str(formData, "email"),
    phone: str(formData, "phone"),
    category: str(formData, "category") || undefined,
    booking_reference: str(formData, "booking_reference"),
    subject: str(formData, "subject"),
    message: str(formData, "message"),
    website: "",
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const input = parsed.data;

  if (!integrations.supabaseAdmin()) return failure(NOT_CONFIGURED_MESSAGE, formData);

  try {
    await enforceRateLimit("contact");
  } catch (error) {
    if (error instanceof RateLimitError) return failure(error.message, formData);
    throw error;
  }

  let created: { id: string; reference: string } | null = null;
  let linkedBooking = false;
  try {
    const supabase = createSupabaseAdminClient();
    const user = await getSessionUser();

    // Link a booking only when it belongs to the signed-in customer.
    let bookingId: string | null = null;
    if (user && input.booking_reference) {
      const { data } = await supabase
        .from("bookings")
        .select("id")
        .eq("reference", input.booking_reference)
        .eq("customer_id", user.id)
        .maybeSingle();
      bookingId = (data?.id as string | undefined) ?? null;
      linkedBooking = Boolean(bookingId);
    }

    created = await insertWithReference(supabase, "support_tickets", "SR", {
      customer_id: user?.id ?? null,
      booking_id: bookingId,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      category: input.category,
      subject: input.subject,
    });

    if (created) {
      const body =
        input.booking_reference && !linkedBooking
          ? `${input.message}\n\n[Booking reference given by customer (not verified): ${input.booking_reference}]`
          : input.message;
      const { error } = await supabase
        .from("ticket_messages")
        .insert({ ticket_id: created.id, author_id: user?.id ?? null, is_staff: false, body: body.slice(0, 5000) });
      if (error) {
        console.error("[contact] message insert failed", error.message);
        await supabase.from("support_tickets").delete().eq("id", created.id);
        created = null;
      }
    }
  } catch (error) {
    console.error("[contact] submit failed", (error as Error).message);
    created = null;
  }
  if (!created) return failure(GENERIC_FAILURE_MESSAGE, formData);

  await notifyStaff(`New support request (${input.category})`, [
    `Reference: ${created.reference}`,
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    ...(input.phone ? [`Phone: ${input.phone}`] : []),
    ...(input.booking_reference ? [`Booking: ${input.booking_reference}${linkedBooking ? " (linked)" : " (not verified)"}`] : []),
    `Subject: ${input.subject}`,
    `Message: ${input.message}`,
  ]);

  return {
    ok: true,
    message: `Thank you — your message has been received. Your support reference is ${created.reference}. We will reply by email${input.phone ? " or phone" : ""}.`,
  };
}
