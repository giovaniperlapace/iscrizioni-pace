"use client";
import { ProgressButton } from "@/components/button-progress";
import { useEffect, useRef, useState } from "react";
import { qrLabelCommand } from "./participants/qr/labels/actions";
import { printQrLabelDocument } from "@/lib/qrcode/print-client";
import type { LabelCommand, LabelQueue, LabelResult, LabelScope } from "@/lib/reception/qr-labels";
import type { QrLabelProfile } from "@/lib/qrcode/print-label-profile";
const errors: Record<string, string> = {
  forbidden: "La stampa è disponibile solo agli Admin. Verifica il tuo accesso.",
  unavailable: "Non è stato possibile completare l’operazione. Controlla le etichette uscite e aggiorna l’elenco prima di riprovare.",
  migration_required: "La stampa non è ancora disponibile. Contatta il responsabile.",
  conflict: "L’elenco è cambiato. Aggiornalo e controlla quali etichette stampare.",
  replayed: "Queste etichette sono già state richieste. Controlla quelle uscite e aggiorna l’elenco.",
};
const reasons: Record<string, string> = { identity: "Codice partecipante mancante", deleted: "Iscrizione eliminata", cancelled: "Iscrizione annullata", inactive: "Iscrizione non attiva", missing: "QR mancante", revoked: "QR non più valido", expired: "QR scaduto", layout_or_qr: "Nome o QR non adatto all’etichetta: contatta il responsabile" };
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
          if (!abort.signal.aborted) setMessage("Controlla le etichette uscite dalla stampante, poi conferma quelle corrette.");
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
    <h3 className="font-semibold text-[var(--peace-blue-800)]">Stampa etichette QR</h3>
    <p className="text-sm">{groupId ? "Un’etichetta per ogni persona di questo gruppo, senza sottogruppi. I figli accompagnati sono inclusi nel QR del genitore. " : ""}La stampa non registra l’ingresso all’evento.</p>
    <label className="grid gap-1 text-sm font-semibold">Carta nella stampante<select className="field font-normal" disabled={busy} value={profile} onChange={e => { setProfile(e.target.value as QrLabelProfile); setStationReady(false); }}>
      <option value="continuous-29x45">Rotolo continuo · etichetta 29 × 45 mm</option><option value="die-cut-29x90">Etichette pretagliate · 29 × 90 mm</option>
    </select></label>
    <details className="text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">Come configurare la stampante</summary>
      <p>Usa Chrome configurato per la stampa silenziosa. Controlla che la stampante scelta, il rotolo caricato e il formato di stampa corrispondano alla carta indicata sopra.</p>
      <p className="mt-2">Impostazioni: una copia, tutte le pagine, scala 100%, margini Nessuno, intestazioni e piè di pagina disattivati, taglio dopo ogni etichetta. Le etichette pretagliate da 90 mm richiedono il ritaglio manuale.</p>
    </details>
    <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" disabled={busy} checked={stationReady} onChange={e => setStationReady(e.target.checked)} /><span>Ho controllato la stampante, la carta e le impostazioni di stampa.</span></label>
    <button type="button" className="btn-secondary min-h-11 justify-self-start px-3" disabled={busy} onClick={() => void run("read")}>Aggiorna elenco</button>
    {message ? <p role={failed ? "alert" : "status"} className="text-sm">{message}</p> : null}
    {!queue && !message ? <p role="status">Caricamento dell’elenco…</p> : null}
    {queue ? <>
      {groupId ? <>
        <p className="text-sm">Persone: {queue.items.length} · Etichette disponibili: {queue.items.filter(i => !i.reason).length} · Non stampabili: {queue.items.filter(i => i.reason).length}. Selezionate: {selected.length}.</p>
        <button type="button" className="btn-secondary min-h-11 justify-self-start px-3" disabled={busy} onClick={() => setSelection(queue.items.filter(i => !i.reason && i.state === "pending").map(i => i.registrationId))}>Seleziona quelle da stampare</button>
      </> : null}
      {!queue.items.length ? <p className="text-sm">Non ci sono iscrizioni da mostrare.</p> : null}
      <ul className="grid max-h-[45dvh] gap-3 overflow-y-auto">{queue.items.map(item => <li key={item.registrationId} className="grid gap-2 border-t pt-3">
        <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1" disabled={busy || !!item.reason} checked={selection.includes(item.registrationId)} onChange={e => setSelection(ids => e.target.checked ? [...ids,item.registrationId] : ids.filter(id => id !== item.registrationId))} /><span>{item.name}{item.code ? ` · ${item.code}` : ""}<span className="block text-sm">{item.reason ? reasons[item.reason] ?? "Non stampabile" : item.state === "pending" ? "Da stampare" : item.state === "verified" ? "Etichetta confermata" : "Controlla l’etichetta"}</span>{item.changed ? <strong className="block text-sm">Nome o QR aggiornato: ristampa questa etichetta.</strong> : null}</span></label>
        {!item.reason && item.state !== "pending" ? <div className="flex flex-wrap gap-2">
          {item.state === "prepared" && !item.changed ? <button type="button" disabled={busy} className="btn-secondary min-h-11 px-3" onClick={() => void run("verify", [item.registrationId])}>Conferma etichetta</button> : null}
          <button type="button" disabled={busy || !stationReady} className="btn-secondary min-h-11 px-3" onClick={() => void run("reprint", [item.registrationId])}>Ristampa etichetta QR</button>
        </div> : null}
      </li>)}</ul>
      <div className="flex flex-wrap gap-2">
        <ProgressButton progressError={failed} type="button" disabled={busy || !stationReady || !pending.length} aria-busy={busy} className="btn-primary min-h-11 px-4" onClick={() => void run("print", pending.map(i => i.registrationId))}>{busy ? "Operazione in corso…" : groupId ? "Stampa i QR del gruppo" : "Stampa etichetta QR"}</ProgressButton>
        {groupId && repeats.length ? <button type="button" disabled={busy || !stationReady} className="btn-secondary min-h-11 px-3" onClick={() => void run("reprint", repeats.map(i => i.registrationId))}>Ristampa solo le {repeats.length} etichette selezionate</button> : null}
      </div>
      <p className="text-sm">Conferma solo le etichette uscite correttamente. Se la stampa si interrompe, aggiorna l’elenco e ristampa solo quelle mancanti o rovinate.</p>
    </> : null}
  </section>;
}
