"use client";

import Link from "next/link";
import { useActionState, useState, useSyncExternalStore } from "react";
import { submitItineraryRequest } from "@/app/(site)/custom-itinerary/actions";
import { FormMessage, SubmitButton } from "@/components/forms";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { initialActionState } from "@/lib/actions";
import { VEHICLE_CLASS_LABELS } from "@/lib/types";
import { Honeypot } from "./Honeypot";

function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

const noopSubscribe = () => () => {};

export function ItineraryForm({ defaultPlaces = "" }: { defaultPlaces?: string }) {
  const [state, action] = useActionState(submitItineraryRequest, initialActionState);
  // Today's date is read only in the browser (undefined during prerendering).
  const minDate = useSyncExternalStore(noopSubscribe, todayInIndia, () => undefined);
  const [start, setStart] = useState("");

  const v = (key: string, fallback = "") => state.values?.[key] ?? fallback;
  const e = state.errors ?? {};

  return (
    <form action={action} className="relative space-y-5" noValidate>
      <FormMessage state={state} />
      <Honeypot />

      <fieldset className="space-y-4">
        <legend className="mb-1 font-display text-lg font-semibold text-forest-900">Your details</legend>
        <Field label="Full name" name="name" required error={e.name}>
          <Input name="name" autoComplete="name" required maxLength={120} defaultValue={v("name")} error={e.name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mobile number" name="phone" required error={e.phone} hint="We will call or message you on this number">
            <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" required defaultValue={v("phone")} error={e.phone} hint="We will call or message you on this number" />
          </Field>
          <Field label="Email" name="email" required error={e.email}>
            <Input name="email" type="email" autoComplete="email" required defaultValue={v("email")} error={e.email} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 font-display text-lg font-semibold text-forest-900">Your trip</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" name="travel_start" required error={e.travel_start}>
            <Input
              name="travel_start"
              type="date"
              required
              min={minDate}
              defaultValue={v("travel_start")}
              onChange={(ev) => setStart(ev.currentTarget.value)}
              error={e.travel_start}
            />
          </Field>
          <Field label="End date" name="travel_end" required error={e.travel_end}>
            <Input name="travel_end" type="date" required min={start || minDate} defaultValue={v("travel_end")} error={e.travel_end} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Number of travellers" name="passengers" required error={e.passengers}>
            <Input name="passengers" type="number" inputMode="numeric" min={1} max={60} required defaultValue={v("passengers", "2")} error={e.passengers} />
          </Field>
          <Field label="Pickup city" name="pickup_city" required error={e.pickup_city} hint="e.g. Tirupati, Chennai, Bengaluru">
            <Input name="pickup_city" required maxLength={120} defaultValue={v("pickup_city", "Tirupati")} error={e.pickup_city} hint="e.g. Tirupati, Chennai, Bengaluru" />
          </Field>
        </div>
        <Field label="Places you would like to visit" name="places" error={e.places} hint="Separate with commas, e.g. Tirumala, Srikalahasti, Kanipakam">
          <Input name="places" maxLength={2400} defaultValue={v("places", defaultPlaces)} error={e.places} hint="Separate with commas, e.g. Tirumala, Srikalahasti, Kanipakam" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred vehicle" name="preferred_vehicle" error={e.preferred_vehicle}>
            <Select name="preferred_vehicle" defaultValue={v("preferred_vehicle")} error={e.preferred_vehicle}>
              <option value="">No preference</option>
              {Object.entries(VEHICLE_CLASS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Budget (optional)" name="budget_note" error={e.budget_note}>
            <Input name="budget_note" maxLength={300} placeholder="A rough range helps us plan" defaultValue={v("budget_note")} error={e.budget_note} />
          </Field>
        </div>
        <Field label="Anything else we should know?" name="details" error={e.details}>
          <Textarea
            name="details"
            maxLength={3000}
            placeholder="Senior travellers, accessibility needs, darshan slot already booked with TTD, hotel preferences, preferred start times…"
            defaultValue={v("details")}
            error={e.details}
          />
        </Field>
      </fieldset>

      <p className="text-xs text-muted">
        We use these details only to plan your trip and contact you about it, as described in our{" "}
        <Link href="/privacy-policy" className="underline">privacy policy</Link>. Submitting this form is a request, not a booking — nothing is
        charged.
      </p>
      <SubmitButton variant="gold" size="lg" pendingLabel="Sending request…">
        Request my itinerary
      </SubmitButton>
    </form>
  );
}
