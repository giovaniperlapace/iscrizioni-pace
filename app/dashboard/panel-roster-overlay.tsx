"use client";

import { Download, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { PendingDownload } from "@/components/pending-download";
import type { PanelRoster } from "@/lib/panels/panel-roster.server";

export function PanelRosterOverlay({ roster, error, closePath, dashboard = "admin" }: {
  dashboard?: "admin" | "manager";
  roster: PanelRoster | null;
  error: string | null;
  closePath: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const router = useRouter();
  useEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  const close = () => window.history.replaceState(null, "", closePath);
  return <dialog ref={dialogRef} aria-labelledby={titleId}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--peace-border)] bg-white p-0 text-[var(--peace-ink)] shadow-[var(--shadow-soft)] backdrop:bg-[rgba(16,36,60,0.52)] open:flex"
    onCancel={event => { event.preventDefault(); close(); }}>
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--peace-border)] bg-[var(--peace-soft)] p-5 sm:px-6">
      <div className="min-w-0"><h2 id={titleId} className="text-xl font-bold text-[var(--peace-blue-900)]">Iscritti al panel</h2>
        {roster ? <p className="mt-1 break-words text-sm text-[var(--peace-muted)]">{roster.title}</p> : null}</div>
      <button type="button" onClick={close} aria-label="Chiudi iscritti al panel" className="btn-secondary inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-white"><X size={20} aria-hidden="true" /></button>
    </header>
    <div className="grid min-h-0 min-w-0 gap-4 overflow-y-auto overscroll-contain bg-[var(--peace-soft)]/50 p-4 sm:p-6">
      {error ? <div role="alert" className="grid gap-3 rounded-xl border border-[#e0b5a9] bg-[#fff3ef] p-4 text-sm text-[#8a3323]"><p>{error}</p><button type="button" className="btn-secondary min-h-11 justify-self-start bg-white px-4" onClick={() => router.refresh()}>Riprova</button></div> : null}
      {roster ? <>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Iscritti e minori" value={roster.individualSeats} />
          <Metric label="Studenti e accompagnatori" value={roster.schoolSeats} />
          <Metric label="Posti ospiti riservati" value={roster.reservedGuestSeats} />
        </div>
        <p className="text-sm font-semibold text-[var(--peace-blue-900)]">Totale posti prenotati: {roster.individualSeats + roster.schoolSeats} · Posti ospiti riservati: {roster.reservedGuestSeats}</p>
        <div className="grid justify-items-start gap-2">
          <PendingDownload href={`/dashboard/${dashboard}/panel-iscritti/export?panelId=${encodeURIComponent(roster.panelId)}`} filename={`iscritti-panel-${roster.panelId}.xlsx`} className="btn-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm sm:w-auto"><Download size={18} aria-hidden="true" />Esporta in Excel</PendingDownload>
          <p className="text-xs text-[var(--peace-muted)]">Il file contiene le prenotazioni correnti al momento del download.</p>
        </div>
        <section className="surface-panel grid min-w-0 gap-3 p-4 sm:p-5"><h3 className="font-bold text-[var(--peace-blue-900)]">Iscritti e minori accompagnati</h3>
          {roster.people.length ? <div className="overflow-x-auto rounded-lg border border-[var(--peace-border)]"><table className="w-full min-w-[36rem] text-left text-sm"><thead><tr className="border-b border-[var(--peace-border)] bg-[var(--peace-soft)] text-xs font-bold uppercase tracking-wide text-[var(--peace-blue-700)]"><th className="px-3 py-3">Nome e cognome</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Adulto accompagnatore</th><th className="px-3 py-3">Codice</th></tr></thead><tbody>{roster.people.map(person => <tr key={person.id} className="border-b border-[var(--peace-border)] align-top last:border-0"><td className="px-3 py-3">{person.firstName} {person.lastName}</td><td className="px-3 py-3">{person.kind}</td><td className="px-3 py-3">{person.accompanyingAdult || "—"}</td><td className="px-3 py-3">{person.code || "—"}</td></tr>)}</tbody></table></div> : <p className="text-sm text-[var(--peace-muted)]">Nessun iscritto a questo panel.</p>}
        </section>
        <section className="surface-panel grid min-w-0 gap-3 p-4 sm:p-5"><h3 className="font-bold text-[var(--peace-blue-900)]">Scuole e classi</h3>
          {roster.schools.length ? <div className="overflow-x-auto rounded-lg border border-[var(--peace-border)]"><table className="w-full min-w-[36rem] text-left text-sm"><thead><tr className="border-b border-[var(--peace-border)] bg-[var(--peace-soft)] text-xs font-bold uppercase tracking-wide text-[var(--peace-blue-700)]"><th className="px-3 py-3">Scuola / città</th><th className="px-3 py-3">Classe / gruppo</th><th className="px-3 py-3">Studenti</th><th className="px-3 py-3">Accompagnatori</th><th className="px-3 py-3">Posti</th></tr></thead><tbody>{roster.schools.map(school => <tr key={school.id} className="border-b border-[var(--peace-border)] align-top last:border-0"><td className="px-3 py-3">{school.name}<span className="block text-[var(--peace-muted)]">{school.city}</span></td><td className="px-3 py-3">{school.classDescription}</td><td className="px-3 py-3">{school.students}</td><td className="px-3 py-3">{school.companions}</td><td className="px-3 py-3">{school.students + school.companions}</td></tr>)}</tbody></table></div> : <p className="text-sm text-[var(--peace-muted)]">Nessuna prenotazione scuola per questo panel.</p>}
        </section>
        <section className="surface-panel grid gap-2 p-4 sm:p-5"><h3 className="font-bold text-[var(--peace-blue-900)]">Posti ospiti riservati</h3>
          {roster.guests.map(guest => <p key={guest.id} className="text-sm">{guest.name}: {guest.seats} posti riservati</p>)}
          {!roster.guests.length ? <p className="text-sm">Nessuna quota ospiti configurata.</p> : null}
          <p className="text-sm text-[var(--peace-muted)]">Questi posti sono riservati agli ospiti ed esclusi dal form pubblico. Sono conteggiati separatamente dalle prenotazioni di iscritti e scuole.</p>
        </section>
      </> : null}
    </div>
    <footer className="flex shrink-0 justify-end border-t border-[var(--peace-border)] bg-[var(--peace-soft)] px-5 py-4 sm:px-6"><button type="button" onClick={close} className="btn-secondary inline-flex min-h-11 items-center justify-center bg-white px-5 text-sm">Chiudi</button></footer>
  </dialog>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="surface-panel p-4"><p className="text-3xl font-semibold tabular-nums text-[var(--peace-blue-800)]">{value}</p><p className="text-sm text-[var(--peace-muted)]">{label}</p></div>;
}
