import { updateForumOpeningState } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ReliableForm } from "@/components/reliable-form";
import type { PanelReleaseMode } from "@/lib/panels/release";

export function ForumOpeningSettings({ eventId, mode }: {
  eventId: string;
  mode: PanelReleaseMode;
}) {
  const open = mode === "open";
  return (
    <div className="mt-5 rounded-lg border border-[var(--peace-border)] p-4">
      <h4 className="font-semibold">Iscrizioni ai Forum</h4>
      <p id={`forum-opening-help-${eventId}`} className="mt-1 text-sm text-[var(--peace-muted)]">
        Attiva per aprire le prenotazioni dei Forum pubblicati a partecipanti e capigruppo.
        Disattivando, i Forum vengono nascosti dalla pagina pubblica e le prenotazioni già registrate vengono conservate.
        L’accesso delle scuole è indipendente.
      </p>
      <ReliableForm action={updateForumOpeningState} locale="it" className="mt-3">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="expectedMode" value={mode} />
        <input type="hidden" name="open" value={open ? "false" : "true"} />
        <PendingSubmitButton
          role="switch"
          aria-checked={open}
          aria-label="Iscrizioni ai Forum"
          aria-describedby={`forum-opening-help-${eventId}`}
          pendingLabel="Salvataggio…"
          className="inline-flex min-h-11 items-center gap-3 rounded-md border border-[var(--peace-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--peace-blue-800)]"
        >
          <span aria-hidden="true" className={`relative h-6 w-11 rounded-full ${open ? "bg-[var(--peace-blue-800)]" : "bg-[#9fb5c8]"}`}>
            <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white ${open ? "translate-x-5" : ""}`} />
          </span>
          {open ? "Aperte" : "Chiuse"}
        </PendingSubmitButton>
      </ReliableForm>
      <p className="mt-2 text-sm text-[var(--peace-muted)]">
        {open ? "Forum visibili sul sito e prenotazioni aperte." : "Forum nascosti sul sito e prenotazioni chiuse."}
      </p>
    </div>
  );
}
