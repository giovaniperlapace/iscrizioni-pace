"use client";
import { ProgressButton } from "@/components/button-progress";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { qrLabelCommand } from "./participants/qr/labels/actions";
import { printQrLabelDocument } from "@/lib/qrcode/print-client";
import type { LabelCommand, LabelQueue, LabelResult, LabelScope } from "@/lib/reception/qr-labels";

const errors: Record<string, string> = {
  forbidden: "Non sei autorizzato a stampare questi QR. Verifica il tuo accesso.",
  unavailable: "Non è stato possibile avviare la stampa. Controlla le etichette uscite prima di riprovare.",
  migration_required: "La stampa non è ancora disponibile. Contatta il responsabile.",
  conflict: "I dati sono cambiati. Premi di nuovo il pulsante per riprovare.",
  replayed: "La stampa è già stata richiesta. Controlla le etichette uscite.",
};
const reasons: Record<string, string> = { identity: "Codice partecipante mancante", deleted: "Iscrizione eliminata", cancelled: "Iscrizione annullata", inactive: "Iscrizione non attiva", missing: "QR mancante", revoked: "QR non più valido", expired: "QR scaduto", layout_or_qr: "Nome o QR non adatto all’etichetta" };

// Page-wide interaction lock, including the server request before an iframe
// exists. It is not a print history: the canonical records remain in the DB.
let printing = false;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function getPrinting() { return printing; }
function getServerPrinting() { return false; }
function setPrinting(value: boolean) { printing = value; for (const listener of listeners) listener(); }

export function useQrLabelPrinting({ scope, commandAction = qrLabelCommand, onBusyChange, enabled = true, initialResult, selectInitially = true }: {
  scope: LabelScope;
  commandAction?: (input: LabelCommand) => Promise<LabelResult>;
  onBusyChange?: (busy: boolean) => void;
  enabled?: boolean;
  initialResult?: LabelResult;
  selectInitially?: boolean;
}) {
  const [failed, setFailed] = useState(!!initialResult && initialResult.status !== "queue");
  const [message, setMessage] = useState(initialResult && initialResult.status !== "queue" ? errors[initialResult.status] ?? errors.unavailable : "");
  const [queue, setQueue] = useState<LabelQueue | null>(initialResult?.status === "queue" ? initialResult : null);
  const [selection, setSelection] = useState<string[]>(() => selectInitially && initialResult?.status === "queue" ? initialResult.items.filter(item => !item.reason).map(item => item.registrationId) : []);
  const groupId = scope.groupId;
  const registrationId = scope.registrationId;
  const busy = useSyncExternalStore(subscribe, getPrinting, getServerPrinting);
  const controller = useRef<AbortController | null>(null);
  const readVersion = useRef(0);
  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => {
    if (!enabled || initialResult) return;
    let active = true;
    const version = ++readVersion.current;
    const readScope: LabelScope = groupId ? { groupId } : { registrationId: registrationId! };
    commandAction({ ...readScope, action: "read" }).then(result => {
      if (!active || version !== readVersion.current) return;
      if (result.status === "queue") { setQueue(result); setSelection(selectInitially ? result.items.filter(item => !item.reason).map(item => item.registrationId) : []); }
      else { setFailed(true); setMessage(errors[result.status] ?? errors.unavailable); }
    }).catch(() => { if (active && version === readVersion.current) { setFailed(true); setMessage(errors.unavailable); } });
    return () => { active = false; };
  }, [groupId, registrationId, commandAction, enabled, initialResult, selectInitially]);

  async function print(selectedIds?: string[]) {
    if (printing || !enabled) return;
    readVersion.current++;
    setPrinting(true); onBusyChange?.(true); setFailed(false); setMessage("");
    const abort = new AbortController(); controller.current = abort;
    try {
      // Read current scope/QRs on each explicit click; history never changes
      // the button or requires a physical confirmation from the operator.
      const fresh = await commandAction({ ...scope, action: "read" });
      if (abort.signal.aborted) return;
      if (fresh.status !== "queue") { setFailed(true); setMessage(errors[fresh.status] ?? errors.unavailable); return; }
      const available = fresh.items.filter(item => !item.reason).map(item => item.registrationId);
      if (groupId && !queue && !selectedIds) { setQueue(fresh); setSelection(selectInitially ? available : []); return; }
      setQueue(fresh);
      const ids = selectedIds ?? (groupId ? selection : available);
      if (ids.some(id => !available.includes(id))) {
        setQueue(fresh); setSelection(ids.filter(id => available.includes(id)));
        setFailed(true); setMessage("L’elenco è cambiato. Controlla le persone selezionate e premi di nuovo il pulsante."); return;
      }
      if (!ids.length) { setMessage("Nessun QR disponibile per la stampa."); return; }
      const requestId = crypto.randomUUID();
      const result = await commandAction({ ...scope, action: "request", ids, snapshot: fresh.snapshot,
        requestId, profile: "continuous-29x45" });
      if (result.status !== "document") {
        if (!abort.signal.aborted) { setFailed(true); setMessage(errors[result.status] ?? errors.unavailable); }
        return;
      }
      try {
        await printQrLabelDocument(result.html, abort.signal);
      } catch {
        const outcome = await commandAction({ ...scope, action: "outcome", requestId, outcome: "error" }).catch(() => undefined);
        if (!abort.signal.aborted && outcome?.status === "queue") setQueue(outcome);
        if (!abort.signal.aborted) { setFailed(true); setMessage(errors.unavailable); }
        return;
      }
      // A browser return records an attempt, never a physical verification.
      const outcome = await commandAction({ ...scope, action: "outcome", requestId, outcome: "browser_returned" });
      if (!abort.signal.aborted && outcome.status === "queue") setQueue(outcome);
      if (!abort.signal.aborted) setMessage(ids.length === 1 ? "Comando di stampa inviato." : `Comando di stampa inviato per ${ids.length} etichette.`);
    } catch {
      if (!abort.signal.aborted) { setFailed(true); setMessage(errors.unavailable); }
    } finally {
      if (controller.current === abort) controller.current = null;
      onBusyChange?.(false); setPrinting(false);
    }
  }

  return { failed, message, queue, selection, setSelection, busy, print };
}

