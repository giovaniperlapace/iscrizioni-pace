import { Download, FileSpreadsheet } from "lucide-react";
import { PendingDownload } from "@/components/pending-download";
import { PRESENCE_EXPORTS } from "@/lib/presence-exports/catalog";
import { presenceConfigForEvent } from "@/lib/presence-exports/config";

export function ExportsSection({ eventId }: { eventId: string | null }) {
  const available = Boolean(eventId && presenceConfigForEvent(eventId));
  return <section className="surface-card min-w-0 p-5 sm:p-6" aria-labelledby="exports-title">
    <div className="mb-6 grid gap-2">
      <h2 id="exports-title" className="text-xl font-bold">Esportazioni</h2>
      <p className="max-w-3xl text-sm leading-6 text-[var(--peace-muted)]">Scarica le presenze per gruppo in Excel, pronte per la stampa. Ogni file contiene i dati dell’evento corrente, con subtotali per zona, totale generale, date non indicate e data e ora di estrazione.</p>
      <p className="text-sm leading-6 text-[var(--peace-muted)]">I totali includono i figli accompagnati, che restano nel gruppo d’iscrizione anche nei report con i servizi. Il foglio Raccordo permette di controllare gruppi, raggruppamenti e tag.</p>
    </div>
    {!available ? <p role="status" className="text-sm">{eventId ? "Il raccordo delle esportazioni deve essere configurato per questo evento." : "Nessun evento corrente disponibile."}</p> :
      <div className="grid gap-4 xl:grid-cols-2">
        {PRESENCE_EXPORTS.map(report => <article key={report.key} className="flex min-w-0 flex-col gap-3 rounded-lg border border-[var(--peace-border)] p-5">
          <div className="flex items-start gap-3">
            <FileSpreadsheet aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-[var(--peace-blue-800)]" />
            <div><p className="text-xs font-bold uppercase tracking-wide text-[var(--peace-muted)]">Report {report.code}</p><h3 className="mt-1 font-bold">{report.title}</h3></div>
          </div>
          <p className="text-sm leading-6 text-[var(--peace-muted)]">{report.description}</p>
          <div className="mt-auto grid justify-items-start gap-2 pt-2">
            <PendingDownload href={`/dashboard/manager/esportazioni?report=${report.key}&event=${encodeURIComponent(eventId!)}`} filename={`presenze_${report.key}.xlsx`} className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm" aria-label={`Scarica Excel report ${report.code}`}>
              <Download aria-hidden="true" className="h-4 w-4" />Scarica Excel
            </PendingDownload>
          </div>
        </article>)}
      </div>}
  </section>;
}
