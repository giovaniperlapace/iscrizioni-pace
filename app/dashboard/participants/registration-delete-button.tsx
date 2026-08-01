"use client";

import { Trash2 } from "lucide-react";

import { PendingSubmitButton } from "@/components/pending-submit-button";

type RegistrationDeleteButtonProps = {
  participantName: string;
};

export function RegistrationDeleteButton({
  participantName,
}: RegistrationDeleteButtonProps) {
  return (
    <PendingSubmitButton
      pendingLabel="Eliminazione..."
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
      onClick={(event) => {
        const confirmed = window.confirm(
          `Vuoi davvero eliminare definitivamente l'iscrizione di ${participantName}? Verranno eliminati anche QR, consensi, presenze, assegnazioni e altri dati collegati a questa iscrizione. L'account di accesso non verrà cancellato.`
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <Trash2 className="size-4" aria-hidden="true" />
      Elimina iscrizione
    </PendingSubmitButton>
  );
}
