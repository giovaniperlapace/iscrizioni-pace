"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { receptionCheckIn } from "./accoglienza/actions";
import { PresenceSelection, ReceptionOperationDialog } from "./accoglienza/reception-console";
import { ReceptionStationSession } from "@/lib/reception/station";
import type { ReceptionCommand, ReceptionResult } from "@/lib/reception/contracts";

export default function EventPresenceEditor({ eventId, registrationId, code, name, onClose, onSaved, commandAction }: {
  eventId: string; registrationId: string; code: string; name: string;
  onClose: () => void; onSaved: () => void;
  commandAction?: (command: ReceptionCommand) => Promise<ReceptionResult>;
}) {
  const [session] = useState(() => new ReceptionStationSession(async command => {
    const result = await (commandAction ?? (input => receptionCheckIn(eventId, input)))(command);
    // A public code must still resolve to the participant whose row was opened.
    if (result.status === "valid" && (result.kind !== "family" ||
      !result.persons.some(person => person.kind === "adult" && person.id === registrationId))) return { status: "invalid" };
    return result;
  }, () => crypto.randomUUID()));
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  const pending = state.phase === "pending" || state.phase === "uncertain";

  useEffect(() => {
    session.setActive(true);
    session.setMode("correct");
    void session.inspect({ kind: "code", value: code });
    return () => session.setActive(false);
  }, [session, code]);

  useEffect(() => {
    if (state.phase === "result") onSaved();
  }, [state.phase, onSaved]);

  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  function reload() {
    session.setMode("correct");
    void session.inspect({ kind: "code", value: code });
  }

  return <ReceptionOperationDialog onDismiss={pending ? undefined : onClose}>
    <h2 id="reception-operation-title" tabIndex={-1} className="text-xl font-semibold outline-none">Modifica presenza all’evento</h2>
    <p className="font-semibold">{name} · {code}</p>
    {state.phase === "pending" && <p role="status">Verifica delle presenze in corso…</p>}
    {state.message && state.phase !== "result" && <p role="alert">{state.problem === "conflict"
      ? "Un altro operatore ha aggiornato le presenze. Rileggi le presenze e verifica la selezione prima di confermare."
      : state.message}</p>}
    {state.phase === "selection" && state.result?.kind === "family" && <>
      <p className="text-sm">Seleziona chi è presente all’evento. Le modifiche saranno salvate solo dopo la conferma.</p>
      <PresenceSelection key={state.result.revision} result={state.result} mode="correct"
        onSubmit={(values, confirmed) => void session.submit(values, confirmed)} onDismiss={onClose} />
    </>}
    {state.phase === "uncertain" && <button type="button" className="btn-primary min-h-12 px-4" onClick={() => void session.retry()}>Riprova la stessa operazione</button>}
    {state.phase === "error" && <button type="button" className="btn-secondary min-h-12 px-4" onClick={reload}>Rileggi le presenze</button>}
  </ReceptionOperationDialog>;
}
