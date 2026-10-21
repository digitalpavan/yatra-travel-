"use client";

import Link from "next/link";
import { useActionState } from "react";
import { submitSupportRequest } from "@/app/(site)/contact/actions";
import { FormMessage, SubmitButton } from "@/components/forms";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { initialActionState } from "@/lib/actions";
import { Honeypot } from "./Honeypot";

const CATEGORIES = [
  ["general", "General enquiry"],
  ["booking", "Existing booking"],
  ["payment", "Payment"],
  ["cancellation", "Cancellation or refund"],
  ["feedback", "Feedback"],
  ["privacy", "Privacy / personal data"],
] as const;

export function ContactForm() {
  const [state, action] = useActionState(submitSupportRequest, initialActionState);
  const v = (key: string, fallback = "") => state.values?.[key] ?? fallback;
  const e = state.errors ?? {};

  return (
    <form action={action} className="relative space-y-4" noValidate>
      <FormMessage state={state} />
      <Honeypot />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" name="name" required error={e.name}>
          <Input name="name" autoComplete="name" required maxLength={120} defaultValue={v("name")} error={e.name} />
        </Field>
        <Field label="Email" name="email" required error={e.email}>
          <Input name="email" type="email" autoComplete="email" required defaultValue={v("email")} error={e.email} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mobile number (optional)" name="phone" error={e.phone}>
          <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v("phone")} error={e.phone} />
        </Field>
        <Field label="Topic" name="category" error={e.category}>
          <Select name="category" defaultValue={v("category", "general")} error={e.category}>
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Booking reference (if any)" name="booking_reference" error={e.booking_reference} hint="Looks like YT261021-ABCDE">
        <Input
          name="booking_reference"
          autoCapitalize="characters"
          maxLength={20}
          placeholder="YT261021-ABCDE"
          defaultValue={v("booking_reference")}
          error={e.booking_reference}
          hint="Looks like YT261021-ABCDE"
        />
      </Field>
      <Field label="Subject" name="subject" required error={e.subject}>
        <Input name="subject" required maxLength={160} defaultValue={v("subject")} error={e.subject} />
      </Field>
      <Field label="Message" name="message" required error={e.message}>
        <Textarea name="message" required maxLength={5000} rows={6} defaultValue={v("message")} error={e.message} />
      </Field>
      <p className="text-xs text-muted">
        We use your details only to respond to this request (see our <Link href="/privacy-policy" className="underline">privacy policy</Link>).
        Please do not share card numbers, OTPs or passwords.
      </p>
      <SubmitButton size="lg" pendingLabel="Sending…">
        Send message
      </SubmitButton>
    </form>
  );
}
