"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { failure, type ActionState } from "@/lib/actions";
import { adminAction, dbErrorMessage, success } from "@/lib/server/admin/errors";
import { optText, parseForm, reqText, uuid } from "@/lib/server/admin/forms";
import { integrations } from "@/lib/server/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const ITINERARY_STATUSES = ["new", "contacted", "quoted", "converted", "closed"] as const;
const DATA_REQUEST_STATUSES = ["in_progress", "completed", "rejected"] as const;

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------
const replySchema = z.object({
  ticket_id: uuid,
  body: reqText(5000, "Reply"),
});

export async function replyToTicket(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("support.manage", async (viewer) => {
    const parsed = parseForm(replySchema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();

    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("id, status")
      .eq("id", parsed.data.ticket_id)
      .maybeSingle();
    if (ticketError) return failure(dbErrorMessage(ticketError), formData);
    if (!ticket) return failure("Ticket not found or not permitted.", formData);

    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      author_id: viewer.id,
      is_staff: true,
      body: parsed.data.body,
    });
    if (error) return failure(dbErrorMessage(error), formData);

    let note = "";
    if (ticket.status === "open") {
      const { error: statusError } = await supabase
        .from("support_tickets")
        .update({ status: "in_progress" })
        .eq("id", ticket.id)
        .eq("status", "open");
      if (statusError) note = " (the status could not be changed to in progress)";
      else note = " Ticket marked as in progress.";
    }
    refresh();
    return success(`Reply posted.${note}`);
  });
}

const ticketStatusSchema = z.object({
  id: uuid,
  status: z.enum(TICKET_STATUSES, { error: "Choose a valid status" }),
});

export async function setTicketStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("support.manage", async () => {
    const parsed = parseForm(ticketStatusSchema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("support_tickets")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.id)
      .select("id");
    if (error) return failure(dbErrorMessage(error));
    if (!data?.length) return failure("Ticket not found or not permitted.");
    refresh();
    return success("Status updated.");
  });
}

// ---------------------------------------------------------------------------
// Custom itinerary requests (RLS: update needs bookings.manage)
// ---------------------------------------------------------------------------
const itinerarySchema = z.object({
  id: uuid,
  status: z.enum(ITINERARY_STATUSES, { error: "Choose a valid status" }),
  staff_notes: optText(3000, "Staff notes"),
});

export async function updateItineraryRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("bookings.manage", async () => {
    const parsed = parseForm(itinerarySchema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("itinerary_requests")
      .update({ status: parsed.data.status, staff_notes: parsed.data.staff_notes })
      .eq("id", parsed.data.id)
      .select("id");
    if (error) return failure(dbErrorMessage(error), formData);
    if (!data?.length) return failure("Request not found or not permitted.", formData);
    refresh();
    return success("Itinerary request updated.");
  });
}

// ---------------------------------------------------------------------------
// Privacy data requests (RLS: update needs settings.manage)
// ---------------------------------------------------------------------------
const dataRequestSchema = z
  .object({
    id: uuid,
    status: z.enum(DATA_REQUEST_STATUSES, { error: "Choose a valid status" }),
    response_note: optText(2000, "Response note"),
  })
  .superRefine((v, ctx) => {
    if (v.status === "rejected" && !v.response_note) {
      ctx.addIssue({ code: "custom", path: ["response_note"], message: "Explain why the request is rejected" });
    }
  });

export async function updateDataRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("settings.manage", async (viewer) => {
    const parsed = parseForm(dataRequestSchema, formData);
    if (!parsed.ok) return parsed.state;
    const { id, status, response_note } = parsed.data;
    const resolved = status === "completed" || status === "rejected";
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("data_requests")
      .update({
        status,
        response_note,
        resolved_by: resolved ? viewer.id : null,
        resolved_at: resolved ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("id");
    if (error) return failure(dbErrorMessage(error), formData);
    if (!data?.length) return failure("Request not found or not permitted.", formData);
    refresh();
    return success(`Request marked ${status.replace("_", " ")}.`);
  });
}

const anonymiseSchema = z.object({ id: uuid });

export async function anonymiseCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("settings.manage", async (viewer) => {
    const parsed = parseForm(anonymiseSchema, formData);
    if (!parsed.ok) return parsed.state;
    if (!integrations.supabaseAdmin()) {
      return failure("The server's Supabase service credentials (SUPABASE_SECRET_KEY) are not configured, so customers cannot be anonymised.");
    }

    // The data request (read with the viewer's RLS) identifies the customer — never a raw user id from the form.
    const supabase = await createSupabaseServerClient();
    const { data: request, error } = await supabase
      .from("data_requests")
      .select("id, request_type, user_id, profiles!data_requests_user_id_fkey(anonymized_at)")
      .eq("id", parsed.data.id)
      .maybeSingle();
    if (error) return failure(dbErrorMessage(error));
    const row = request as unknown as {
      id: string;
      request_type: string;
      user_id: string | null;
      profiles: { anonymized_at: string | null } | null;
    } | null;
    if (!row) return failure("Request not found or not permitted.");
    if (row.request_type !== "deletion") return failure("Only deletion requests can anonymise a customer.");
    if (!row.user_id) return failure("This request is not linked to a customer account.");
    if (row.profiles?.anonymized_at) return failure("This customer has already been anonymised.");
    if (row.user_id === viewer.id) return failure("You cannot anonymise your own account.");

    const { error: rpcError } = await createSupabaseAdminClient().rpc("anonymize_customer", {
      p_user_id: row.user_id,
      p_actor: viewer.id,
    });
    if (rpcError) return failure(dbErrorMessage(rpcError));
    refresh();
    return success("Customer personal data anonymised. Mark the request as completed with a short note.");
  });
}
