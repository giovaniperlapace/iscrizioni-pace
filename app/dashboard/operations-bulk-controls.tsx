"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OperationsParticipantsSnapshot, OperationsParticipantRow } from "@/lib/registrations/operations-types";

const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--peace-border-strong)] bg-white px-3 text-sm font-semibold text-[var(--peace-blue-800)] disabled:opacity-50";
export function OperationsBulkControls({ snapshot, rows, selectedIds, setSelectedIds, eventId, dashboard, disabled, onBusy, onSaved }: {
  snapshot: OperationsParticipantsSnapshot; rows: OperationsParticipantRow[]; selectedIds: string[];
  setSelectedIds: (ids: string[]) => void; eventId: string; dashboard: "admin" | "manager";
  disabled: boolean; onBusy: (busy: boolean) => void; onSaved: (message: string) => void;
}) {
  const router = useRouter();
  useEffect(() => () => onBusy(false), [onBusy]);
  const [field, setField] = useState("tags");
  const [value, setValue] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [confirmation, setConfirmation] = useState<null | { field: string; value: string; ids: string[]; label: string; names: string[] }>(null);
  const [pending, setPending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const blocked = disabled || pending || refreshing;
  const options = field === "tags" ? snapshot.operationalTags.filter(x => x.eventId === eventId)
    : field === "service" ? snapshot.eventServices.filter(x => x.eventId === eventId && x.isActive)
    : snapshot.groupOptions.filter(x => x.eventId === eventId).map(x => ({ ...x, label: x.name }));
  const eligible = rows.filter(row => row.eventId === eventId && !row.deletedAt);

  async function save() {
    if (!confirmation || inFlight.current) return;
    inFlight.current = true; setPending(true); onBusy(true); setError("");
    try {
      const response = await fetch("/dashboard/participants/bulk-update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboard, eventId, field: confirmation.field, value: confirmation.value, registrationIds: confirmation.ids }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Operazione non riuscita.");
      const successMessage = confirmation.field === "delete-tag"
        ? `Tag eliminato. Rimosse ${result.count} assegnazioni.`
        : `Modifica completata per ${result.count} iscritti.`;
      setConfirmation(null); setSelectedIds([]); onSaved(successMessage);
      setValue(""); setDeleteId("");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof TypeError ? "Risposta non ricevuta: l’esito è incerto. Aggiorna l’elenco prima di ripetere l’operazione." : e instanceof Error ? e.message : "Operazione non riuscita.");
    } finally { inFlight.current = false; setPending(false); onBusy(false); }
  }

  return <section aria-label="Modifiche multiple" className="my-4 rounded-md border border-[var(--peace-border-strong)] p-3">
    <fieldset disabled={blocked || Boolean(confirmation)} className="grid gap-3">
      <legend className="font-semibold">Modifiche multiple</legend>
      <p className="text-sm">Seleziona gli iscritti nelle righe o tutta la pagina (massimo 100). La selezione si azzera cambiando pagina o filtri. Gruppo e servizio sostituiscono il valore precedente; il tag si aggiunge agli altri. I minori accompagnati seguono il gruppo dell’iscrizione, senza ricevere tag o servizi.</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" aria-label="Seleziona tutti gli iscritti della pagina"
          checked={eligible.length > 0 && eligible.every(row => selectedIds.includes(row.registrationId))}
          onChange={event => setSelectedIds(event.target.checked ? eligible.map(row => row.registrationId) : [])} />Seleziona pagina</label>
        <span>{selectedIds.length} selezionati</span>
        <button type="button" className={buttonClass} onClick={() => setSelectedIds([])}>Deseleziona tutti</button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">Operazione<select className="field" value={field} onChange={e => { setField(e.target.value); setValue(""); }}>
          <option value="tags">Aggiungi tag</option><option value="group">Assegna gruppo</option><option value="service">Assegna servizio</option>
        </select></label>
        <label className="grid min-w-0 gap-1 text-sm">Valore da assegnare<select className="field max-w-full" value={value} onChange={e => setValue(e.target.value)}>
          <option value="">Scegli…</option>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select></label>
        <button type="button" className={buttonClass} disabled={!selectedIds.length || !value} onClick={() => {
          setError(""); onBusy(true);
          setConfirmation({ field, value, ids: [...selectedIds], label: options.find(x => x.id === value)?.label ?? "", names: eligible.filter(row => selectedIds.includes(row.registrationId)).map(row => row.name) });
        }}>Rivedi modifica</button>
      </div>
      <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Elimina un tag</summary>
        <p className="text-sm">L’eliminazione rimuove il tag da tutti i partecipanti dell’evento, anche fuori dalla selezione e dai filtri.</p>
        <div className="mt-2 flex flex-wrap items-end gap-3"><label className="grid gap-1 text-sm">Tag da eliminare<select className="field" value={deleteId} onChange={e => setDeleteId(e.target.value)}>
          <option value="">Scegli…</option>{snapshot.operationalTags.filter(x => x.eventId === eventId).map(tag => <option key={tag.id} value={tag.id}>{tag.label}</option>)}
        </select></label>
        <button type="button" className={buttonClass} disabled={!deleteId} onClick={() => {
          setError(""); onBusy(true); setConfirmation({ field: "delete-tag", value: deleteId, ids: [], names: [], label: snapshot.operationalTags.find(x => x.id === deleteId)?.label ?? "" });
        }}>Rivedi eliminazione</button></div>
      </details>
    </fieldset>
    {confirmation && <div role="region" aria-label="Conferma modifica multipla" className="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3">
      <p>{confirmation.field === "delete-tag" ? `Eliminare definitivamente il tag “${confirmation.label}” da tutti i partecipanti dell’evento? Non sarà più assegnabile.`
        : `${confirmation.field === "tags" ? "Aggiungere il tag" : confirmation.field === "group" ? "Assegnare il gruppo" : "Assegnare il servizio"} “${confirmation.label}” a ${confirmation.ids.length} iscritti?`}</p>
      {confirmation.names.length > 0 && <details><summary className="min-h-11 cursor-pointer py-3">Vedi i nomi selezionati</summary><ul className="max-h-48 overflow-auto">{confirmation.names.map((name, i) => <li key={confirmation.ids[i]}>{name}</li>)}</ul></details>}
      <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={blocked} onClick={save}>{pending ? "Salvataggio…" : confirmation.field === "delete-tag" ? "Conferma eliminazione tag" : "Conferma modifica"}</button>
      <button type="button" className={buttonClass} disabled={pending} onClick={() => { setConfirmation(null); onBusy(false); }}>Annulla</button></div>
    </div>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </section>;
}
