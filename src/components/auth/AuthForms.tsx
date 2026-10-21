"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/app/(auth)/actions";
import { FormMessage, SubmitButton } from "@/components/forms";
import { Checkbox, Field, Input } from "@/components/ui";
import { initialActionState } from "@/lib/actions";

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field label="Email" name="email" required error={e.email}>
        <Input type="email" name="email" autoComplete="email" required defaultValue={state.values?.email} error={e.email} />
      </Field>
      <Field label="Password" name="password" required error={e.password}>
        <Input type="password" name="password" autoComplete="current-password" required error={e.password} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-forest-800 underline">Forgot your password?</Link>
      </p>
      <p className="text-center text-sm text-muted">
        New to Yatra Travel? <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-forest-800 underline">Create an account</Link>
      </p>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUp, initialActionState);
  const e = state.errors ?? {};
  if (state.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <Field label="Full name" name="full_name" required error={e.full_name}>
        <Input name="full_name" autoComplete="name" required defaultValue={state.values?.full_name} error={e.full_name} />
      </Field>
      <Field label="Mobile number" name="phone" required error={e.phone}>
        <Input type="tel" name="phone" autoComplete="tel" required defaultValue={state.values?.phone} error={e.phone} />
      </Field>
      <Field label="Email" name="email" required error={e.email}>
        <Input type="email" name="email" autoComplete="email" required defaultValue={state.values?.email} error={e.email} />
      </Field>
      <Field label="Password" name="password" required error={e.password} hint="At least 10 characters, with a letter and a number">
        <Input type="password" name="password" autoComplete="new-password" required error={e.password} hint="At least 10 characters, with a letter and a number" />
      </Field>
      <Checkbox
        name="accept_terms"
        error={e.accept_terms}
        label={
          <>
            I agree to the <Link href="/terms" className="underline" target="_blank">terms</Link> and have read the{" "}
            <Link href="/privacy-policy" className="underline" target="_blank">privacy policy</Link>.
          </>
        }
      />
      <Checkbox name="marketing_opt_in" label="Send me occasional travel tips and offers by email (optional)." />
      <SubmitButton className="w-full" pendingLabel="Creating account…">Create account</SubmitButton>
      <p className="text-center text-sm text-muted">
        Already registered? <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-forest-800 underline">Sign in</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initialActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Email" name="email" required error={e.email}>
        <Input type="email" name="email" autoComplete="email" required defaultValue={state.values?.email} error={e.email} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, initialActionState);
  const e = state.errors ?? {};
  if (state.ok) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <Link href="/account" className="font-semibold text-forest-800 underline">Go to my account</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="New password" name="password" required error={e.password} hint="At least 10 characters, with a letter and a number">
        <Input type="password" name="password" autoComplete="new-password" required error={e.password} />
      </Field>
      <Field label="Confirm new password" name="confirm" required error={e.confirm}>
        <Input type="password" name="confirm" autoComplete="new-password" required error={e.confirm} />
      </Field>
      <SubmitButton className="w-full" pendingLabel="Saving…">Update password</SubmitButton>
    </form>
  );
}
