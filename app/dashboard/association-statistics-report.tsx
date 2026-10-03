"use client";

import { useId, useState } from "react";
import type { AssociationStatisticsSnapshot } from "@/lib/registrations/association-statistics";

export function AssociationStatisticsReport({ statistics }: { statistics: AssociationStatisticsSnapshot }) {
  const [open, setOpen] = useState(false);
  const tableId = useId();
  return (
    <article className="min-w-0 max-w-full rounded-lg border border-[var(--peace-border)] bg-white p-5">
      <h3 className="text-base font-semibold">Appartenenza ad associazioni</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">
        Partecipanti che hanno compilato il campo «Fai parte di qualche associazione?».
        Seleziona il numero per vedere nomi, presenze previste e associazioni dichiarate.
      </p>
      <button type="button" aria-expanded={open} aria-controls={tableId}
        onClick={() => setOpen(value => !value)}
        aria-label={`${open ? "Chiudi" : "Apri"} elenco: ${statistics.people.length} partecipanti con associazione indicata`}
        className="mt-4 flex min-h-16 items-center gap-4 rounded-lg border border-[var(--peace-border)] bg-[#f7fbfe] p-4 text-left hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-2">
        <span className="text-2xl font-semibold tabular-nums text-[var(--peace-blue-800)] underline underline-offset-4">{statistics.people.length}</span>
        <span className="text-sm">Partecipanti con associazione indicata</span>
      </button>
      <div id={tableId} hidden={!open} className="mt-5">
        {statistics.people.length ? (
          <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-[var(--peace-border)]" tabIndex={0} role="region" aria-label="Elenco partecipanti con associazione indicata">
            <table className="w-full min-w-[38rem] table-fixed text-left text-sm">
              <caption className="sr-only">Partecipanti, presenze previste e associazione dichiarata</caption>
              <thead className="bg-[#f7fbfe]"><tr>
                {['Nome e cognome', 'Presenze previste', 'Associazione dichiarata'].map(label => <th key={label} scope="col" className="px-4 py-3 font-semibold">{label}</th>)}
              </tr></thead>
              <tbody>{statistics.people.map(person => <tr key={person.registrationId} className="border-t border-[var(--peace-border)] align-top">
                <th scope="row" className="break-words px-4 py-3 font-medium">{person.name}</th>
                <td className="break-words px-4 py-3">{person.attendance}</td>
                <td className="whitespace-pre-wrap break-words px-4 py-3">{person.association}</td>
              </tr>)}</tbody>
            </table>
          </div>
        ) : <p className="text-sm text-[var(--peace-muted)]">Nessun partecipante ha indicato un’associazione.</p>}
      </div>
    </article>
  );
}