export function QrLabelPanel({ scope, commandAction = qrLabelCommand, onBusyChange, initialResult, selectInitially = true }: {
  scope: LabelScope;
  initialResult?: LabelResult;
  selectInitially?: boolean;
  onBusyChange?: (busy: boolean) => void;
  commandAction?: (input: LabelCommand) => Promise<LabelResult>;
}) {
  const { failed, message, queue, selection, setSelection, busy, print } = useQrLabelPrinting({ scope, commandAction, onBusyChange, initialResult, selectInitially });
  const groupId = scope.groupId;
  const registrationId = scope.registrationId;
  const available = queue?.items.filter(item => !item.reason) ?? [];
  const disabled = busy || !!groupId && (queue ? !selection.length : !failed);
  return <section className="grid min-w-0 gap-3" aria-label="Etichette QR">
    {groupId ? <>
      {!queue && !message ? <p role="status">Caricamento dell’elenco…</p> : null}
      {queue ? <>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" disabled={busy || !available.length} checked={available.length > 0 && available.every(item => selection.includes(item.registrationId))}
          onChange={event => setSelection(event.target.checked ? available.map(item => item.registrationId) : [])} />Seleziona tutte · Selezionate: {selection.length}</label>
        <ul className="grid max-h-[45dvh] gap-2 overflow-y-auto">{queue.items.map(item => <li key={item.registrationId}>
          <label className="flex min-h-11 items-start gap-3 py-2"><input type="checkbox" aria-label={`${item.name}${item.code ? ` · ${item.code}` : ""}`} className="mt-1" disabled={busy || !!item.reason} checked={selection.includes(item.registrationId)}
            onChange={event => setSelection(ids => event.target.checked ? [...ids, item.registrationId] : ids.filter(id => id !== item.registrationId))} />
            <span>{item.name}{item.code ? ` · ${item.code}` : ""}<span className="block text-xs text-[var(--peace-muted)]">Stampe richieste: {item.attempts}</span>{item.reason ? <span className="block text-sm">{reasons[item.reason] ?? "Non stampabile"}</span> : null}</span>
          </label>
        </li>)}</ul>
        {!queue.items.length ? <p className="text-sm">Non ci sono iscrizioni da mostrare.</p> : null}
      </> : null}
    </> : null}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <ProgressButton progressError={failed} type="button" disabled={disabled} aria-busy={busy}
        className="btn-primary min-h-11 justify-self-start px-4" onClick={() => void print()}>
        {scope.groupId ? (!queue && failed ? "Riprova caricamento elenco" : "Stampa i QR selezionati") : "Stampa etichetta QR"}
      </ProgressButton>
      {!groupId ? <span role="status" className="text-sm text-[var(--peace-muted)]">Stampe richieste: {queue ? queue.items.find(item => item.registrationId === registrationId)?.attempts ?? "—" : "—"}</span> : null}
    </div>
    {message ? <p role={failed ? "alert" : "status"} className="text-sm">{message}</p> : null}
  </section>;
}
