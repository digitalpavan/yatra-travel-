"use client";

import { createContext, useActionState, useContext, useEffect, useRef, startTransition, type ReactNode } from "react";
import { Alert, Button } from "@/components/ui";
import { initialActionState, type ActionState } from "@/lib/actions";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const PendingContext = createContext(false);

/**
 * Form wrapper for admin server actions.
 * - Submits via onSubmit + startTransition so inputs keep their values on error
 *   (React would otherwise reset uncontrolled fields after a form action).
 * - Shows the action's message, lists field errors and marks invalid inputs.
 * - Optional confirmation prompt for destructive actions.
 */
export function ActionForm({
  action,
  children,
  className = "",
  confirm,
  resetOnSuccess = false,
  encType,
  showErrorList = true,
  labels,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  encType?: "multipart/form-data";
  showErrorList?: boolean;
  /** Friendly names for field keys in the error summary. */
  labels?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    for (const el of Array.from(form.querySelectorAll("[data-admin-invalid]"))) {
      el.removeAttribute("aria-invalid");
      el.removeAttribute("data-admin-invalid");
    }
    if (state.ok && resetOnSuccess) form.reset();
    const errors = state.errors ?? {};
    let first: HTMLElement | null = null;
    for (const key of Object.keys(errors)) {
      const el = form.elements.namedItem(key);
      const target = el instanceof RadioNodeList ? (el[0] as HTMLElement | undefined) : (el as HTMLElement | null);
      if (target && "setAttribute" in target) {
        target.setAttribute("aria-invalid", "true");
        target.setAttribute("data-admin-invalid", "");
        first ??= target;
      }
    }
    if (first) first.focus();
    else if (state.message) messageRef.current?.focus();
  }, [state, resetOnSuccess]);

  const errorEntries = Object.entries(state.errors ?? {});

  return (
    <form
      ref={formRef}
      className={className}
      encType={encType}
      noValidate={false}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        if (confirm && !window.confirm(confirm)) return;
        // Include the clicked submit button's name/value (e.g. status buttons).
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const formData = new FormData(event.currentTarget, submitter instanceof HTMLButtonElement ? submitter : null);
        startTransition(() => formAction(formData));
      }}
    >
      <PendingContext.Provider value={pending}>
        {(state.message || errorEntries.length > 0) && (
          <div ref={messageRef} tabIndex={-1} className="mb-4 outline-none">
            <Alert tone={state.ok ? "success" : "error"} title={state.message}>
              {!state.ok && showErrorList && errorEntries.length > 0 && (
                <ul className="list-disc pl-5">
                  {errorEntries.map(([key, message]) => (
                    <li key={key}>
                      {labels?.[key] ? <strong>{labels[key]}: </strong> : null}
                      {message}
                    </li>
                  ))}
                </ul>
              )}
            </Alert>
          </div>
        )}
        {children}
      </PendingContext.Provider>
    </form>
  );
}

export function AdminSubmit({
  children,
  pendingLabel = "Saving…",
  variant = "primary",
  size = "md",
  className = "",
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "gold" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  name?: string;
  value?: string;
}) {
  const pending = useContext(PendingContext);
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} aria-disabled={pending} className={className} name={name} value={value}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
