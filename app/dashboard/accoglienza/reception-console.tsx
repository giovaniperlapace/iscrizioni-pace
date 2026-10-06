"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { BadgeCommand, BadgeResult } from "@/lib/reception/group-badges";
import { GroupBadgePanel } from "./group-badge-panel";
import PendingLink from "@/components/pending-link";
import { ReceptionCamera } from "./reception-camera";
import type { ReceptionDuty } from "@/lib/reception/duties.server";
import type { CameraSource } from "@/lib/reception/camera";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
import { ReceptionStationSession, ScanLatch, type ReceptionMode, type VerifiedReception } from "@/lib/reception/station";

const labels = { enter: "Registra ingresso", correct: "Salva presenze", cancel: "Annulla ingresso" };
const date = (value: string) => new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(value));

export function ReceptionConsole({ commandAction, cameraSource, duty, onChangeDuty, badgeCommandAction }: {
  badgeCommandAction?: (command: BadgeCommand) => Promise<BadgeResult>;
  duty?: ReceptionDuty;
  onChangeDuty?: () => void;
  commandAction: (command: ReceptionCommand) => Promise<ReceptionResult>;
  cameraSource?: CameraSource;
}) {
  const [session] = useState(() => new ReceptionStationSession(commandAction, () => crypto.randomUUID(), 20000, duty?.duty === "panel_entry" || duty?.duty === "room_assistance" ? { duty: duty.duty, panelId: duty.panelId } : { duty: "event_entry" }));
  const readOnly = duty?.duty === "room_assistance";
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [input, setInput] = useState<"camera" | "manual">("camera");
  const [value, setValue] = useState("");
  const latch = useRef(new ScanLatch());
  const [badgeBusy, setBadgeBusy] = useState(false);
  const locked = session.isLocked() || badgeBusy;
  const selection = state.phase === "selection";
  const correction = state.mode !== "enter";
  const groupOpen = state.result?.kind === "group";
  const operationOpen = selection || state.phase === "uncertain" || state.phase === "blocked";
  const [expiredFeedback, setExpiredFeedback] = useState<typeof state | null>(null);
  const completedFeedback = state.phase === "result" || state.phase === "error";
  useEffect(() => {
    if (!completedFeedback) return;
    const timer = setTimeout(() => setExpiredFeedback(state), 7000);
    return () => clearTimeout(timer);
  }, [state, completedFeedback]);

  useEffect(() => { session.setActive(true); return () => session.setActive(false); }, [session]);

  useEffect(() => {
    if (state.phase !== "pending" && state.phase !== "uncertain") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.phase]);

  function dismiss() { if (badgeBusy) return; session.setMode("enter"); session.next(); }
  function inspect(lookup: ReceptionCommand["lookup"]) { if (badgeBusy || session.isLocked() || session.snapshot().phase === "selection") return; session.setMode("enter"); void session.inspect(lookup); }
  const operationContent = <>
    {state.phase === "pending" && input === "manual" && <p role="status" className="rounded-xl bg-slate-100 p-4 font-semibold" aria-live="polite">Operazione in corso. Attendi l’esito prima della prossima persona…</p>}
    {state.message && (input === "manual" || operationOpen) && <div role={state.phase === "result" ? "status" : "alert"} className={`rounded-xl border p-4 ${state.phase === "result" ? "border-green-400 bg-green-50 text-green-950" : "border-amber-400 bg-amber-50 text-amber-950"}`}>
      <p className="font-semibold">{state.message}</p>
      {state.phase === "uncertain" && <button type="button" className="btn-primary mt-3 min-h-12 px-4" onClick={() => void session.retry()}>Riprova la stessa operazione</button>}
      {state.phase === "blocked" && <PendingLink className="mt-3 block underline" href="/">Torna all’accesso</PendingLink>}
    </div>}

    {state.result && state.phase !== "pending" && <div className="grid gap-3 border-t border-[var(--peace-border)] pt-4">
      <h3 className="text-lg font-semibold">{selection ? "Conferma le presenze" : "Ultima operazione"}</h3>
      {selection && state.result.kind === "family" ? <p className="text-sm">Codice {state.result.code}</p> : <PresenceSummary result={state.result} />}
      {selection && state.result.kind === "group" && !correction && <button type="button" className="btn-secondary min-h-12 px-4" onClick={()=>session.finishGroupInspection()}>Prepara badge senza registrare ingressi</button>}
      {selection && state.result.kind !== "room" && <PresenceSelection key={`${state.result.kind}-${state.result.revision}-${state.mode}`} result={state.result} mode={state.mode}
        onSubmit={(values, confirmed, cancelSchool) => void session.submit(values, confirmed, cancelSchool)} onDismiss={dismiss} />}
      {state.result.kind === "group" && state.lookup?.kind === "qr" && state.phase === "result" && <GroupBadgePanel token={state.lookup.value} group={state.result} onBusyChange={setBadgeBusy} commandAction={badgeCommandAction} />}
      {groupOpen && state.phase === "result" && <button type="button" className="btn-secondary min-h-12 px-4" disabled={badgeBusy} onClick={dismiss}>Passa al prossimo codice</button>}
      {!readOnly && !correction && state.result.kind !== "room" && ((state.result.kind === "family" || state.result.kind === "group") ? state.result.persons.some(person => person.checkedInAt) : state.result.checkedInAt) &&
        <button type="button" className="btn-secondary min-h-12 px-4" disabled={badgeBusy} onClick={() => void session.editCurrent()}>Modifica presenze</button>}
    </div>}
  </>;
  return <section className="grid gap-5" aria-labelledby="reception-title">
    <header className="grid gap-1 rounded-xl bg-slate-900 p-3 text-white">
      <p className="text-xs font-semibold uppercase tracking-wide">Incarico attivo · {duty?.duty === "room_assistance" ? "Assistenza in sala" : duty?.duty === "panel_entry" ? "Ingresso panel" : "Accoglienza evento"}</p>
      {duty && duty.duty !== "event_entry" && <p className="text-lg font-semibold">{duty.title}{duty.room ? ` · ${duty.room}` : ""}</p>}
      <h2 id="reception-title" className="text-xl font-semibold">{readOnly ? "Consulta sala e settore" : correction ? "Modifica presenze" : "Registra ingresso"}</h2>
      {state.phase !== "ready" && state.phase !== "result" && state.phase !== "error" && state.phase !== "pending" && <p aria-hidden="true" className="text-sm font-semibold text-amber-200">
        {state.phase === "selection" ? "Codice verificato · completa la conferma nella finestra aperta" : state.message}
      </p>}
      {onChangeDuty && <button type="button" className="min-h-12 justify-self-start underline" disabled={locked || selection} onClick={onChangeDuty}>Cambia incarico</button>}
    </header>
    <div className="surface-card grid gap-5 p-4 sm:p-7">
      <p className="text-sm">{readOnly ? "Inquadra un QR per consultare la prenotazione e indicare sala e settore. Questa consultazione non registra ingressi." : "Inquadra un QR alla volta. Per una persona singola l’ingresso è automatico; per famiglie, gruppi e scuole conferma chi è presente."}</p>
      {duty?.duty === "panel_entry" && <p className="text-sm">È necessaria una prenotazione per questo panel e il passaggio precedente dall’accoglienza dell’evento.</p>}

    <div className="flex flex-wrap gap-2" aria-label="Modalità di lettura">
      <button type="button" className={input === "camera" ? "btn-primary min-h-12 px-4" : "btn-secondary min-h-12 px-4"}
        aria-pressed={input === "camera"} disabled={locked || selection} onClick={() => { setInput("camera"); setValue(""); }}>Inquadra QR code</button>
      <button type="button" className={input === "manual" ? "btn-primary min-h-12 px-4" : "btn-secondary min-h-12 px-4"}
        aria-pressed={input === "manual"} disabled={locked || selection} onClick={() => { setInput("manual"); setValue(""); }}>Inserisci il codice manualmente</button>
    </div>

    {input === "camera" ? <>
      <ReceptionCamera source={cameraSource} paused={locked || selection || groupOpen}
        feedback={state.phase === "pending" ? "Operazione in corso. Attendi l’esito prima della prossima persona…" : completedFeedback && expiredFeedback !== state ? state.message : undefined}
        feedbackTone={state.phase === "pending" ? "progress" : state.phase === "result" ? "success" : state.problem === "conflict" ? "warning" : "error"}
        belowPreview={!operationOpen ? operationContent : null} onCode={code => {
        latch.current.clearAbsence();
        if (session.isLocked() || session.snapshot().phase === "selection" || session.snapshot().result?.kind === "group" || !latch.current.accept(code)) return;
        inspect({ kind: "qr", value: code });
      }} onNoCode={() => {
        if (!session.isLocked() && session.snapshot().phase !== "selection") latch.current.absent();
        else latch.current.clearAbsence();
      }} />

    </> : <form className="grid gap-3" onSubmit={event => { event.preventDefault(); inspect({ kind: value.startsWith("G:") ? "qr" : "code", value }); setValue(""); }}>
      <fieldset disabled={locked || selection} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid min-w-0 gap-1 text-sm">Codice partecipante o QR gruppo
          <input className="field min-h-12 min-w-0" type="text" autoComplete="off" spellCheck={false}
            autoCapitalize="characters" required maxLength={45}
            value={value} onChange={event => setValue(event.target.value)} />
        </label>
        <button className="btn-primary min-h-12 px-4" type="submit" aria-busy={state.phase === "pending"}>{readOnly ? "Consulta codice" : "Leggi codice e registra"}</button>
      </fieldset>
    </form>}

    {operationOpen ? <ReceptionOperationDialog onDismiss={selection ? dismiss : undefined}>
      <h2 id="reception-operation-title" tabIndex={-1} className="text-xl font-semibold outline-none">
        {selection ? correction ? "Modifica presenze" : (input === "camera" ? "QR letto correttamente" : "Codice verificato") : "Operazione da verificare"}
      </h2>
      {selection && <p className="text-sm">{correction ? "Controlla i dati e conferma la modifica. Non è ancora stata salvata." : state.result?.kind === "school" ? "Indica quanti studenti e accompagnatori sono presenti, poi premi Registra ingresso." : "Seleziona le persone presenti, poi premi Registra ingresso."}</p>}
      {operationContent}
    </ReceptionOperationDialog> : input === "manual" ? operationContent : null}
    <details className="border-t border-[var(--peace-border)] pt-4">
      <summary className="cursor-pointer py-3 font-semibold">Ultime 15 letture ({state.recent.length})</summary>
      <p className="mb-3 text-sm">Iscrizioni lette su questo dispositivo nella pagina aperta. La lista si svuota ricaricando. Rileggi il codice per ottenere dati aggiornati.</p>
      {state.recent.length === 0 ? <p className="text-sm">Nessuna lettura recente.</p> : <ul className="grid gap-3">
        {state.recent.map(entry => <li key={entry.key} className="grid gap-2 rounded-xl border border-[var(--peace-border)] p-3">
          <strong className="break-words">{entry.result.kind === "family" ? `${entry.result.persons[0]?.firstName} ${entry.result.persons[0]?.lastName} · ${entry.result.code}` : entry.result.kind === "room" ? entry.result.label : entry.result.kind === "group" ? entry.result.groupName : `${entry.result.schoolName} · ${entry.result.classDescription}`}</strong>
          <span className="text-sm">Letto il {date(entry.readAt)}</span>
          {!readOnly && <button type="button" className="btn-secondary min-h-12 px-4" disabled={locked || selection}
            onClick={() => void session.editRecent(entry.key)}>Modifica presenze</button>}
        </li>)}
      </ul>}
    </details>
    </div>
  </section>;
}

