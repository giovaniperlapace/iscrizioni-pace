"use client";

import { Trash2 } from "lucide-react";

import { PendingSubmitButton } from "@/components/pending-submit-button";

type OperationalRoleDeleteButtonProps = {
  label: string;
};

export function OperationalRoleDeleteButton({
  label,
}: OperationalRoleDeleteButtonProps) {
  return (
    <PendingSubmitButton
      aria-label={label}
      title={label}
      className="inline-flex size-10 items-center justify-center rounded-md border border-red-200 text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
      onClick={(event) => {
        const firstConfirm = window.confirm(
          "Vuoi eliminare questo ruolo operativo?"
        );
        if (!firstConfirm) {
          event.preventDefault();
          return;
        }

        const secondConfirm = window.confirm(
          "Confermi l'eliminazione? L'accesso operativo verra' revocato."
        );
        if (!secondConfirm) {
          event.preventDefault();
        }
      }}
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </PendingSubmitButton>
  );
}
