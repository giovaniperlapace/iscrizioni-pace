"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, X } from "lucide-react";
import { PendingDownload } from "@/components/pending-download";
import { ProgressButton } from "@/components/button-progress";
import {
  SERVICE_IMPORT_STATUS, serviceImportDetail, serviceImportSummary,
  type ServiceImportResult,
} from "@/lib/service-import/format";

const endpoint = "/dashboard/participants/service-import/api";
type Result = ServiceImportResult & { reportBase64: string | null };

export default function ImportServicesDialog({ closePath }: { closePath: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const busyRef = useRef(false);
  const importId = useRef("");
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [reportUrl, setReportUrl] = useState("");
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  function close() {
    if (!busyRef.current) router.replace(closePath, { scroll: false });
  }
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      document.getElementById("import-services-trigger")?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => () => {
    if (reportUrl) URL.revokeObjectURL(reportUrl);
  }, [reportUrl]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("importId", importId.current);
      const response = await fetch(endpoint, { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Importazione non riuscita.");
      setResult(data as Result);
      if (data.reportBase64) {
        const bytes = Uint8Array.from(atob(data.reportBase64), (character) => character.charCodeAt(0));
        setReportUrl(URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Risposta non disponibile. Riprova con lo stesso file per recuperare l’esito.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const counts = result ? serviceImportSummary(result.rows) : null;
  const rows = result?.rows.filter((row) => !unresolvedOnly || !["updated", "unchanged", "duplicate"].includes(row.status)) ?? [];
  return (
    <dialog ref={ref} aria-labelledby="import-services-title" aria-describedby="import-services-description"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--peace-border)] bg-white p-0 text-[var(--peace-ink)] shadow-[var(--shadow-soft)] backdrop:bg-[rgba(16,36,60,0.52)] open:flex"
      onCancel={(event) => { event.preventDefault(); close(); }}>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--peace-border)] bg-[var(--peace-soft)] p-5 sm:px-6">
        <div>
          <h2 id="import-services-title" className="text-xl font-bold text-[var(--peace-blue-900)]">Importa servizi da Excel</h2>
          <p id="import-services-description" className="mt-1 text-sm text-[var(--peace-muted)]">Assegna servizi ai partecipanti esistenti. Non vengono creati nuovi iscritti.</p>
        </div>
        <button type="button" onClick={close} disabled={busy} aria-label="Chiudi importazione servizi"
          className="btn-secondary inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-white disabled:opacity-50"><X size={20} aria-hidden /></button>
      </div>
      <div className="grid min-h-0 min-w-0 gap-5 overflow-y-auto p-5 sm:p-6">
        <section className="grid gap-3" aria-labelledby="services-prepare-title">
          <h3 id="services-prepare-title" className="font-semibold text-[var(--peace-blue-900)]">1. Prepara il file</h3>
          <p className="text-sm leading-relaxed">Compila nome, cognome e servizio nel foglio Servizi. Il modello contiene il catalogo dei servizi attivi.</p>
          <PendingDownload href={endpoint} filename="modello-servizi.xlsx" className="btn-secondary inline-flex w-fit items-center gap-2 px-4 py-2 text-sm">
            <Download size={18} aria-hidden />Scarica modello Excel servizi
          </PendingDownload>
          <p className="text-sm leading-relaxed text-[var(--peace-muted)]">La ricerca comprende tutte le iscrizioni non eliminate dell’evento corrente, anche fuori dai filtri della tabella. Nome e cognome devono corrispondere, salvo maiuscole e spazi. I nominativi ambigui e quelli non trovati restano senza assegnazione.</p>
          <p className="rounded-xl border border-[var(--peace-border)] bg-[var(--peace-soft)] p-3 text-sm leading-relaxed">Ogni partecipante può avere un solo servizio: quello indicato nel file aggiorna l’eventuale servizio precedente. Nominativi ripetuti con servizi diversi vengono esclusi. I ruoli di accesso al sito restano invariati.</p>
        </section>
        <form onSubmit={submit} className="grid min-w-0 gap-3 border-t border-[var(--peace-border)] pt-4">
          <label htmlFor="services-file" className="font-semibold text-[var(--peace-blue-900)]">2. Scegli il file e attribuisci i servizi</label>
          <p id="services-file-help" className="text-sm text-[var(--peace-muted)]">File .xlsx, massimo 2 MiB e 500 righe. Le righe non risolte saranno elencate nel report.</p>
          <input id="services-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required disabled={busy}
            className="field min-w-0 max-w-full text-sm" aria-describedby="services-file-help" onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              importId.current = crypto.randomUUID();
              setResult(null); setReportUrl(""); setError(""); setUnresolvedOnly(false);
            }} />
          <ProgressButton type="submit" aria-busy={busy} disabled={busy || !file || Boolean(result?.reportBase64)} progressError={Boolean(error)}
            className="btn-primary inline-flex min-h-11 w-fit items-center gap-2 px-4 py-2 text-sm disabled:opacity-50">
            <FileSpreadsheet size={18} aria-hidden />{result?.reportBase64 ? "Importazione completata" : result ? "Recupera report Excel" : "Importa e attribuisci servizi"}
          </ProgressButton>
        </form>
        {busy && <p role="status">Importazione in corso… Attendi il report prima di chiudere.</p>}
        {error && <p role="alert" className="status-error rounded-xl border p-3 text-sm">{error} Puoi riprovare senza cambiare il file.</p>}
        {result && counts && <section aria-labelledby="services-report-title" className="grid min-w-0 gap-4 border-t border-[var(--peace-border)] pt-4">
          <h3 id="services-report-title" className="font-semibold text-[var(--peace-blue-900)]">Report dell’importazione</h3>
          <p role="status">{result.rows.length} righe esaminate · {counts.updated} servizi correttamente attribuiti.{result.replayed ? " Richiesta già elaborata: risultato recuperato senza nuove modifiche." : ""}</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {Object.entries(counts).map(([status, count]) => <div key={status} className="flex justify-between gap-3 rounded-lg bg-[var(--peace-soft)] p-3">
              <dt>{SERVICE_IMPORT_STATUS[status as keyof typeof counts]}</dt><dd className="font-semibold">{count}</dd>
            </div>)}
          </dl>
          {reportUrl ? <a href={reportUrl} download="report-importazione-servizi.xlsx" className="btn-secondary inline-flex min-h-11 w-fit items-center gap-2 px-4 py-2 text-sm"><Download size={18} aria-hidden />Scarica report Excel</a>
            : <p role="alert">Il report è visibile qui sotto. Premi Recupera report Excel per riprovare a scaricarlo.</p>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unresolvedOnly} onChange={(event) => setUnresolvedOnly(event.target.checked)} />Mostra solo i casi da correggere</label>
          <div className="min-w-0 overflow-x-auto rounded-lg border border-[var(--peace-border)]" tabIndex={0} role="region" aria-label="Dettaglio righe importate">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-[var(--peace-soft)]"><tr>{["Riga Excel", "Nome e cognome", "Servizio", "Esito e indicazioni"].map((label) => <th scope="col" className="p-3" key={label}>{label}</th>)}</tr></thead>
              <tbody>{rows.map((row) => <tr key={row.row} className="border-t border-[var(--peace-border)] align-top">
                <td className="p-3">{row.row}</td><td className="max-w-52 break-words p-3">{row.firstName} {row.lastName}</td><td className="max-w-44 break-words p-3">{row.service}</td>
                <td className="max-w-96 p-3"><strong>{SERVICE_IMPORT_STATUS[row.status]}</strong><p className="mt-1 text-[var(--peace-muted)]">{serviceImportDetail(row)}</p></td>
              </tr>)}</tbody>
            </table>
            {!rows.length && <p className="p-3 text-sm">Nessun caso da correggere.</p>}
          </div>
          <p className="text-sm text-[var(--peace-muted)]">Per i casi non risolti, chiudi il report e cerca il nominativo nella gestione iscritti per verificare e correggere la scheda.</p>
        </section>}
      </div>
    </dialog>
  );
}