function ReceptionOperationDialog({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    element.querySelector<HTMLElement>("h2")?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={dialog} aria-labelledby="reception-operation-title"
    onCancel={event => { event.preventDefault(); onDismiss?.(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-[var(--peace-border)] bg-white p-5 text-[var(--peace-ink)] shadow-2xl backdrop:bg-slate-950/65 sm:p-6">
    <div className="grid gap-4">{children}</div>
  </dialog>;
}

function PresenceSummary({ result }: { result: VerifiedReception }) {
  const panel = result.panel && <p className="rounded-lg bg-sky-50 p-3 font-semibold">{result.panel.title} · {result.panel.room} · Settore {result.panel.section}</p>;
  if (result.kind === "room") return <div className="grid gap-2 text-sm">{panel}<strong className="break-words">{result.label}</strong></div>;
  if (result.kind === "school") return <div className="grid gap-2 text-sm">
    {panel}
    <strong className="break-words">{result.schoolName} · {result.classDescription}</strong>
    <p>{result.panel ? "Ammessi secondo prenotazione e ingresso evento:" : "Previsti:"} {result.expectedStudents} studenti e {result.expectedCompanions} accompagnatori.</p>
    <p>{result.checkedInAt ? `Ingresso registrato il ${date(result.checkedInAt)}: ${result.students} studenti e ${result.companions} accompagnatori.` : "Ingresso non registrato."}</p>
  </div>;
  return <div className="grid gap-2 text-sm">
    {panel}
    <p>{result.kind === "group" ? `${result.groupName} · ${result.persons.length} persone` : `Codice ${result.code}`}</p>
    {result.persons.map(person => <p key={person.id} className="break-words">
      <strong>{person.firstName} {person.lastName}</strong>{person.kind === "child" ? " · Minore" : ""}
      <span className="block">{person.eventCheckedIn === false ? "Passare prima dall’accoglienza evento. " : ""}{person.checkedInAt ? `Presente dal ${date(person.checkedInAt)}` : "Ingresso non registrato"}</span>
    </p>)}
  </div>;
}

function PresenceSelection({ result, mode, onSubmit, onDismiss }: {
  result: Exclude<VerifiedReception, { kind: "room" }>;
  mode: ReceptionMode;
  onSubmit: (values: Pick<ReceptionCommand, "subjectIds" | "students" | "companions">, confirmed: boolean, cancelSchool?: boolean) => void;
  onDismiss: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => mode === "correct" && (result.kind === "family" || result.kind === "group") ? result.persons.filter(p => p.checkedInAt).map(p => p.id) : []);
  const [students, setStudents] = useState(mode === "correct" && result.kind === "school" ? String(result.students) : "");
  const [companions, setCompanions] = useState(mode === "correct" && result.kind === "school" ? String(result.companions) : "");
  const [cancelSchool, setCancelSchool] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const familyValid = (result.kind !== "family" && result.kind !== "group") || selected.length > 0 || (mode === "correct" && result.persons.some(person => person.checkedInAt));
  const countsValid = result.kind !== "school" || mode === "cancel" || cancelSchool ||
    (students !== "" && companions !== "" && Number.isInteger(Number(students)) && Number.isInteger(Number(companions)) &&
      Number(students) >= 0 && Number(students) <= result.expectedStudents && Number(companions) >= 0 && Number(companions) <= result.expectedCompanions && Number(students) + Number(companions) > 0);
  return <form className="grid gap-4" onSubmit={event => {
    event.preventDefault();
    if (!familyValid || !countsValid || (mode !== "enter" && !confirmed)) return;
    onSubmit((result.kind === "family" || result.kind === "group") ? { subjectIds: selected } : mode === "cancel" ? {} : { students: Number(students), companions: Number(companions) }, confirmed, cancelSchool);
  }}>
    {(result.kind === "family" || result.kind === "group") ? <fieldset className="grid gap-2">
      <legend className="mb-2 font-medium">{mode === "cancel" ? "Seleziona gli ingressi da annullare" : "Seleziona le persone realmente presenti"}</legend>
      {result.kind === "group" && <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary min-h-12 px-4" onClick={()=>{setSelected(result.persons.filter(p=>mode!=="enter" || !p.checkedInAt).map(p=>p.id));setConfirmed(false);}}>Seleziona tutto il gruppo</button><button type="button" className="btn-secondary min-h-12 px-4" onClick={()=>{setSelected([]);setConfirmed(false);}}>Deseleziona tutti</button></div>}
      {result.persons.map(person => <label key={person.id} className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--peace-border)] p-3">
        <input type="checkbox" name="presentSubjects" value={person.id} className="h-6 w-6 shrink-0" checked={selected.includes(person.id)} disabled={(mode === "enter" && Boolean(person.checkedInAt)) || (person.eventCheckedIn === false && !person.checkedInAt)}
          onChange={event => { setSelected(ids => event.target.checked ? [...ids, person.id] : ids.filter(id => id !== person.id)); setConfirmed(false); }} />
        <span className="min-w-0 break-words font-medium">{person.firstName} {person.lastName}{person.kind === "child" ? " · Minore" : ""}{mode === "enter" && person.checkedInAt ? " · Già presente" : ""}{person.eventCheckedIn === false ? " · Prima passare dall’accoglienza evento" : ""}</span>
      </label>)}
      <p className="text-sm">{mode === "correct" ? "L’ingresso delle persone deselezionate verrà annullato." : mode === "enter" ? "Gli ingressi già registrati restano validi anche se deselezionati." : "Si annullano solo gli ingressi selezionati."}</p>
    </fieldset> : mode !== "cancel" && !cancelSchool && <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Studenti presenti<input className="field min-h-12" type="number" inputMode="numeric" name="students" min={0} max={result.expectedStudents} step={1} required value={students} onChange={event => { setStudents(event.target.value); setConfirmed(false); }} /></label>
      <label className="grid gap-1 text-sm">Accompagnatori presenti<input className="field min-h-12" type="number" inputMode="numeric" name="companions" min={0} max={result.expectedCompanions} step={1} required value={companions} onChange={event => { setCompanions(event.target.value); setConfirmed(false); }} /></label>
    </div>}
    {mode === "correct" && result.kind === "school" && result.checkedInAt && <label className="flex min-h-14 items-center gap-3 text-sm">
      <input type="checkbox" className="h-6 w-6 shrink-0" checked={cancelSchool} onChange={event => { setCancelSchool(event.target.checked); setConfirmed(false); }} />Annulla tutto l’ingresso della scuola
    </label>}
    {mode === "correct" && (result.kind === "family" || result.kind === "group") && selected.length === 0 && <p role="status" className="text-sm font-semibold">Salvando annullerai tutti gli ingressi attualmente registrati.</p>}
    {mode !== "enter" && <label className="flex min-h-14 items-center gap-3 text-sm"><input type="checkbox" name="confirmCorrection" className="h-6 w-6 shrink-0" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Confermo {(mode === "cancel" || cancelSchool || ((result.kind === "family" || result.kind === "group") && selected.length === 0)) ? "l’annullamento degli ingressi indicati" : "la correzione delle presenze indicate"}.</label>}
    <div className={`${result.kind === "group" ? "" : "sticky bottom-0"} flex flex-wrap gap-2 border-t border-[var(--peace-border)] bg-white py-3`}>
      <button className="btn-primary min-h-12 px-4" type="submit" disabled={!familyValid || !countsValid || (mode !== "enter" && !confirmed)}>{labels[mode]}</button>
      <button className="btn-secondary min-h-12 px-4" type="button" onClick={onDismiss}>Chiudi senza modifiche</button>
    </div>
  </form>;
}
