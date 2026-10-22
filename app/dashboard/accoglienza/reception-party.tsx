"use client";
import { GroupCeremonyPlaces } from "./group-ceremony-places";
import { ceremonySeatText } from "@/lib/ceremonies/seat-projection";
import { useParticipantSheetSection } from "../participant-sheet-loading";
import { useRef, useState, type ReactNode } from "react";
import type { LabelCommand, LabelResult } from "@/lib/reception/qr-labels";
import { ReceptionStationSession, type VerifiedReception } from "@/lib/reception/station";
import { useQrLabelPrinting } from "../qr-label-panel";
type Party = Extract<VerifiedReception, { kind: "family" | "group" }>;

export function ReceptionParty({ result, session, printing, labelCommandAction, disabled, onBusyChange, onRemove, feedback, compact = false, allowEventEntryOverride = false }: {
  compact?: boolean; allowEventEntryOverride?: boolean;
  result: Party; session: ReceptionStationSession; printing: boolean;
  labelCommandAction?: (command: LabelCommand) => Promise<LabelResult>; disabled: boolean; onBusyChange: (value: boolean) => void;
  onRemove: (ids: string[]) => void; feedback: ReactNode;
}) {
  const single = result.kind === "family" && result.persons.length === 1;
  const [selected, setSelected] = useState<string[]>(() => single ? [result.persons[0].id] : []);
  const running = useRef(false);
  const adultId = result.persons.find(person => person.kind === "adult")?.id;
  const labels = useQrLabelPrinting({ scope: result.kind === "group" ? { groupId: result.groupId } : { registrationId: adultId! }, commandAction: labelCommandAction, enabled: printing && !!(result.kind === "group" || adultId) });
  useParticipantSheetSection("reception", !printing || Boolean(labels.queue) || labels.failed);
  const selectedSet = new Set(selected);
  const registrations = new Map(result.kind === "group" ? result.persons.map(person => [person.id, person.registrationId]) : result.persons.map(person => [person.id, adultId!]));
  const codes = new Map(result.kind === "group" ? result.persons.map(person => [person.id, person.code]) : []);
  const labelItems = new Map(labels.queue?.items.map(item => [item.registrationId, item]));
  const orderedPersons = result.kind === "group" ? [...result.persons].sort((a, b) => {
    const presenceOrder = Number(Boolean(a.checkedInAt)) - Number(Boolean(b.checkedInAt));
    if (presenceOrder) return presenceOrder;
    // Unknown print counts follow known counts; ties preserve the source order.
    const aAttempts = labelItems.get(a.registrationId)?.attempts ?? Infinity;
    const bAttempts = labelItems.get(b.registrationId)?.attempts ?? Infinity;
    return aAttempts === bAttempts ? 0 : aAttempts - bAttempts;
  }) : result.persons;
  const chosen = result.persons.filter(person => selectedSet.has(person.id));
  const labelIds = [...new Set(chosen.map(person => registrations.get(person.id)!))];
  const presentIds = chosen.filter(person => person.checkedInAt).map(person => person.id);
  const pendingIds = chosen.filter(person => !person.checkedInAt && person.eligible !== false && person.eventCheckedIn !== false).map(person => person.id);
  const overrideIds = chosen.filter(person => !person.checkedInAt && person.eligible !== false).map(person => person.id);
  const missingEventEntry = allowEventEntryOverride && chosen.some(person => !person.checkedInAt && person.eligible !== false && person.eventCheckedIn === false);
  const unavailable = labels.queue && labelIds.some(id => !labelItems.has(id) || !!labelItems.get(id)?.reason);
  const locked = disabled || labels.busy;
  const allPresent = result.persons.every(person => person.checkedInAt);

  async function act(kind: "presence" | "print", override = false) {
    if (running.current || locked || !chosen.length) return;
    running.current = true; onBusyChange(true);
    try {
      if (kind === "presence") {
        const ids = override && missingEventEntry ? overrideIds : pendingIds;
        if (!ids.length) return;
        session.selectPresence(override && missingEventEntry);
        await session.submit({ subjectIds: ids });
      } else await labels.print(labelIds);
    } finally { running.current = false; onBusyChange(false); }
  }
  return <div className="grid gap-4">
    {result.kind === "group" && <GroupCeremonyPlaces summary={result.groupCeremonies}/>}
    {single ? (!compact || allPresent) && <p role="status" className={`rounded-xl p-4 text-lg font-semibold ${allPresent ? "bg-green-100 text-green-900" : "bg-slate-100 text-slate-700"}`}>{allPresent ? "✓ Partecipazione confermata" : "Partecipazione non confermata"}</p> : <>
      <h4 className="font-semibold outline-none">Gestisci Presenze</h4>
      <p className="text-sm text-[var(--peace-muted)]">Seleziona le persone su cui agire. Conferma e rimozione sono due azioni distinte. Deselezionare una persona non rimuove la sua presenza.</p>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <strong>{chosen.length} selezionati · {result.persons.filter(p => p.checkedInAt).length} presenti</strong>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" disabled={locked} checked={result.persons.length > 0 && result.persons.every(person => selectedSet.has(person.id))} onChange={e => setSelected(e.target.checked ? result.persons.map(p => p.id) : [])} />Seleziona tutti</label>
      </div>
      <fieldset disabled={locked} className="grid max-h-[45dvh] gap-2 overflow-y-auto">
        <legend className="sr-only">Persone da accogliere</legend>
        {orderedPersons.map(person => {
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
    {result.kind === "family" && result.persons.map(person => (!!person.ceremonies?.length || person.eligible === false || person.eventCheckedIn === false) && <div key={person.id} className="text-sm">
      {!!person.ceremonies?.length && <p className="font-semibold">{person.firstName} {person.lastName}: {person.ceremonies.map(ceremonySeatText).join(" · ")}</p>}
      {person.eligible === false && <p role="alert" className="rounded-lg border border-orange-500 bg-orange-100 p-3 text-orange-950">{person.firstName}: nessun biglietto valido per questa cerimonia. Rivolgiti alla postazione iscrizioni.</p>}
      {person.eventCheckedIn === false && !person.checkedInAt && <p role="alert" className="rounded-lg border border-yellow-500 bg-yellow-100 p-3 text-yellow-950">{person.firstName}: accoglienza generale non registrata.</p>}
    </div>)}
    {feedback}
    {unavailable && <p className="text-sm text-amber-900">Uno dei QR selezionati non è stampabile. Puoi comunque registrare le presenze.</p>}
    <div className="grid gap-2 border-t border-slate-200 bg-white pt-3">
      {!single && <p className="text-sm">Selezione: {pendingIds.length} da confermare · {presentIds.length} già presenti.</p>}
      {!missingEventEntry && !(compact && single && allPresent) && <button className="btn-primary min-h-12 px-4" disabled={locked || !pendingIds.length} onClick={() => void act("presence")}>{compact ? (single ? "Segna entrata" : `Segna entrata (${pendingIds.length})`) : single ? "Conferma partecipazione" : `Conferma partecipazione (${pendingIds.length})`}</button>}
      {missingEventEntry && <><p className="text-sm text-yellow-950">Conferma solo l’ingresso a questo Forum; l’accoglienza generale resta non registrata.</p><button className="min-h-12 rounded-lg border border-yellow-600 bg-yellow-100 px-4 font-semibold text-yellow-950" disabled={locked || !overrideIds.length} onClick={() => void act("presence", true)}>Segna l’ingresso comunque</button></>}
      {result.persons.some(person => person.checkedInAt) && <button className="btn-secondary min-h-12 px-4" disabled={locked || !presentIds.length} onClick={() => onRemove(presentIds)}>{single ? "Rimuovi presenza" : `Rimuovi presenze selezionate (${presentIds.length})`}</button>}
      {printing && <button className="btn-secondary min-h-12 px-4" disabled={locked || !chosen.length || !!unavailable} onClick={() => void act("print")}>{result.kind === "group" ? "Stampa i QR delle persone selezionate" : "Stampa etichetta QR"}</button>}
      {single && printing && <span className="text-sm text-slate-600">Stampe richieste: {labels.queue?.items.find(item => item.registrationId === adultId)?.attempts ?? "—"}</span>}
      {labels.message && <p role={labels.failed ? "alert" : "status"} className="text-sm">{labels.message}</p>}
    </div>
  </div>;
}
