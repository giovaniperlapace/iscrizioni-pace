"use client";
import { useRef, useState, type ReactNode } from "react";
import type { LabelCommand, LabelResult } from "@/lib/reception/qr-labels";
import { ReceptionStationSession, type VerifiedReception } from "@/lib/reception/station";
import { useQrLabelPrinting } from "../qr-label-panel";
type Party = Extract<VerifiedReception, { kind: "family" | "group" }>;

export function ReceptionParty({ result, session, printing, labelCommandAction, disabled, onBusyChange, onRemove, feedback }: {
  result: Party; session: ReceptionStationSession; printing: boolean;
  labelCommandAction?: (command: LabelCommand) => Promise<LabelResult>; disabled: boolean; onBusyChange: (value: boolean) => void;
  onRemove: (ids: string[]) => void; feedback: ReactNode;
}) {
  const single = result.kind === "family" && result.persons.length === 1;
  const [selected, setSelected] = useState<string[]>(() => single ? [result.persons[0].id] : []);
  const running = useRef(false);
  const adultId = result.persons.find(person => person.kind === "adult")?.id;
  const labels = useQrLabelPrinting({ scope: result.kind === "group" ? { groupId: result.groupId } : { registrationId: adultId! }, commandAction: labelCommandAction, enabled: printing && !!(result.kind === "group" || adultId) });
  const selectedSet = new Set(selected);
  const registrations = new Map(result.kind === "group" ? result.persons.map(person => [person.id, person.registrationId]) : result.persons.map(person => [person.id, adultId!]));
  const codes = new Map(result.kind === "group" ? result.persons.map(person => [person.id, person.code]) : []);
  const labelItems = new Map(labels.queue?.items.map(item => [item.registrationId, item]));
  const chosen = result.persons.filter(person => selectedSet.has(person.id));
  const labelIds = [...new Set(chosen.map(person => registrations.get(person.id)!))];
  const presentIds = chosen.filter(person => person.checkedInAt).map(person => person.id);
  const pendingIds = chosen.filter(person => !person.checkedInAt).map(person => person.id);
  const unavailable = labels.queue && labelIds.some(id => !labelItems.has(id) || !!labelItems.get(id)?.reason);
  const locked = disabled || labels.busy;
  const allPresent = result.persons.every(person => person.checkedInAt);

  async function act(kind: "presence" | "print") {
    if (running.current || locked || !chosen.length) return;
    running.current = true; onBusyChange(true);
    try {
      if (kind === "presence") {
        if (!pendingIds.length) return;
        session.selectPresence();
        await session.submit({ subjectIds: chosen.map(person => person.id) });
      } else await labels.print(labelIds);
    } finally { running.current = false; onBusyChange(false); }
  }
  return <div className="grid gap-4">
    {single ? <p role="status" className={`rounded-xl p-4 text-lg font-semibold ${allPresent ? "bg-green-100 text-green-900" : "bg-slate-100 text-slate-700"}`}>{allPresent ? "✓ Partecipazione confermata" : "Partecipazione non confermata"}</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <strong>{chosen.length} selezionati · {result.persons.filter(p => p.checkedInAt).length} presenti</strong>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={locked} checked={result.persons.length > 0 && result.persons.every(person => selectedSet.has(person.id))} onChange={e => setSelected(e.target.checked ? result.persons.map(p => p.id) : [])} />Seleziona tutti</label>
      </div>
      <fieldset disabled={locked} className="grid max-h-[45dvh] gap-2 overflow-y-auto">
        <legend className="sr-only">Persone da accogliere</legend>
        {result.persons.map(person => {
          const label = labelItems.get(registrations.get(person.id)!);
          return <label key={person.id} className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 ${selectedSet.has(person.id) ? "border-sky-600 bg-sky-50" : "border-slate-200"}`}>
            <input type="checkbox" name="receptionSubjects" className="h-5 w-5 shrink-0" checked={selectedSet.has(person.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, person.id] : ids.filter(id => id !== person.id))} />
            <span className="min-w-0 break-words"><strong>{person.firstName} {person.lastName}</strong>{person.kind === "child" && " · Minore"}
              <span className={`block text-sm ${person.checkedInAt ? "font-semibold text-green-800" : "text-slate-600"}`}>{person.checkedInAt ? "✓ Presente" : "Non ancora presente"}{result.kind === "group" ? ` · ${codes.get(person.id)}` : ""}</span>
              {printing && <span className="block text-xs text-slate-600">{person.kind === "child" ? "QR del genitore" : `Stampe richieste: ${label?.attempts ?? "—"}`}{label?.reason ? " · QR non stampabile" : ""}</span>}
            </span>
          </label>;
        })}
      </fieldset>
    </>}
    {feedback}
    {unavailable && <p className="text-sm text-amber-900">Uno dei QR selezionati non è stampabile. Puoi comunque registrare le presenze.</p>}
    <div className="grid gap-2 border-t border-slate-200 bg-white pt-3">
      <button className="btn-primary min-h-12 px-4" disabled={locked || !pendingIds.length} onClick={() => void act("presence")}>Conferma partecipazione</button>
      {printing && <button className="btn-secondary min-h-12 px-4" disabled={locked || !chosen.length || !!unavailable} onClick={() => void act("print")}>{result.kind === "group" ? "Stampa i QR del gruppo" : "Stampa etichetta QR"}</button>}
      {single && printing && <span className="text-sm text-slate-600">Stampe richieste: {labels.queue?.items.find(item => item.registrationId === adultId)?.attempts ?? "—"}</span>}
      {labels.message && <p role={labels.failed ? "alert" : "status"} className="text-sm">{labels.message}</p>}
      {result.persons.some(person => person.checkedInAt) && <button className="min-h-11 justify-self-start text-sm underline" disabled={locked || !presentIds.length} onClick={() => onRemove(presentIds)}>{single ? "Rimuovi presenza" : "Rimuovi presenze selezionate"}</button>}
    </div>
  </div>;
}
