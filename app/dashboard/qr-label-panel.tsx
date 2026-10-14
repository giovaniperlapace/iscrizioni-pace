"use client";
import { ProgressButton } from "@/components/button-progress";
import { useEffect, useRef, useState } from "react";
import { qrLabelCommand } from "./participants/qr/labels/actions";
import { printQrLabelDocument } from "@/lib/qrcode/print-client";
import type { LabelCommand, LabelQueue, LabelResult, LabelScope } from "@/lib/reception/qr-labels";
import type { QrLabelProfile } from "@/lib/qrcode/print-label-profile";
const errors: Record<string, string> = {
  forbidden: "Collaudo riservato all’Admin. Verifica nuovamente l’accesso.",
  unavailable: "Esito da verificare. Rileggi la coda prima di decidere quali etichette ristampare.",
  migration_required: "Coda non ancora attivata in questo ambiente. Il responsabile deve verificare le migration prima del collaudo applicativo.",
  conflict: "Dati o coda cambiati. Rileggi l’elenco e controlla le etichette già richieste.",
  replayed: "Richiesta già acquisita. Nessuna nuova stampa avviata: rileggi la coda e verifica l’esito fisico.",
};
const reasons: Record<string, string> = { identity: "Codice partecipante mancante", deleted: "Iscrizione eliminata", cancelled: "Iscrizione annullata", inactive: "Iscrizione non attiva", missing: "QR mancante", revoked: "QR revocato", expired: "QR scaduto", layout_or_qr: "QR o nominativo non impaginabile: verifica con il responsabile" };
export function QrLabelPanel({ scope, commandAction = qrLabelCommand, onBusyChange }: {
  scope: LabelScope; onBusyChange?: (busy: boolean) => void; commandAction?: (input: LabelCommand) => Promise<LabelResult>;
}) {
  const { groupId, registrationId } = scope;
  const [queue, setQueue] = useState<LabelQueue | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [stationReady, setStationReady] = useState(false);
  const [profile, setProfile] = useState<QrLabelProfile>("continuous-29x45");
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    commandAction({ ...(groupId ? { groupId } : { registrationId: registrationId! }), action: "read" }).then(result => {
      if (!active) return;
      if (result.status === "queue") { setQueue(result); setSelection(result.items.filter(i => !i.reason && i.state === "pending").map(i => i.registrationId)); }
      else setMessage(errors[result.status] ?? "Elenco non disponibile.");
    }).catch(() => { if (active) setMessage(errors.unavailable); });
    return () => { active = false; controller.current?.abort(); };
  }, [groupId, registrationId, commandAction]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  async function refresh() {
    const result = await commandAction({ ...scope, action: "read" });
    if (result.status === "queue") { setQueue(result); setSelection([]); }
    else { setFailed(true); setQueue(null); setMessage(errors[result.status] ?? "Elenco non disponibile."); }
  }
  async function run(action: "read" | "print" | "reprint" | "verify", ids = selection) {
    if (lock.current || ((action === "print" || action === "reprint") && !stationReady) || (action !== "read" && !queue)) return;
    lock.current = true; setBusy(true); onBusyChange?.(true); setFailed(false); setMessage("");
    const abort = new AbortController(); controller.current = abort;
    try {
      if (action === "read") { await refresh(); return; }
      const printing = action === "print" || action === "reprint";
      const result = await commandAction({ ...scope, action, ids, snapshot: queue!.snapshot,
        ...(printing ? { requestId: crypto.randomUUID(), profile } : {}) });
      if (result.status === "document") {
        try {
          await printQrLabelDocument(result.html, abort.signal);
          await commandAction({ ...scope, action: "outcome", requestId: result.requestId, outcome: "browser_returned" });
          if (!abort.signal.aborted) setMessage("Comando eseguito nel browser. Verifica ogni etichetta fisica prima di confermarla.");
        } catch {
          await commandAction({ ...scope, action: "outcome", requestId: result.requestId, outcome: "error" }).catch(() => undefined);
          if (!abort.signal.aborted) { setFailed(true); setMessage(errors.unavailable); }
        }
      } else if (result.status !== "queue") { setFailed(true); setMessage(errors[result.status] ?? "Operazione non disponibile."); }
      if (!abort.signal.aborted) await refresh();
    } catch { if (!abort.signal.aborted) { setFailed(true); setQueue(null); setMessage(errors.unavailable); } }
    finally { lock.current = false; onBusyChange?.(false); if (controller.current === abort) controller.current = null; if (!abort.signal.aborted) setBusy(false); }
  }
  const selected = queue?.items.filter(i => selection.includes(i.registrationId)) ?? [];
  const pending = selected.filter(i => !i.reason && i.state === "pending");
  const repeats = selected.filter(i => !i.reason && i.state !== "pending");
  return <section className="grid min-w-0 gap-3 rounded-xl border border-[var(--peace-border)] p-4" aria-label="Etichette QR">
    <h3 className="font-semibold text-[var(--peace-blue-800)]">Etichette QR · collaudo Admin</h3>
    <p className="text-sm">{groupId ? "Solo il gruppo selezionato, sottogruppi esclusi. " : ""}Un’etichetta per QR personale; i figli accompagnati restano sul QR del genitore. Stampa, presenza, preparazione e consegna sono operazioni distinte.</p>
    <p className="text-sm">Usa Chrome configurato per la stampa silenziosa. Verifica prima stampante, rotolo e formato reale del driver; una sola copia, tutte le pagine, scala 100%, margini Nessuno, nessuna intestazione e taglio dopo ogni pagina.</p>
    <label className="grid gap-1 text-sm font-semibold">Profilo della postazione<select className="field font-normal" disabled={busy} value={profile} onChange={e => { setProfile(e.target.value as QrLabelProfile); setStationReady(false); }}>
      <option value="continuous-29x45">Continuo 29 × 45 mm · da calibrare</option><option value="die-cut-29x90">Pretagliato 29 × 90 mm · ritaglio manuale</option>
    </select></label>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" disabled={busy} checked={stationReady} onChange={e => setStationReady(e.target.checked)} /><span>Postazione verificata: Chrome silenzioso, stampante, rotolo caricato e formato reale corrispondono al profilo selezionato.</span></label>
    <button type="button" className="btn-secondary min-h-11 px-3" disabled={busy} onClick={() => void run("read")}>Rileggi la coda condivisa</button>
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    {!queue && !message ? <p role="status">Caricamento dell’elenco…</p> : null}
    {queue ? <>
      <p className="text-sm">{queue.items.length} persone · {queue.items.filter(i => !i.reason).length} QR stampabili · {queue.items.filter(i => i.reason).length} non stampabili. Selezionate: {selected.length}.</p>
      {groupId ? <button type="button" className="btn-secondary min-h-11 px-3" disabled={busy} onClick={() => setSelection(queue.items.filter(i => !i.reason && i.state === "pending").map(i => i.registrationId))}>Seleziona le etichette mai richieste</button> : null}
      <ul className="grid max-h-[45dvh] gap-3 overflow-y-auto">{queue.items.map(item => <li key={item.registrationId} className="grid gap-2 border-t pt-3">
        <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1" disabled={busy || !!item.reason} checked={selection.includes(item.registrationId)} onChange={e => setSelection(ids => e.target.checked ? [...ids,item.registrationId] : ids.filter(id => id !== item.registrationId))} /><span>{item.name} · {item.code}<span className="block text-sm">{item.reason ? reasons[item.reason] ?? "Non stampabile" : item.state === "pending" ? "Mai richiesta" : item.state === "verified" ? "Etichetta preparata · conferma fisica acquisita" : item.outcome === "error" ? "Errore nel comando · esito fisico da verificare" : "Richiesta acquisita · esito fisico da verificare"} · tentativi {item.attempts}</span>{item.changed ? <strong className="block text-sm">Nominativo o QR cambiati: l’etichetta precedente è da aggiornare.</strong> : null}</span></label>
        {!item.reason && item.state !== "pending" ? <div className="flex flex-wrap gap-2">
          {item.state === "prepared" && !item.changed ? <button type="button" disabled={busy} className="btn-secondary min-h-11 px-3" onClick={() => void run("verify", [item.registrationId])}>Confermo questa etichetta fisica</button> : null}
          <button type="button" disabled={busy || !stationReady} className="btn-secondary min-h-11 px-3" onClick={() => void run("reprint", [item.registrationId])}>Ristampa etichetta QR</button>
        </div> : null}
      </li>)}</ul>
      <div className="flex flex-wrap gap-2">
        <ProgressButton progressError={failed} type="button" disabled={busy || !stationReady || !pending.length} aria-busy={busy} className="btn-primary min-h-11 px-4" onClick={() => void run("print", pending.map(i => i.registrationId))}>{busy ? "Operazione in corso…" : groupId ? "Stampa QR del gruppo" : "Stampa etichetta QR"}</ProgressButton>
        {groupId && repeats.length ? <button type="button" disabled={busy || !stationReady} className="btn-secondary min-h-11 px-3" onClick={() => void run("reprint", repeats.map(i => i.registrationId))}>Ristampa solo le {repeats.length} etichette selezionate</button> : null}
      </div>
      <p className="text-sm">Nessuna ristampa automatica dopo un’interruzione. Rileggi la coda, controlla quanto è uscito e seleziona solo le etichette necessarie. La conferma non registra consegne o presenze.</p>
    </> : null}
  </section>;
}
