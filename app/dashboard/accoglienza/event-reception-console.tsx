"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
import type { CameraSource } from "@/lib/reception/camera";
import type { ReceptionDuty } from "@/lib/reception/duties.server";
import type { LabelCommand, LabelResult } from "@/lib/reception/qr-labels";
import type { BadgeCommand, BadgeResult } from "@/lib/reception/group-badges";
import { ReceptionStationSession, ScanLatch, type VerifiedReception } from "@/lib/reception/station";
import { ReceptionParty } from "./reception-party";
import { ReceptionCamera } from "./reception-camera";
import { ReceptionUsbScanner } from "./reception-usb-scanner";
import { PresenceSelection, ReceptionOperationDialog } from "./reception-presence-controls";
import { GroupBadgePanel } from "./group-badge-panel";
import PendingLink from "@/components/pending-link";

type Props = {
  commandAction: (command: ReceptionCommand) => Promise<ReceptionResult>;
  cameraSource?: CameraSource;
  deviceMode?: "computer" | "phone";
  onChangeMode?: () => void;
  onChangeDuty?: () => void;
  duty?: ReceptionDuty;
  labelPrinting?: boolean;
  labelCommandAction?: (command: LabelCommand) => Promise<LabelResult>;
  badgeCommandAction?: (command: BadgeCommand) => Promise<BadgeResult>;
};

