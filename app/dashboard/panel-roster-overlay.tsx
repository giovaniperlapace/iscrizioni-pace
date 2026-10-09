"use client";

import { Download, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { PendingDownload } from "@/components/pending-download";
import type { PanelRoster } from "@/lib/panels/panel-roster.server";

export function PanelRosterOverlay({ roster, error, closePath }: {
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
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--peace-border)] bg-white p-0 text-[var(--peace-ink)] shadow-xl backdrop:bg-black/40 open:flex"
    onCancel={event => { event.preventDefault(); close(); }}>
    <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--peace-border)] p-5">
      <div className="min-w-0"><h2 id={titleId} className="text-xl font-semibold">Iscritti al panel</h2>
        {roster ? <p className="mt-1 break-words text-sm text-[var(--peace-muted)]">{roster.title}</p> : null}</div>
      <button type="button" onClick={close} aria-label="Chiudi iscritti al panel" className="btn-secondary inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center"><X size={20} aria-hidden="true" /></button>
    </header>
    <div className="grid min-h-0 min-w-0 gap-5 overflow-y-auto overscroll-contain p-5">
      {error ? <div role="alert" className="grid gap-3 text-sm"><p>{error}</p><button type="button" className="btn-secondary justify-self-start" onClick={() => router.refresh()}>Riprova</button></div> : null}
      {roster ? <>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Iscritti e minori" value={roster.individualSeats} />
          <Metric label="Studenti e accompagnatori" value={roster.schoolSeats} />
          <Metric label="Posti ospiti riservati" value={roster.reservedGuestSeats} />
        </div>
        <p className="text-sm font-semibold">Totale posti prenotati: {roster.individualSeats + roster.schoolSeats} · Posti ospiti riservati: {roster.reservedGuestSeats}</p>
        <div className="grid justify-items-start gap-2">
          <PendingDownload href={`/dashboard/admin/panel-iscritti/export?panelId=${encodeURIComponent(roster.panelId)}`} filename={`iscritti-panel-${roster.panelId}.xlsx`} className="btn-secondary inline-flex min-h-11 items-center gap-2"><Download size={18} aria-hidden="true" />Esporta in Excel</PendingDownload>
          <p className="text-xs text-[var(--peace-muted)]">Il file contiene le prenotazioni correnti al momento del download.</p>
        </div>
        <section className="grid min-w-0 gap-3"><h3 className="font-semibold">Iscritti e minori accompagnati</h3>
          {roster.people.length ? <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-left text-sm"><thead><tr className="border-b border-[var(--peace-border)]"><th className="p-2">Nome e cognome</th><th className="p-2">Tipo</th><th className="p-2">Adulto accompagnatore</th><th className="p-2">Codice</th></tr></thead><tbody>{roster.people.map(person => <tr key={person.id} className="border-b border-[var(--peace-border)] align-top"><td className="p-2">{person.firstName} {person.lastName}</td><td className="p-2">{person.kind}</td><td className="p-2">{person.accompanyingAdult || "—"}</td><td className="p-2">{person.code || "—"}</td></tr>)}</tbody></table></div> : <p className="text-sm text-[var(--peace-muted)]">Nessun iscritto a questo panel.</p>}
        </section>
        <section className="grid min-w-0 gap-3"><h3 className="font-semibold">Scuole e classi</h3>
          {roster.schools.length ? <div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-left text-sm"><thead><tr className="border-b border-[var(--peace-border)]"><th className="p-2">Scuola / città</th><th className="p-2">Classe / gruppo</th><th className="p-2">Studenti</th><th className="p-2">Accompagnatori</th><th className="p-2">Posti</th></tr></thead><tbody>{roster.schools.map(school => <tr key={school.id} className="border-b border-[var(--peace-border)] align-top"><td className="p-2">{school.name}<span className="block text-[var(--peace-muted)]">{school.city}</span></td><td className="p-2">{school.classDescription}</td><td className="p-2">{school.students}</td><td className="p-2">{school.companions}</td><td className="p-2">{school.students + school.companions}</td></tr>)}</tbody></table></div> : <p className="text-sm text-[var(--peace-muted)]">Nessuna prenotazione scuola per questo panel.</p>}
        </section>
        <section className="grid gap-2"><h3 className="font-semibold">Posti ospiti riservati</h3>
          {roster.guests.map(guest => <p key={guest.id} className="text-sm">{guest.name}: {guest.seats} posti riservati</p>)}
          {!roster.guests.length ? <p className="text-sm">Nessuna quota ospiti configurata.</p> : null}
          <p className="text-sm text-[var(--peace-muted)]">Questi posti sono riservati agli ospiti ed esclusi dal form pubblico. Sono conteggiati separatamente dalle prenotazioni di iscritti e scuole.</p>
        </section>
      </> : null}
    </div>
    <footer className="flex shrink-0 justify-end border-t border-[var(--peace-border)] p-5"><button type="button" onClick={close} className="btn-secondary min-h-11">Chiudi</button></footer>
  </dialog>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md border border-[var(--peace-border)] bg-[var(--peace-soft)] p-3"><p className="text-xl font-semibold tabular-nums">{value}</p><p className="text-sm text-[var(--peace-muted)]">{label}</p></div>;
}
