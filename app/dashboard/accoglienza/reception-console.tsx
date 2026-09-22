"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import PendingLink from "@/components/pending-link";
import { ReceptionCamera } from "./reception-camera";
import type { CameraSource } from "@/lib/reception/camera";
import type { ReceptionCommand, ReceptionLookup, ReceptionResult } from "@/lib/reception/contracts";
import { ReceptionStationSession, ScanLatch, type ReceptionMode, type VerifiedReception } from "@/lib/reception/station";

const labels = { enter: "Registra ingresso", correct: "Correggi presenze", cancel: "Annulla ingresso" };
const date = (value: string) => new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(value));

export function ReceptionConsole({ commandAction, cameraSource }: {
  commandAction: (command: ReceptionCommand) => Promise<ReceptionResult>;
  cameraSource?: CameraSource;
}) {
  const [session] = useState(() => new ReceptionStationSession(commandAction, () => crypto.randomUUID()));
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [input, setInput] = useState<"camera" | "manual">("camera");
  const [kind, setKind] = useState<ReceptionLookup["kind"]>("code");
  const [value, setValue] = useState("");
  const latch = useRef(new ScanLatch());
  const locked = session.isLocked();
  const selection = state.phase === "selection";
  const correction = state.mode !== "enter";
  const [repeat, setRepeat] = useState(false);

  useEffect(() => { session.setActive(true); return () => session.setActive(false); }, [session]);

  useEffect(() => {
    if (state.phase !== "pending" && state.phase !== "uncertain") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.phase]);

  function changeMode(mode: ReceptionMode) {
    session.setMode(mode); setValue(""); setRepeat(false);
  }
  return <section className="surface-card grid gap-5 p-4 sm:p-7" aria-labelledby="reception-title">
    <header className="sticky top-[4.75rem] z-30 grid gap-1 rounded-xl bg-slate-900 p-3 text-white">
      <p className="text-xs font-semibold uppercase tracking-wide">Incarico attivo · Accoglienza evento</p>
      <h2 id="reception-title" className="text-xl font-semibold">{correction ? labels[state.mode] : "Registra ingresso evento"}</h2>
      {state.phase !== "ready" && <p aria-hidden="true" className={`text-sm font-semibold ${state.phase === "result" ? "text-green-200" : "text-amber-200"}`}>
        {state.phase === "pending" ? "Operazione in corso…" : state.phase === "selection" ? "Conferma le presenze qui sotto ↓" : state.message}
      </p>}
    </header>
      <p className="text-sm">{correction ? "Verifica un codice e conferma esplicitamente la modifica." : "Inquadra un QR alla volta. Per una persona singola l’ingresso è automatico; per famiglie e scuole conferma chi è presente."}</p>

    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-secondary min-h-12 px-4" disabled={locked || selection}
        onClick={() => changeMode(correction ? "enter" : "correct")}>{correction ? "Torna agli ingressi" : "Correzioni e annullamenti"}</button>
      {correction && <label className="grid gap-1 text-sm">Operazione da eseguire
        <select name="operation" className="field min-h-12" value={state.mode} disabled={locked || selection}
          onChange={event => changeMode(event.target.value as ReceptionMode)}>
          <option value="correct">Correggi presenze</option><option value="cancel">Annulla ingresso</option>
        </select>
      </label>}
    </div>

    {!correction && <div className="flex gap-2" aria-label="Modalità di lettura">
      <button type="button" className={input === "camera" ? "btn-primary min-h-12 px-4" : "btn-secondary min-h-12 px-4"}
        aria-pressed={input === "camera"} disabled={locked || selection} onClick={() => { setInput("camera"); setValue(""); }}>Fotocamera</button>
      <button type="button" className={input === "manual" ? "btn-primary min-h-12 px-4" : "btn-secondary min-h-12 px-4"}
        aria-pressed={input === "manual"} disabled={locked || selection} onClick={() => { setInput("manual"); setValue(""); }}>Codice manuale</button>
    </div>}

    {!correction && input === "camera" ? <>
      <ReceptionCamera source={cameraSource} paused={!session.canScan()} onCode={code => {
        if (!session.canScan() || !latch.current.accept(code)) return;
        setRepeat(false); void session.inspect({ kind: "qr", value: code });
      }} />
      <p className="text-sm text-[var(--peace-muted)]">Dopo l’esito puoi inquadrare il prossimo QR. Lo stesso codice non viene ripetuto automaticamente.</p>
      <button type="button" className="btn-secondary min-h-12 px-4 justify-self-start" disabled={!session.canScan()}
        onClick={() => setRepeat(true)}>Leggi di nuovo lo stesso QR</button>
      {repeat && <div className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
        <p>È un nuovo arrivo con lo stesso QR? Per correggere o annullare un ingresso usa il percorso Correzioni.</p>
        <button type="button" className="btn-secondary mt-2 min-h-12 px-4" disabled={!session.canScan()} onClick={() => { if (!session.canScan()) return; latch.current.reset(); session.next(); setRepeat(false); }}>Conferma nuova lettura</button>
      </div>}
    </> : <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void session.inspect({ kind, value }); setValue(""); }}>
      <fieldset disabled={locked || selection} className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-sm">Tipo di codice
          <select name="lookupKind" className="field min-h-12" value={kind} onChange={event => { setKind(event.target.value as ReceptionLookup["kind"]); setValue(""); }}>
            <option value="code">Codice partecipante</option><option value="qr">Contenuto del QR</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-sm">{kind === "code" ? "Codice partecipante" : "Contenuto del QR"}
          <input className="field min-h-12 min-w-0" type={kind === "qr" ? "password" : "text"} autoComplete="off" spellCheck={false}
            autoCapitalize={kind === "code" ? "characters" : "none"} required maxLength={kind === "code" ? 4 : 43}
            value={value} onChange={event => setValue(event.target.value)} />
        </label>
        <button className="btn-primary min-h-12 px-4" type="submit" aria-busy={state.phase === "pending"}>{correction ? "Verifica codice" : "Leggi codice e registra"}</button>
      </fieldset>
    </form>}

    {state.phase === "pending" && <p role="status" className="rounded-xl bg-slate-100 p-4 font-semibold" aria-live="polite">Operazione in corso. Attendi l’esito prima della prossima persona…</p>}
    {state.message && <div role={state.phase === "result" ? "status" : "alert"} className={`rounded-xl border p-4 ${state.phase === "result" ? "border-green-400 bg-green-50 text-green-950" : "border-amber-400 bg-amber-50 text-amber-950"}`}>
      <p className="font-semibold">{state.message}</p>
      {state.phase === "uncertain" && <button type="button" className="btn-primary mt-3 min-h-12 px-4" onClick={() => void session.retry()}>Riprova la stessa operazione</button>}
      {state.phase === "blocked" && <PendingLink className="mt-3 block underline" href="/">Torna all’accesso</PendingLink>}
    </div>}

    {state.result && <div className="grid gap-3 border-t border-[var(--peace-border)] pt-4">
      <h3 className="text-lg font-semibold">{selection ? "Conferma le presenze" : "Ultima operazione"}</h3>
      <PresenceSummary result={state.result} />
      {selection && <PresenceSelection key={`${state.result.kind}-${state.result.revision}-${state.mode}`} result={state.result} mode={state.mode}
        onSubmit={(values, confirmed) => void session.submit(values, confirmed)} onDismiss={() => session.next()} />}
    </div>}
  </section>;
}

