"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { failure, type ActionState } from "@/lib/actions";
import { adminAction, dbErrorMessage, success } from "@/lib/server/admin/errors";
import { parseForm, reqText, uuid } from "@/lib/server/admin/forms";
import { integrations } from "@/lib/server/env";
import { executeRefund } from "@/lib/server/payments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ACTIONABLE = ["requested", "approved", "failed"];

const idSchema = z.object({ id: uuid });

/** Load the refund through the user client (RLS) so we only act on rows the viewer can see. */
async function loadRefund(id: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("refunds").select("id, status").eq("id", id).maybeSingle();
  return { refund: data as { id: string; status: string } | null, error };
}

export async function processRefund(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("refunds.manage", async (viewer) => {
    const parsed = parseForm(idSchema, formData);
    if (!parsed.ok) return parsed.state;

    // Never simulate a refund: refuse when the gateway or service credentials are missing.
    if (!integrations.razorpay()) {
      return failure("Razorpay is not configured — refunds cannot be processed online.");
    }
    if (!integrations.supabaseAdmin()) {
      return failure("The server's Supabase service credentials are not configured — refunds cannot be processed.");
    }

    const { refund, error } = await loadRefund(parsed.data.id);
    if (error) return failure(dbErrorMessage(error));
    if (!refund) return failure("Refund not found or not permitted.");
    if (!ACTIONABLE.includes(refund.status)) return failure(`This refund is already ${refund.status} and cannot be processed again.`);

    const result = await executeRefund(refund.id, viewer.id);
    refresh();
    return success(`Refund submitted to Razorpay (gateway id ${result.providerRefundId}). Its status updates when Razorpay confirms it.`);
  });
}

const declineSchema = z.object({
  id: uuid,
  reason: reqText(500, "Reason", 3),
});

export async function declineRefund(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("refunds.manage", async (viewer) => {
    const parsed = parseForm(declineSchema, formData);
    if (!parsed.ok) return parsed.state;
    if (!integrations.supabaseAdmin()) {
      return failure("The server's Supabase service credentials are not configured — refunds cannot be declined.");
    }

    const { refund, error } = await loadRefund(parsed.data.id);
    if (error) return failure(dbErrorMessage(error));
    if (!refund) return failure("Refund not found or not permitted.");
    if (!ACTIONABLE.includes(refund.status)) return failure(`This refund is already ${refund.status} and cannot be declined.`);

    const db = createSupabaseAdminClient();
    const { error: rpcError } = await db.rpc("reject_refund", {
      p_refund_id: refund.id,
      p_actor: viewer.id,
      p_reason: parsed.data.reason,
    });
    if (rpcError) return failure(dbErrorMessage(rpcError));

    // reject_refund is a no-op when the status changed concurrently — confirm it applied.
    const { data: after } = await db.from("refunds").select("status").eq("id", refund.id).maybeSingle();
    if (after?.status !== "rejected") return failure("The refund changed status before it could be declined. Refresh and try again.");

    refresh();
    return success("Refund request declined.");
  });
}
