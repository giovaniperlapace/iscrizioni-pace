"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { receptionEntryCopy } from "@/lib/reception/entry-copy";
import { GroupCeremonyPlaces } from "./group-ceremony-places";
import { ceremonySeatText } from "@/lib/ceremonies/seat-projection";
import type { ReceptionCommand } from "@/lib/reception/contracts";
import type { ReceptionMode, VerifiedReception } from "@/lib/reception/station";
const labels = { enter: "Registra ingresso", correct: "Salva presenze", cancel: "Annulla ingresso" };
const date = (value: string) => new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(value));

export function ReceptionOperationDialog({ children, onDismiss, open = true, labelledBy = "reception-operation-title", showCloseButton = true }: { children: ReactNode; onDismiss?: () => void; open?: boolean; labelledBy?: string; showCloseButton?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    element.querySelector<HTMLElement>("h2")?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { element.close(); document.body.style.overflow = previous; if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, [open]);
  return <dialog ref={dialog} aria-labelledby={labelledBy}
    onCancel={event => { event.preventDefault(); onDismiss?.(); }}
    className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-[var(--peace-border)] bg-white p-5 text-[var(--peace-ink)] shadow-2xl backdrop:bg-slate-950/65 sm:p-6">
    {onDismiss && showCloseButton && <button type="button" className="btn-secondary mb-3 min-h-11 px-3" onClick={onDismiss} aria-label="Chiudi la finestra">Chiudi</button>}
    <div className="grid gap-4">{children}</div>
  </dialog>;
}

export function PresenceSummary({ result }: { result: VerifiedReception }) {
  const panel = result.panel && <p className="rounded-lg bg-sky-50 p-3 font-semibold">{result.panel.title} · {result.panel.room} · Settore {result.panel.section}</p>;
  if (result.kind === "room") return <div className="grid gap-2 text-sm">{panel}<strong className="break-words">{result.label}</strong></div>;
  if (result.kind === "school") return <div className="grid gap-2 text-sm">
    {panel}
    <strong className="break-words">{result.schoolName} · {result.classDescription}</strong>
    <p>{result.panel ? "Previsti dalla prenotazione:" : "Previsti:"} {result.expectedStudents} studenti e {result.expectedCompanions} accompagnatori.</p>
    <p>{result.checkedInAt ? `Ingresso registrato il ${date(result.checkedInAt)}: ${result.students} studenti e ${result.companions} accompagnatori.` : "Ingresso non registrato."}</p>
  </div>;
  return <div className="grid gap-2 text-sm">
    {panel}
    {result.kind === "group" && <GroupCeremonyPlaces summary={result.groupCeremonies}/>}
    <p>{result.kind === "group" ? `${result.groupName} · ${result.persons.length} persone` : `Codice ${result.code}`}</p>
    {result.persons.map(person => <p key={person.id} className="break-words">
      <strong>{person.firstName} {person.lastName}</strong>{person.kind === "child" ? " · Minore" : ""}
      {person.ceremonies?.map(s=><span className="block text-sm" key={s.kind}>{ceremonySeatText(s)} · Assegnazione, non ingresso</span>)}
      <span className="block">{person.eventCheckedIn === false ? "Passare prima dall’accoglienza evento. " : ""}{person.checkedInAt ? `Presente dal ${date(person.checkedInAt)}` : "Ingresso non registrato"}</span>
    </p>)}
  </div>;
}

export function PresenceRemovalDialog({ result, subjectIds, onConfirm, onDismiss, entryTerminology = false }: {
  entryTerminology?: boolean;
  result: Extract<VerifiedReception, { kind: "family" | "group" }>;
  subjectIds: string[];
  onConfirm: (ids: string[]) => void;
  onDismiss: () => void;
}) {
  const copy = (value: string) => receptionEntryCopy(value, entryTerminology);
  const selected = result.persons.filter(person => subjectIds.includes(person.id));
  const presentIds = selected.filter(person => person.checkedInAt).map(person => person.id);
  return <ReceptionOperationDialog onDismiss={onDismiss} showCloseButton={false}>
    <h2 id="reception-operation-title" tabIndex={-1} className="text-xl font-semibold outline-none">{copy("Rimuovi presenza")}</h2>
    <p>{copy("Confermi la rimozione della presenza per queste persone?")}</p>
    <ul className="grid gap-2">{selected.map(person => <li key={person.id}><strong>{person.firstName} {person.lastName}</strong>{person.kind === "child" ? " · Minore" : ""}{!person.checkedInAt && copy(" · Presenza già rimossa")}</li>)}</ul>
    <button className="btn-primary min-h-12 px-4" disabled={!presentIds.length} onClick={() => onConfirm(presentIds)}>Conferma rimozione</button>
    <button className="btn-secondary min-h-12 px-4" onClick={onDismiss}>Annulla</button>
  </ReceptionOperationDialog>;
}

export function PresenceSelection({ result, mode, onSubmit, onDismiss, entryTerminology = false }: {
  entryTerminology?: boolean;
  result: Exclude<VerifiedReception, { kind: "room" }>;
  mode: ReceptionMode;
  onSubmit: (values: Pick<ReceptionCommand, "subjectIds" | "students" | "companions">, confirmed: boolean, cancelSchool?: boolean) => void;
  onDismiss: () => void;
}) {
  const copy = (value: string) => receptionEntryCopy(value, entryTerminology);
  const [selected, setSelected] = useState<string[]>(() => mode === "correct" && (result.kind === "family" || result.kind === "group") ? result.persons.filter(p => p.checkedInAt).map(p => p.id) : []);
  const [students, setStudents] = useState((mode === "correct" || result.kind === "school" && !!result.checkedInAt) && result.kind === "school" ? String(result.students) : "");
  const [companions, setCompanions] = useState((mode === "correct" || result.kind === "school" && !!result.checkedInAt) && result.kind === "school" ? String(result.companions) : "");
  const [cancelSchool, setCancelSchool] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const familyValid = (result.kind !== "family" && result.kind !== "group") || selected.length > 0 || (mode === "correct" && result.persons.some(person => person.checkedInAt));
  const countsValid = result.kind !== "school" || mode === "cancel" || cancelSchool ||
    (students !== "" && companions !== "" && Number.isInteger(Number(students)) && Number.isInteger(Number(companions)) &&
      Number(students) >= 0 && Number(students) <= 1000 && Number(companions) >= 0 && Number(companions) <= 100 && Number(students) + Number(companions) > 0);
  return <form className="grid gap-4" onSubmit={event => {
    event.preventDefault();
    if (!familyValid || !countsValid || (mode !== "enter" && !confirmed)) return;
    onSubmit((result.kind === "family" || result.kind === "group") ? { subjectIds: selected } : mode === "cancel" ? {} : { students: Number(students), companions: Number(companions) }, confirmed, cancelSchool);
  }}>
    {result.kind === "school" && result.panel && mode === "enter" && result.eventCheckedIn === false && <p className="rounded-lg bg-sky-50 p-3 text-sm">Confermi con questi numeri sia la partecipazione all’evento sia l’ingresso al Forum. Gli assenti non vengono conteggiati. Le scuole restano separate dagli iscritti.</p>}
    {(result.kind === "family" || result.kind === "group") ? <fieldset className="grid gap-2">
      <legend className="mb-2 font-medium">{mode === "cancel" ? "Seleziona gli ingressi da annullare" : copy("Seleziona le persone realmente presenti")}</legend>
      {result.kind === "group" && <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary min-h-12 px-4" onClick={()=>{setSelected(result.persons.filter(p=>mode!=="enter" || !p.checkedInAt).map(p=>p.id));setConfirmed(false);}}>Seleziona tutto il gruppo</button><button type="button" className="btn-secondary min-h-12 px-4" onClick={()=>{setSelected([]);setConfirmed(false);}}>Deseleziona tutti</button></div>}
      {result.persons.map(person => <label key={person.id} className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--peace-border)] p-3">
        <input type="checkbox" name="presentSubjects" value={person.id} className="h-6 w-6 shrink-0" checked={selected.includes(person.id)} disabled={(mode === "enter" && Boolean(person.checkedInAt)) || (person.eventCheckedIn === false && !person.checkedInAt)}
          onChange={event => { setSelected(ids => event.target.checked ? [...ids, person.id] : ids.filter(id => id !== person.id)); setConfirmed(false); }} />
        <span className="min-w-0 break-words font-medium">{person.firstName} {person.lastName}{person.kind === "child" ? " · Minore" : ""}{mode === "enter" && person.checkedInAt ? copy(" · Già presente") : ""}{person.eventCheckedIn === false ? " · Prima passare dall’accoglienza evento" : ""}</span>
      </label>)}
      <p className="text-sm">{mode === "correct" ? "L’ingresso delle persone deselezionate verrà annullato." : mode === "enter" ? "Gli ingressi già registrati restano validi anche se deselezionati." : "Si annullano solo gli ingressi selezionati."}</p>
    </fieldset> : mode !== "cancel" && !cancelSchool && <div className="grid gap-3 sm:grid-cols-2">
      <p className="text-sm sm:col-span-2">{result.panel ? "Prenotati per questo Forum" : "Quantità previste"}: {result.expectedStudents} studenti e {result.expectedCompanions} accompagnatori. Indica le persone effettivamente arrivate; se una categoria è assente, inserisci 0.</p>
      <label className="grid gap-1 text-sm">{copy("Studenti presenti")}<input className="field min-h-12" type="number" inputMode="numeric" name="students" min={0} max={1000} step={1} required value={students} onChange={event => { setStudents(event.target.value); setConfirmed(false); }} /></label>
      <label className="grid gap-1 text-sm">{copy("Accompagnatori presenti")}<input className="field min-h-12" type="number" inputMode="numeric" name="companions" min={0} max={100} step={1} required value={companions} onChange={event => { setCompanions(event.target.value); setConfirmed(false); }} /></label>
    </div>}
    {result.kind === "school" && mode !== "cancel" && !cancelSchool && countsValid && (Number(students) !== result.expectedStudents || Number(companions) !== result.expectedCompanions) && <p role="status" className="rounded-lg bg-sky-50 p-3 text-sm">Le quantità sono diverse da quelle previste. Confermando registri {Number(students)} studenti e {Number(companions)} accompagnatori effettivamente arrivati.{result.panel ? " La disponibilità della sala viene verificata alla conferma." : ""}</p>}
    {!countsValid && result.kind === "school" && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{students === "" || companions === "" ? "Compila entrambe le quantità, anche quando una è 0." : `Inserisci quantità intere da 0 a 1000 studenti e da 0 a 100 accompagnatori, con almeno una persona in totale.`}</p>}
    {mode === "correct" && result.kind === "school" && result.checkedInAt && <label className="flex min-h-14 items-center gap-3 text-sm">
      <input type="checkbox" className="h-6 w-6 shrink-0" checked={cancelSchool} onChange={event => { setCancelSchool(event.target.checked); setConfirmed(false); }} />Annulla tutto l’ingresso della scuola
    </label>}
    {mode === "correct" && (result.kind === "family" || result.kind === "group") && selected.length === 0 && result.persons.some(person => person.checkedInAt) && <p role="status" className="text-sm font-semibold">Salvando annullerai tutti gli ingressi attualmente registrati.</p>}
    {mode !== "enter" && <label className="flex min-h-14 items-center gap-3 text-sm"><input type="checkbox" name="confirmCorrection" className="h-6 w-6 shrink-0" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Confermo {(mode === "cancel" || cancelSchool || ((result.kind === "family" || result.kind === "group") && selected.length === 0)) ? "l’annullamento degli ingressi indicati" : copy("la correzione delle presenze indicate")}.</label>}
    <div className={`${result.kind === "group" ? "" : "sticky bottom-0"} flex flex-wrap gap-2 border-t border-[var(--peace-border)] bg-white py-3`}>
      <button className="btn-primary min-h-12 px-4" type="submit" disabled={!familyValid || (mode !== "enter" && !confirmed)}>{result.kind === "school" && result.panel && mode === "enter" && result.eventCheckedIn === false ? "Registra evento e ingresso al Forum" : copy(labels[mode])}</button>
      <button className="btn-secondary min-h-12 px-4" type="button" onClick={onDismiss}>Chiudi senza modifiche</button>
    </div>
  </form>;
}