function PresenceSummary({ result }: { result: VerifiedReception }) {
  if (result.kind === "school") return <div className="grid gap-2 text-sm">
    <strong className="break-words">{result.schoolName} · {result.classDescription}</strong>
    <p>Previsti: {result.expectedStudents} studenti e {result.expectedCompanions} accompagnatori.</p>
    <p>{result.checkedInAt ? `Ingresso registrato il ${date(result.checkedInAt)}: ${result.students} studenti e ${result.companions} accompagnatori.` : "Ingresso non registrato."}</p>
  </div>;
  return <div className="grid gap-2 text-sm">
    <p>Codice {result.code}</p>
    {result.persons.map(person => <p key={person.id} className="break-words">
      <strong>{person.firstName} {person.lastName}</strong>{person.kind === "child" ? " · Minore" : ""}
      <span className="block">{person.checkedInAt ? `Presente dal ${date(person.checkedInAt)}` : "Ingresso non registrato"}</span>
    </p>)}
  </div>;
}

function PresenceSelection({ result, mode, onSubmit, onDismiss }: {
  result: VerifiedReception;
  mode: ReceptionMode;
  onSubmit: (values: Pick<ReceptionCommand, "subjectIds" | "students" | "companions">, confirmed: boolean) => void;
  onDismiss: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => mode === "correct" && result.kind === "family" ? result.persons.filter(p => p.checkedInAt).map(p => p.id) : []);
  const [students, setStudents] = useState(mode === "correct" && result.kind === "school" ? String(result.students) : "");
  const [companions, setCompanions] = useState(mode === "correct" && result.kind === "school" ? String(result.companions) : "");
  const [confirmed, setConfirmed] = useState(false);
  const familyValid = result.kind !== "family" || selected.length > 0;
  const countsValid = result.kind !== "school" || mode === "cancel" ||
    (students !== "" && companions !== "" && Number.isInteger(Number(students)) && Number.isInteger(Number(companions)) &&
      Number(students) >= 0 && Number(students) <= result.expectedStudents && Number(companions) >= 0 && Number(companions) <= result.expectedCompanions && Number(students) + Number(companions) > 0);
  return <form className="grid gap-4" onSubmit={event => {
    event.preventDefault();
    if (!familyValid || !countsValid || (mode !== "enter" && !confirmed)) return;
    onSubmit(result.kind === "family" ? { subjectIds: selected } : mode === "cancel" ? {} : { students: Number(students), companions: Number(companions) }, confirmed);
  }}>
    {result.kind === "family" ? <fieldset className="grid gap-2">
      <legend className="mb-2 font-medium">{mode === "cancel" ? "Seleziona gli ingressi da annullare" : "Seleziona le persone realmente presenti"}</legend>
      {result.persons.map(person => <label key={person.id} className="flex min-h-14 items-center gap-3 rounded-xl border border-[var(--peace-border)] p-3">
        <input type="checkbox" name="presentSubjects" value={person.id} className="h-6 w-6 shrink-0" checked={selected.includes(person.id)}
          onChange={event => { setSelected(ids => event.target.checked ? [...ids, person.id] : ids.filter(id => id !== person.id)); setConfirmed(false); }} />
        <span className="min-w-0 break-words font-medium">{person.firstName} {person.lastName}</span>
      </label>)}
      <p className="text-sm">{mode === "correct" ? "Le persone deselezionate risulteranno assenti." : mode === "enter" ? "Gli ingressi già registrati restano validi anche se deselezionati." : "Si annullano solo gli ingressi selezionati."}</p>
    </fieldset> : mode !== "cancel" && <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Studenti presenti<input className="field min-h-12" type="number" inputMode="numeric" name="students" min={0} max={result.expectedStudents} step={1} required value={students} onChange={event => { setStudents(event.target.value); setConfirmed(false); }} /></label>
      <label className="grid gap-1 text-sm">Accompagnatori presenti<input className="field min-h-12" type="number" inputMode="numeric" name="companions" min={0} max={result.expectedCompanions} step={1} required value={companions} onChange={event => { setCompanions(event.target.value); setConfirmed(false); }} /></label>
    </div>}
    {mode !== "enter" && <label className="flex min-h-14 items-center gap-3 text-sm"><input type="checkbox" name="confirmCorrection" className="h-6 w-6 shrink-0" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Confermo {mode === "cancel" ? "l’annullamento degli ingressi indicati" : "la correzione delle presenze indicate"}.</label>}
    <div className="flex flex-wrap gap-2">
      <button className="btn-primary min-h-12 px-4" type="submit" disabled={!familyValid || !countsValid || (mode !== "enter" && !confirmed)}>{labels[mode]}</button>
      <button className="btn-secondary min-h-12 px-4" type="button" onClick={onDismiss}>Chiudi senza modifiche</button>
    </div>
  </form>;
}
