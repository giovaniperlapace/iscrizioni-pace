"use client";

import { ChevronDown, History, Keyboard, ScanLine } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
import type { CameraSource } from "@/lib/reception/camera";
import type { ReceptionDuty } from "@/lib/reception/duties.server";
import type { LabelCommand, LabelResult } from "@/lib/reception/qr-labels";
import { ReceptionStationSession, ScanLatch, type VerifiedReception } from "@/lib/reception/station";
import { ReceptionParty } from "./reception-party";
import { ReceptionCamera } from "./reception-camera";
import { ReceptionUsbScanner } from "./reception-usb-scanner";
import { PresenceSelection, PresenceRemovalDialog, ReceptionOperationDialog } from "./reception-presence-controls";
import PendingLink from "@/components/pending-link";

type Props = {
  commandAction: (command: ReceptionCommand) => Promise<ReceptionResult>;
  cameraSource?: CameraSource;
  deviceMode?: "computer" | "phone";
  onChangeMode?: () => void;
  onChangeDuty?: () => void;
  duty?: ReceptionDuty;
  labelPrinting?: boolean;
  onLookup?: (lookup: ReceptionCommand["lookup"] | null) => void;
  onBusy?: (busy: boolean) => void;
  labelCommandAction?: (command: LabelCommand) => Promise<LabelResult>;
};

