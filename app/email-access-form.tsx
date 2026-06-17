"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

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
      className="rounded-lg border border-[#d8dece] bg-white p-5 shadow-sm sm:p-6"
      onSubmit={(event) => {
        if (submittedRef.current) {
          event.preventDefault();
          return;
        }

        submittedRef.current = true;
      }}
    >
      <label htmlFor="email" className="text-sm font-medium text-[#38453c]">
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
          className="min-h-12 flex-1 rounded-md border border-[#cbd3c0] bg-white px-3 text-base outline-none ring-[#6d8b70] transition focus:ring-2"
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
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 rounded-md bg-[#2f5e46] px-5 font-semibold text-white transition hover:bg-[#254b38] disabled:cursor-wait disabled:bg-[#6f887a]"
    >
      {pending ? pendingLabel : submitLabel}
    </button>
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
      <p className="mt-4 rounded-md border border-[#bbd7bd] bg-[#eef8ef] px-3 py-2 text-sm text-[#255532]">
        {copy.magicLinkSent}
      </p>
    );
  }

  if (!error) {
    return null;
  }

  return (
    <p className="mt-4 rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
      {copy.errors[error] ?? error ?? copy.fallbackError}
    </p>
  );
}
