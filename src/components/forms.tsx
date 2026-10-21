"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Alert, Button } from "@/components/ui";
import type { ActionState } from "@/lib/actions";

export function SubmitButton({
  children,
  pendingLabel = "Please wait…",
  variant = "primary",
  size = "md",
  className = "",
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "gold" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Shows the action's top-level success/error message. */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>;
}
