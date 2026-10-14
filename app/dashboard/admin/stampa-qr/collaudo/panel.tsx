"use client";
import { useEffect, useRef, useState } from "react";
import { printQrLabelDocument } from "@/lib/qrcode/print-client";
import type { QrLabelProfile } from "@/lib/qrcode/print-label-profile";
export function CalibrationPanel({ documents }: { documents: { profile: QrLabelProfile; id: string; name: string; count: number; html: string }[] }) {
  const [profile, setProfile] = useState<QrLabelProfile>("continuous-29x45");
  const [configured, setConfigured] = useState(false), [singleChecked, setSingleChecked] = useState(false);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function print(html: string) {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort; setBusy(true); setMessage("");
    try { await printQrLabelDocument(html, abort.signal); if (!abort.signal.aborted) setMessage("Comando eseguito nel browser. Attendi e verifica quantità, misure, taglio, nome, QR e codice. L’esito fisico è ancora da confermare."); }
    catch { if (!abort.signal.aborted) setMessage("Esito da verificare. Controlla la stampante prima di una ristampa esplicita."); }
    finally { controller.current = null; if (!abort.signal.aborted) setBusy(false); }
  }
  return <section className="grid gap-4 rounded-xl border p-4">
    <label className="grid gap-1 font-semibold">Profilo fisico<select value={profile} disabled={busy} className="field" onChange={e => { setProfile(e.target.value as QrLabelProfile); setConfigured(false); setSingleChecked(false); }}><option value="continuous-29x45">Continuo 29 × 45 mm</option><option value="die-cut-29x90">Pretagliato 29 × 90 mm</option></select></label>
    <ol className="list-decimal space-y-2 pl-5 text-sm"><li>Conferma con chi ha la stampante modello, collegamento, codice consumabile, larghezza e rotolo caricato. DK-22210 è il codice acquistato; montaggio ancora da verificare.</li><li>Calibra prima senza stampa silenziosa: scegli la Brother e il formato realmente esposto dal driver, {profile === "continuous-29x45" ? "29 × 45 mm" : "29 × 90 mm"}, verticale, una copia, tutte le pagine, margini Nessuno, scala 100%, nessuna intestazione/piè di pagina. Seleziona taglio dopo ogni pagina nelle opzioni Brother. Il solo inserimento delle dimensioni nelle preferenze Chrome non basta.</li><li>Annulla il dialogo per conservare le impostazioni senza stampare. Riapri e verifica formato e numero di pagine. Riavvia poi il profilo dedicato Chrome con stampa silenziosa. Il sito non può configurarla.</li><li>Stampa una sola etichetta, misura larghezza/lunghezza e QR (nero atteso circa 16,8 mm), verifica i quattro moduli bianchi, allineamento, avanzamento e taglio. Leggi il QR con Pixel e iPhone senza aprire lo scanner accoglienza.</li></ol>
    <label className="flex gap-3"><input type="checkbox" disabled={busy} checked={configured} onChange={e => setConfigured(e.target.checked)} /><span>Ho verificato rotolo e configurazione della postazione con chi esegue la prova.</span></label>
    {documents.filter(d => d.profile === profile && d.count === 1).map(d => <button key={d.id} type="button" disabled={!configured || busy} className="btn-primary min-h-11 px-4 text-left" onClick={() => void print(d.html)}>Stampa una sola etichetta · {d.name}</button>)}
    <label className="flex gap-3"><input type="checkbox" disabled={!configured || busy} checked={singleChecked} onChange={e => setSingleChecked(e.target.checked)} /><span>L’operatore ha confermato una singola etichetta corretta, misure, taglio e lettura su entrambi i telefoni.</span></label>
    {documents.filter(d => d.profile === profile && d.count > 1).map(d => <button key={d.id} type="button" disabled={!configured || !singleChecked || busy} className="btn-secondary min-h-11 px-4" onClick={() => void print(d.html)}>Stampa lotto sintetico · {d.count} etichette con QR diversi</button>)}
    {message ? <p role="status">{message}</p> : null}
    <p className="text-sm">Raccogli per ogni prova: computer/sistema/Chrome, stampante e driver, consumabile caricato, formato reale, copie richieste e uscite, misure, taglio, leggibilità e lettura dei QR distinti. La spunta serve soltanto a guidare questa prova; non aggiorna il registro condiviso dei badge.</p>
  </section>;
}
