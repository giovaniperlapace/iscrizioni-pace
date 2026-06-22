"use client";

import { useRef } from "react";

import { PendingSubmitButton } from "@/components/pending-submit-button";

type EmailAccessFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  defaultEmail: string;
  error?: string;
  sent?: string;
  copy: {
    submit: string;
    pending: string;
    magicLinkSent: string;
    errors: Record<string, string>;
    fallbackError: string;
  };
};

export function EmailAccessForm({
  action,
  defaultEmail,
  error,
  sent,
  copy,
}: EmailAccessFormProps) {
  const submittedRef = useRef(false);

  return (
    <form
      action={action}
      className="surface-card p-5 sm:p-6"
      onSubmit={(event) => {
        if (submittedRef.current) {
          event.preventDefault();
          return;
        }

        submittedRef.current = true;
      }}
    >
      <label htmlFor="email" className="text-sm font-bold text-[var(--peace-ink)]">
        Email
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
          className="field flex-1"
          placeholder="nome@example.org"
        />
        <SubmitButton submitLabel={copy.submit} pendingLabel={copy.pending} />
      </div>
      <StatusMessage copy={copy} error={error} sent={sent} />
    </form>
  );
}

function SubmitButton({
  submitLabel,
  pendingLabel,
}: {
  submitLabel: string;
  pendingLabel: string;
}) {
  return (
    <PendingSubmitButton
      pendingLabel={pendingLabel}
      className="btn-primary px-5"
    >
      {submitLabel}
    </PendingSubmitButton>
  );
}

function StatusMessage({
  copy,
  error,
  sent,
}: {
  copy: EmailAccessFormProps["copy"];
  error?: string;
  sent?: string;
}) {
  if (sent === "magic-link") {
    return (
      <p className="status-success mt-4 rounded-[var(--radius-sm)] border px-3 py-2 text-sm">
        {copy.magicLinkSent}
      </p>
    );
  }

  if (!error) {
    return null;
  }

  return (
    <p className="status-error mt-4 rounded-[var(--radius-sm)] border px-3 py-2 text-sm">
      {copy.errors[error] ?? error ?? copy.fallbackError}
    </p>
  );
}
