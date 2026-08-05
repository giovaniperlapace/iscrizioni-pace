"use client";

import { useActionState, useEffect } from "react";

import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  sendParticipantOrganizerMessage,
  type ParticipantMessageActionState,
} from "@/app/dashboard/partecipante/message-actions";
import { useParticipantDashboardOverlay } from "@/app/dashboard/partecipante/participant-dashboard-overlay";
import {
  PARTICIPANT_MESSAGE_MAX_LENGTH,
  type ParticipantMessageError,
} from "@/lib/registrations/participant-message-shared";

export type ParticipantMessageFormCopy = {
  label: string;
  placeholder: string;
  send: string;
  sending: string;
  sent: string;
  maxLength: string;
  errors: Record<ParticipantMessageError, string>;
};

const INITIAL_STATE: ParticipantMessageActionState = {
  status: "idle",
  error: null,
};

const SUCCESS_MESSAGE_DURATION_MS = 3_500;

export function ParticipantMessageForm({
  copy,
}: {
  copy: ParticipantMessageFormCopy;
}) {
  const [state, formAction] = useActionState(
    sendParticipantOrganizerMessage,
    INITIAL_STATE
  );
  const overlay = useParticipantDashboardOverlay();

  useEffect(() => {
    if (state.status !== "success" || !overlay) {
      return;
    }

    return overlay.scheduleClose(SUCCESS_MESSAGE_DURATION_MS);
  }, [overlay, state.status]);

  if (state.status === "success") {
    return (
      <p
        role="status"
        className="rounded-md border border-[#b9d5bd] bg-[#f0f8ed] px-4 py-3 text-sm font-medium text-[#315e3b]"
      >
        {copy.sent}
      </p>
    );
  }

  return (
    <form action={formAction} className="grid gap-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]"
        >
          {copy.errors[state.error]}
        </p>
      ) : null}

      <label className="grid gap-2 text-sm font-medium text-[var(--peace-ink)]">
        <span>{copy.label}</span>
        <textarea
          name="message"
          required
          maxLength={PARTICIPANT_MESSAGE_MAX_LENGTH}
          rows={8}
          placeholder={copy.placeholder}
          className="field min-h-44 resize-y"
        />
        <span className="text-xs font-normal text-[var(--peace-muted)]">
          {copy.maxLength}
        </span>
      </label>

      <PendingSubmitButton
        pendingLabel={copy.sending}
        className="inline-flex min-h-11 w-fit items-center justify-center rounded-md bg-[var(--peace-blue-800)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--peace-blue-900)] disabled:cursor-wait disabled:opacity-70"
      >
        {copy.send}
      </PendingSubmitButton>
    </form>
  );
}
