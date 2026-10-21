"use client";

import { useActionState } from "react";
import { cancelMyBooking, createDataRequest, createTicket, replyToTicket, submitReview, updateProfile } from "@/app/account/actions";
import { FormMessage, SubmitButton } from "@/components/forms";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { initialActionState } from "@/lib/actions";

export function CancelBookingForm({ reference, refundText }: { reference: string; refundText: string }) {
  const [state, action] = useActionState(cancelMyBooking, initialActionState);
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reference" value={reference} />
      <p className="text-sm">{refundText}</p>
      <Field label="Reason (optional)" name="reason">
        <Textarea name="reason" rows={2} maxLength={500} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="danger" pendingLabel="Cancelling…">Cancel this booking</SubmitButton>
    </form>
  );
}

export function ReviewForm({ bookingId, defaultName }: { bookingId: string; defaultName: string }) {
  const [state, action] = useActionState(submitReview, initialActionState);
  const e = state.errors ?? {};
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Rating" name="rating" required error={e.rating}>
          <Select name="rating" defaultValue="5">
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{`${n} star${n > 1 ? "s" : ""}`}</option>
            ))}
          </Select>
        </Field>
        <Field label="Name to display" name="display_name" required error={e.display_name} hint="E.g. first name and city">
          <Input name="display_name" defaultValue={state.values?.display_name ?? defaultName} maxLength={60} error={e.display_name} />
        </Field>
      </div>
      <Field label="Title (optional)" name="title" error={e.title}>
        <Input name="title" maxLength={120} defaultValue={state.values?.title} />
      </Field>
      <Field label="Your review" name="body" required error={e.body}>
        <Textarea name="body" maxLength={2000} rows={4} defaultValue={state.values?.body} error={e.body} />
      </Field>
      <SubmitButton pendingLabel="Submitting…">Submit review</SubmitButton>
    </form>
  );
}

export function ProfileForm({ profile }: { profile: { full_name: string; phone: string; whatsapp_opt_in: boolean; marketing_opt_in: boolean } }) {
  const [state, action] = useActionState(updateProfile, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Full name" name="full_name" required error={e.full_name}>
        <Input name="full_name" autoComplete="name" defaultValue={state.values?.full_name ?? profile.full_name} error={e.full_name} />
      </Field>
      <Field label="Mobile number" name="phone" required error={e.phone}>
        <Input type="tel" name="phone" autoComplete="tel" defaultValue={state.values?.phone ?? profile.phone} error={e.phone} />
      </Field>
      <Checkbox name="whatsapp_opt_in" defaultChecked={profile.whatsapp_opt_in} label="Receive booking updates on WhatsApp" />
      <Checkbox name="marketing_opt_in" defaultChecked={profile.marketing_opt_in} label="Receive occasional travel tips and offers by email" />
      <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}

export function NewTicketForm({ references }: { references: string[] }) {
  const [state, action] = useActionState(createTicket, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Topic" name="category" required>
          <Select name="category" defaultValue="booking">
            <option value="booking">Booking</option>
            <option value="payment">Payment</option>
            <option value="cancellation">Cancellation / refund</option>
            <option value="feedback">Feedback</option>
            <option value="general">Other</option>
          </Select>
        </Field>
        <Field label="Booking (optional)" name="booking_reference" error={e.booking_reference}>
          <Select name="booking_reference" defaultValue="">
            <option value="">Not about a specific booking</option>
            {references.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Subject" name="subject" required error={e.subject}>
        <Input name="subject" maxLength={160} defaultValue={state.values?.subject} error={e.subject} />
      </Field>
      <Field label="Message" name="message" required error={e.message}>
        <Textarea name="message" maxLength={5000} rows={4} defaultValue={state.values?.message} error={e.message} />
      </Field>
      <SubmitButton pendingLabel="Sending…">Send request</SubmitButton>
    </form>
  );
}

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action] = useActionState(replyToTicket, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="ticket_id" value={ticketId} />
      <FormMessage state={state} />
      <label htmlFor={`reply-${ticketId}`} className="sr-only">Reply</label>
      <Textarea id={`reply-${ticketId}`} name="body" rows={2} maxLength={5000} placeholder="Write a reply…" />
      <SubmitButton size="sm" pendingLabel="Sending…">Reply</SubmitButton>
    </form>
  );
}

export function DataRequestForm() {
  const [state, action] = useActionState(createDataRequest, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <FormMessage state={state} />
      <Field label="Request type" name="request_type" required>
        <Select name="request_type" defaultValue="correction">
          <option value="correction">Correct my personal data</option>
          <option value="deletion">Delete my account and personal data</option>
          <option value="withdraw_consent">Withdraw consent</option>
          <option value="access">Get a summary of my personal data (handled by staff)</option>
        </Select>
      </Field>
      <Field label="Details" name="details" hint="Tell us what should change, or anything we should know.">
        <Textarea name="details" rows={3} maxLength={2000} />
      </Field>
      <SubmitButton pendingLabel="Submitting…">Submit request</SubmitButton>
    </form>
  );
}