export function EventReceptionConsole(props: Props) {
  const { commandAction, deviceMode = "computer", cameraSource, onChangeMode, onChangeDuty } = props;
  const [session] = useState(() => new ReceptionStationSession(commandAction, () => crypto.randomUUID(), 20000, { duty: "event_entry" }, true));
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [entry, setEntry] = useState<VerifiedReception | null>(null);
  const [partyOpen, setPartyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState("");
  const latch = useRef(new ScanLatch());
  const heading = useRef<HTMLHeadingElement>(null);
  const locked = busy || session.isLocked();
  const result = state.phase === "blocked" ? null : state.result ?? entry;
  const correction = state.mode !== "enter";
  const multiple = result && (result.kind === "group" || result.kind === "family" && result.persons.length > 1);
  const problem = ["error", "uncertain", "blocked"].includes(state.phase);
  const correctionOpen = correction && state.phase === "selection" && state.result && state.result.kind !== "room";

  useEffect(() => { session.setActive(true); return () => session.setActive(false); }, [session]);
  useEffect(() => {
    if (!locked) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [locked]);
  useEffect(() => { if (entry && !partyOpen) heading.current?.focus(); }, [entry, partyOpen]);

  async function inspect(lookup: ReceptionCommand["lookup"]) {
    if (busy || !session.canScan() || entry) return;
    session.setMode("enter");
    await session.inspect(lookup);
    const found = session.snapshot().result;
    if (found) { setEntry(found); setPartyOpen(found.kind === "group" || found.kind === "family" && found.persons.length > 1); }
  }
  function next() {
    if (locked) return;
    session.setMode("enter"); session.next(); setEntry(null); setPartyOpen(false); latch.current = new ScanLatch();
  }
  async function retry() {
    await session.retry();
    const found = session.snapshot().result;
    if (found && !entry) { setEntry(found); setPartyOpen(session.snapshot().mode === "enter" && (found.kind === "group" || found.kind === "family" && found.persons.length > 1)); }
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
    disabled={locked || problem || correction} onBusyChange={setBusy} feedback={feedback}
    onEdit={() => { setPartyOpen(false); void session.editCurrent(); }}
  /> : null;

  return <section className="mx-auto grid w-full max-w-3xl gap-4" aria-labelledby="reception-title">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="reception-title" className="text-xl font-semibold">Accoglienza evento</h2>
      <div className="flex gap-3 text-sm">
        {onChangeMode && <button className="min-h-11 underline" disabled={locked || partyOpen || !!correctionOpen} onClick={onChangeMode}>Cambia modalità</button>}
        {onChangeDuty && <button className="min-h-11 underline" disabled={locked || partyOpen || !!correctionOpen} onClick={onChangeDuty}>Cambia incarico</button>}
      </div>
    </header>
    <div hidden={!!result || problem && state.phase !== "error"}>
      <div className="surface-card grid gap-4 p-4">
        {!manual ? deviceMode === "computer" ? <ReceptionUsbScanner paused={locked || !!entry} onCode={value => void inspect({ kind: "qr", value })} /> :
          <ReceptionCamera source={cameraSource} paused={locked || !!entry} onCode={value => {
            if (!entry && session.canScan() && latch.current.accept(value)) void inspect({ kind: "qr", value });
          }} onNoCode={() => { if (!entry && session.canScan()) latch.current.absent(); }} /> :
          <form className="grid gap-3" onSubmit={event => { event.preventDefault(); void inspect({ kind: code.startsWith("G:") || code.length === 43 ? "qr" : "code", value: code }); setCode(""); }}>
            <label className="grid gap-1">Codice partecipante o QR gruppo<input className="field min-h-12" disabled={locked || !!entry} value={code} onChange={event => setCode(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={45} /></label>
            <button className="btn-primary min-h-12" disabled={locked || !!entry}>Leggi codice</button>
          </form>}
        <button className="min-h-11 justify-self-start text-sm underline" disabled={locked || !!entry} onClick={() => setManual(!manual)}>{manual ? deviceMode === "computer" ? "Scanner USB" : "Inquadra QR code" : "Inserisci il codice manualmente"}</button>
      </div>
    </div>
    {!result && feedback}
    {result && <div className="surface-card grid gap-4 p-5 sm:p-7">
      <h3 ref={heading} tabIndex={-1} className="break-words text-2xl font-bold outline-none">{result.kind === "group" ? result.groupName : result.kind === "family" ? `${result.persons[0]?.firstName} ${result.persons[0]?.lastName}` : result.kind === "school" ? `${result.schoolName} · ${result.classDescription}` : result.label}</h3>
      {result.kind === "family" && <p className="text-sm text-slate-600">{result.code}</p>}
      {multiple ? <>
        <p>{result.persons.filter(person => person.checkedInAt).length} presenti su {result.persons.length}</p>
        <button className="btn-primary min-h-12 px-4" disabled={locked || problem || correction} onClick={() => setPartyOpen(true)}>Gestisci presenze{deviceMode === "computer" && props.labelPrinting ? " e QR" : ""}</button>
          <ReceptionOperationDialog open={partyOpen} labelledBy="reception-party-title" onDismiss={locked ? undefined : () => setPartyOpen(false)}>
            <h2 id="reception-party-title" tabIndex={-1} className="text-xl font-bold outline-none">{result.kind === "group" ? result.groupName : "Presenze della famiglia"}</h2>
            {party}
            <button className="btn-secondary min-h-12 px-4" disabled={locked} onClick={next}>Passa al prossimo codice</button>
          </ReceptionOperationDialog>
        {!partyOpen && feedback}
      </> : party ?? <>
        {feedback}
        {result.kind === "school" && <>
          <p>{result.checkedInAt ? `Presenti: ${result.students} studenti e ${result.companions} accompagnatori` : "Ingresso non registrato"}</p>
          <button className="btn-primary min-h-12 px-4" disabled={locked || problem} onClick={() => result.checkedInAt ? void session.editCurrent() : session.selectPresence()}>{result.checkedInAt ? "Modifica presenze" : "Registra presenze"}</button>
        </>}
      </>}
      {!partyOpen && <button className="btn-secondary min-h-12 px-4" disabled={locked} onClick={next}>Passa al prossimo codice</button>}
      {deviceMode === "computer" && result.kind === "group" && state.lookup?.kind === "qr" && !partyOpen && !problem && <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm">Badge completo e sedute cerimonie</summary>
        <GroupBadgePanel token={state.lookup.value} group={result} commandAction={props.badgeCommandAction} onBusyChange={setBusy} />
      </details>}
    </div>}
    {(correctionOpen || state.phase === "selection" && result?.kind === "school") && state.result && state.result.kind !== "room" && <ReceptionOperationDialog onDismiss={() => session.closeSelection()}>
      <h2 id="reception-operation-title" tabIndex={-1} className="text-xl font-bold outline-none">{correction ? "Modifica presenze" : "Presenze della scuola"}</h2>
      <PresenceSelection key={`${state.result.revision}-${state.mode}`} result={state.result} mode={state.mode} onSubmit={(values, confirmed, cancelSchool) => void session.submit(values, confirmed, cancelSchool)} onDismiss={() => session.closeSelection()} />
    </ReceptionOperationDialog>}
    <details className="text-sm">
      <summary className="cursor-pointer py-3">Ultime letture ({state.recent.length})</summary>
      <ul className="grid gap-2">{state.recent.map(item => <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 border-t py-2">
        <span>{item.result.kind === "family" ? `${item.result.persons[0]?.firstName} ${item.result.persons[0]?.lastName} · ${item.result.code}` : item.result.kind === "group" ? item.result.groupName : item.result.kind === "school" ? item.result.schoolName : item.result.label}</span>
        <button className="min-h-11 underline" disabled={locked || partyOpen || !!entry || !!correctionOpen} onClick={() => void session.editRecent(item.key)}>Modifica presenze</button>
      </li>)}</ul>
    </details>
  </section>;
}
