"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { failure, type ActionState } from "@/lib/actions";
import { TAGS } from "@/lib/data/catalog";
import { adminAction, dbErrorMessage, success } from "@/lib/server/admin/errors";
import { parseForm, uuid } from "@/lib/server/admin/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  id: uuid,
  status: z.enum(["approved", "rejected"], { error: "Choose approve or reject" }),
});

export async function moderateReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return adminAction("reviews.manage", async (viewer) => {
    const parsed = parseForm(schema, formData);
    if (!parsed.ok) return parsed.state;
    const supabase = await createSupabaseServerClient();
    // Column grants allow only status, moderated_by and moderated_at.
    const { data, error } = await supabase
      .from("reviews")
      .update({ status: parsed.data.status, moderated_by: viewer.id, moderated_at: new Date().toISOString() })
      .eq("id", parsed.data.id)
      .select("id");
    if (error) return failure(dbErrorMessage(error));
    if (!data?.length) return failure("Review not found or not permitted.");
    updateTag(TAGS.testimonials);
    refresh();
    return success(parsed.data.status === "approved" ? "Review approved and published." : "Review rejected.");
  });
}