export function EventReceptionConsole(props: Props) {
  const { commandAction, deviceMode = "computer", cameraSource, onChangeMode, onChangeDuty, onBusy } = props;
  const [session] = useState(() => new ReceptionStationSession(commandAction, () => crypto.randomUUID(), 20000, props.duty && props.duty.duty !== "event_entry" ? {duty: props.duty.duty, panelId: props.duty.panelId} : { duty: "event_entry" }, true));
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [entry, setEntry] = useState<VerifiedReception | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [removalIds, setRemovalIds] = useState<string[]>([]);
  const [manual, setManual] = useState(deviceMode === "computer" && props.duty?.duty !== "event_entry" && !!props.duty);
  const [code, setCode] = useState("");
  const latch = useRef(new ScanLatch());
  const heading = useRef<HTMLHeadingElement>(null);
  const locked = busy || session.isLocked();
  const cameraVisible = deviceMode === "phone" && !manual;
  const result = state.phase === "blocked" ? null : state.result ?? entry;
  useEffect(() => { onBusy?.(locked || state.phase === "selection"); }, [locked, state.phase, onBusy]);
  const correction = state.mode !== "enter";
  const multiple = result && (result.kind === "group" || result.kind === "family" && result.persons.length > 1);
  const problem = ["error", "uncertain", "blocked"].includes(state.phase);
  const correctionOpen = correction && state.phase === "selection" && state.result && state.result.kind !== "room";
  const scanHint = deviceMode === "computer" && !manual && <p className="text-sm text-slate-600">{locked || correctionOpen || state.phase === "selection" ? "Lettura sospesa durante l’operazione." : "Scansiona un nuovo QR per aprire la scheda successiva."}</p>;

  useEffect(() => {
    session.setActive(true);
    const unsubscribe = session.subscribe(() => {
      const verified = session.snapshot().result;
      if (verified) setEntry(verified);
    });
    return () => { unsubscribe(); session.setActive(false); };
  }, [session]);
  useEffect(() => {
    if (!locked) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [locked]);
  useEffect(() => { if (entry && !cameraVisible) heading.current?.focus(); }, [entry, cameraVisible]);

  function changeBusy(value: boolean) { busyRef.current = value; setBusy(value); }
  async function inspect(lookup: ReceptionCommand["lookup"], replace = false) {
    if (busyRef.current || session.isLocked() || session.snapshot().phase === "selection" || session.snapshot().mode !== "enter") return;
    if (!replace && (!session.canScan() || entry)) return;
    if (session.snapshot().lookup?.value !== lookup.value) setEntry(null);
    if (replace) await session.inspectNext(lookup);
    else await session.inspect(lookup);
    const found = session.snapshot().result;
    if (found) setEntry(found);
    props.onLookup?.(lookup);
    return found;
  }
  function next() {
    if (busyRef.current || session.isLocked()) return;
    session.setMode("enter"); session.next(); setEntry(null); props.onLookup?.(null); latch.current = new ScanLatch();
  }
  async function retry() {
    await session.retry();
    const found = session.snapshot().result;
    if (found) setEntry(found);
  }
  const feedback = <>
    {state.phase === "pending" && <p role="status" className="font-semibold">{entry ? "Operazione in corso…" : "Lettura in corso…"}</p>}
    {state.phase === "result" && state.result?.outcome !== "verified" && multiple && <p role="status" className="rounded-xl bg-green-100 p-3 font-semibold text-green-900">✓ {state.message === "Ingresso registrato." ? "Partecipazione confermata." : state.message}</p>}
    {problem && <div role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-950">
      <p>{state.message}</p>
      {state.phase === "uncertain" && <button className="btn-primary mt-3 min-h-12 px-4" onClick={() => void retry()}>Riprova la stessa operazione</button>}
      {state.phase === "blocked" && <PendingLink href="/" className="mt-3 block underline">Torna all’accesso</PendingLink>}
      {state.phase === "error" && entry && <button className="btn-secondary mt-3 min-h-12 px-4" onClick={next}>Rileggi il codice</button>}
    </div>}
  </>;
  const party = result && (result.kind === "family" || result.kind === "group") ? <ReceptionParty
    key={result.kind === "group" ? result.groupId : result.code} result={result} session={session}
    printing={deviceMode === "computer" && !!props.labelPrinting} labelCommandAction={props.labelCommandAction}
    compact={cameraVisible} disabled={locked || problem || correction} onBusyChange={changeBusy} feedback={feedback}
    onRemove={ids => { setRemovalIds(ids); void session.removeCurrent(); }}
  /> : null;

  const resultCard = result && <div className={`surface-card grid gap-3 ${cameraVisible ? "p-3" : "p-5 sm:p-7"}`}>
      <h3 ref={heading} tabIndex={-1} className={`break-words font-bold outline-none ${cameraVisible ? "text-lg" : "text-2xl"}`}>{result.kind === "group" ? result.groupName : result.kind === "family" ? `${result.persons[0]?.firstName} ${result.persons[0]?.lastName}` : result.kind === "school" ? `${result.schoolName} · ${result.classDescription}` : result.label}</h3>
      {(props.duty?.duty === "panel_entry" || props.duty?.duty === "ceremony_entry") && (result.kind !== "family" || result.persons.every(person => person.eligible !== false)) && state.phase === "result" && state.result?.outcome === "verified" && <p role="status" className="rounded-xl bg-green-100 p-3 font-semibold text-green-900">✓ {props.duty.duty === "panel_entry" ? "Iscrizione al Forum verificata." : "Biglietto per la cerimonia verificato."}</p>}
      {!cameraVisible && result.kind === "family" && <p className="text-sm text-slate-600">{result.code}</p>}
      {party ?? <>
        {feedback}
        {result.kind === "school" && <>
          <p>{result.checkedInAt ? `Presenti: ${result.students} studenti e ${result.companions} accompagnatori` : "Ingresso non registrato"}</p>
          <button className="btn-primary min-h-12 px-4" disabled={locked || problem} onClick={() => result.checkedInAt ? void session.editCurrent() : session.selectPresence()}>{result.checkedInAt ? "Modifica presenze" : "Registra presenze"}</button>
        </>}
      </>}
      <button className="btn-secondary min-h-12 px-4" disabled={locked || state.phase === "selection"} onClick={next}>{deviceMode === "computer" ? "Chiudi scheda" : "Scansiona un altro QR"}</button>
    </div>;

  return <section className="mx-auto grid w-full max-w-3xl gap-4" aria-labelledby="reception-title">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="reception-title" className="text-xl font-semibold">{props.duty?.title ?? "Accoglienza evento"}</h2>
      <div className="flex gap-3 text-sm">
        {onChangeMode && <button className="min-h-11 underline" disabled={locked || state.phase === "selection" || !!correctionOpen} onClick={onChangeMode}>Cambia modalità</button>}
        {onChangeDuty && <button className="min-h-11 underline" disabled={locked || state.phase === "selection" || !!correctionOpen} onClick={onChangeDuty}>Cambia incarico</button>}
      </div>
    </header>
    <div hidden={!cameraVisible && (!!result || problem && state.phase !== "error")}>
      <div className="surface-card grid gap-4 p-4">
        {!manual ? deviceMode === "computer" ? <ReceptionUsbScanner paused={locked || state.phase === "selection" || correction} onCode={value => void inspect({ kind: "qr", value }, true)} /> :
          <ReceptionCamera source={cameraSource} overlay={resultCard || feedback} paused={locked || !!entry} onCode={value => {
            if (!entry && session.canScan() && latch.current.accept(value)) void inspect({ kind: "qr", value });
          }} onNoCode={() => { if (!entry && session.canScan()) latch.current.absent(); }} /> :
          <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void inspect({ kind: code.startsWith("G:") || code.length === 43 ? "qr" : "code", value: code }); setCode(""); }}>
            <label className="grid gap-1">{props.duty?.duty === "event_entry" || !props.duty ? "Codice partecipante o QR gruppo" : "Codice partecipante"}<input className="field min-h-12" disabled={locked || !!entry} value={code} onChange={event => setCode(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={45} /></label>
            <button className="btn-primary min-h-12" disabled={locked || !!entry}>Leggi codice</button>
          </form>}
        <button type="button" className="btn-secondary inline-flex min-h-11 items-center justify-self-start gap-2 px-4 text-left text-sm" disabled={locked || !!entry} onClick={() => setManual(!manual)}>
          {manual ? <ScanLine size={18} aria-hidden="true" className="shrink-0" /> : <Keyboard size={18} aria-hidden="true" className="shrink-0" />}
          <span>{manual ? deviceMode === "computer" ? "Scanner USB" : "Inquadra QR code" : "Inserisci il codice manualmente"}</span>
        </button>
      </div>
    </div>
    {!cameraVisible && !result && feedback}
    {!cameraVisible && resultCard}
    {result && scanHint}
    {state.phase === "selection" && state.result && (state.result.kind === "family" || state.result.kind === "group") && state.mode === "cancel" && <PresenceRemovalDialog
      result={state.result} subjectIds={removalIds}
      onDismiss={() => session.closeSelection()}
      onConfirm={async ids => {
        await session.submit({ subjectIds: ids }, true);
      }} />}
    {state.phase === "selection" && state.result?.kind === "school" && <ReceptionOperationDialog onDismiss={() => session.closeSelection()}>
      <h2 id="reception-operation-title" tabIndex={-1} className="text-xl font-bold outline-none">{correction ? "Modifica presenze" : "Presenze della scuola"}</h2>
      <PresenceSelection key={`${state.result.revision}-${state.mode}`} result={state.result} mode={state.mode} onSubmit={(values, confirmed, cancelSchool) => void session.submit(values, confirmed, cancelSchool)} onDismiss={() => session.closeSelection()} />
    </ReceptionOperationDialog>}
    <details open className="surface-card group text-sm">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-xl p-4 font-semibold transition hover:bg-[var(--peace-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--peace-blue-800)] [&::-webkit-details-marker]:hidden">
        <History size={20} aria-hidden="true" className="shrink-0 text-[var(--peace-blue-800)]" />
        <span className="flex-1">Ultime letture ({state.recent.length})</span>
        <ChevronDown size={18} aria-hidden="true" className="shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      {state.recent.length === 0 ? <p className="border-t border-[var(--peace-border)] p-4 text-[var(--peace-muted)]">Nessuna lettura recente.</p> : <ul className="divide-y divide-[var(--peace-border)] border-t border-[var(--peace-border)] px-4">{state.recent.map(item => <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <span className="min-w-0 break-words font-medium">{item.result.kind === "family" ? `${item.result.persons[0]?.firstName} ${item.result.persons[0]?.lastName} · ${item.result.code}` : item.result.kind === "group" ? item.result.groupName : item.result.kind === "school" ? item.result.schoolName : item.result.label}</span>
        <button type="button" className="btn-secondary min-h-11 shrink-0 px-4 text-sm" disabled={locked || state.phase === "selection" || correction} onClick={() => void inspect(item.lookup, true)}>Apri Scheda</button>
      </li>)}</ul>}
    </details>
  </section>;
}
