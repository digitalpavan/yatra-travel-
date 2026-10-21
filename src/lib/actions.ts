import type { z } from "zod";
import { fieldErrors } from "@/lib/validation";

/** Result shape returned by every server action used with useActionState. */
export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** Echo of submitted text values so forms can repopulate after an error. */
  values?: Record<string, string>;
};

export const initialActionState: ActionState = { ok: false };

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$") && !/password/i.test(key)) values[key] = value;
  }
  return values;
}

export function invalid(error: z.ZodError, formData: FormData, message = "Please correct the highlighted fields."): ActionState {
  return { ok: false, message, errors: fieldErrors(error), values: formValues(formData) };
}

export function failure(message: string, formData?: FormData, errors?: Record<string, string>): ActionState {
  return { ok: false, message, errors, values: formData ? formValues(formData) : undefined };
}
