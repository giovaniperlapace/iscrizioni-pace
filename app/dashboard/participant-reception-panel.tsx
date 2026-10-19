"use client";

import { readParticipantLabels, readParticipantReception } from "./participant-sheet-reads";

import { useParticipantSheetSection } from "./participant-sheet-loading";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { participantReceptionCommand, participantLabelCommand } from "./participants/reception-actions";
import { PresenceRemovalDialog } from "./accoglienza/reception-presence-controls";
import { ReceptionParty } from "./accoglienza/reception-party";
import { ReceptionStationSession, type VerifiedReception } from "@/lib/reception/station";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";
import type { LabelCommand, LabelResult } from "@/lib/reception/qr-labels";

export function ParticipantReceptionPanel({ eventId, registrationId, code, onBusyChange, commandAction, labelCommandAction }: {
  eventId: string; registrationId: string; code: string;
  onBusyChange?: (busy: boolean) => void;
  commandAction?: (command: ReceptionCommand) => Promise<ReceptionResult>;
  labelCommandAction?: (command: LabelCommand) => Promise<LabelResult>;
}) {
  const [session] = useState(() => new ReceptionStationSession(async command => {
    const result = await (commandAction ?? (input => input.action === "inspect" && input.lookup.kind === "code"
      ? readParticipantReception(eventId, registrationId, input.lookup.value)
      : participantReceptionCommand(eventId, registrationId, input)))(command);
    // The public code must still identify the participant whose QR area is open.
    if (result.status === "valid" && (result.kind !== "family" || !result.persons.some(person => person.kind === "adult" && person.id === registrationId))) return { status: "invalid" };
    return result;
  }, () => crypto.randomUUID(), 20000, { duty: "event_entry" }, true));
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const [removalIds, setRemovalIds] = useState<string[]>([]);
  const [printing, setPrinting] = useState(false);
  const [verified, setVerified] = useState<VerifiedReception | null>(null);
  const locked = printing || state.phase === "pending" || state.phase === "uncertain";
  const result = state.phase === "blocked" ? null : state.result ?? verified;
  const correcting = state.mode !== "enter";

  useEffect(() => {
    session.setActive(true);
    const unsubscribe = session.subscribe(() => {
      const result = session.snapshot().result;
      if (result) setVerified(result);
    });
    void session.inspect({ kind: "code", value: code });
    return () => { unsubscribe(); session.setActive(false); };
  }, [session, code]);
  useEffect(() => { onBusyChange?.(locked); }, [locked, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
  useEffect(() => {
    if (!locked) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [locked]);

  useParticipantSheetSection("reception", !["ready", "pending"].includes(state.phase) && result?.kind !== "family");
  const printCommand = useCallback((command: LabelCommand) => (labelCommandAction ?? (input => input.action === "read" ? readParticipantLabels(registrationId) : participantLabelCommand(registrationId, input)))(command), [labelCommandAction, registrationId]);

  function reload() { session.setMode("enter"); void session.inspect({ kind: "code", value: code }); }
  const feedback = <>
    {state.phase === "pending" && <p role="status">Operazione in corso…</p>}
    {state.message && state.phase === "result" && state.result?.outcome !== "verified" && state.result?.kind === "family" && state.result.persons.length > 1 && <p role="status" className="rounded-lg bg-green-100 p-3 text-green-900">✓ Partecipazione aggiornata.</p>}
    {state.message && ["error", "uncertain", "blocked"].includes(state.phase) && <p role="alert">{state.message}</p>}
    {state.phase === "uncertain" && <button type="button" className="btn-primary min-h-12 px-4" onClick={() => void session.retry()}>Riprova la stessa operazione</button>}
    {state.phase === "error" && <button type="button" className="btn-secondary min-h-12 px-4" onClick={reload}>Rileggi la partecipazione</button>}
  </>;
  return <section className="grid w-full gap-3" aria-label="Partecipazione e stampa QR" aria-busy={locked}>
    <h4 className="font-semibold">Partecipazione e stampa QR</h4>
    {result?.kind === "family" ? <ReceptionParty result={result} session={session} printing labelCommandAction={printCommand}
      disabled={locked || correcting || state.phase === "error"} onBusyChange={setPrinting} feedback={feedback} onRemove={ids => { setRemovalIds(ids); void session.removeCurrent(); }} /> : feedback}
    {state.mode === "cancel" && state.phase === "selection" && state.result?.kind === "family" && <PresenceRemovalDialog
      result={state.result} subjectIds={removalIds} onDismiss={() => session.closeSelection()}
      onConfirm={ids => void session.submit({ subjectIds: ids }, true)} />}
  </section>;
}
