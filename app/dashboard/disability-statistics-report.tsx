"use client";

import Link from "@/components/pending-link";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { buildAssignedGroupTree, filterStatisticsPeople, serializeStatisticsDrilldown, type StatisticsDrilldownFilter, type StatisticsGroupTreeRow } from "@/lib/registrations/event-statistics";
import { countDeclaredDifficulties, disabilityGroupLabel, disabilityGroupOptions, filterAndSortDisabilityPeople, type DisabilityPeopleFilters, type DisabilityPeopleSort, type DisabilityStatisticsSnapshot } from "@/lib/registrations/disability-statistics";

export function DisabilityStatisticsReport({ statistics, dashboard, navMode }: { statistics: DisabilityStatisticsSnapshot; dashboard: "admin" | "manager"; navMode: "mini" | "full" }) {
  const totals = useMemo(() => countDeclaredDifficulties(statistics.people), [statistics.people]);
  const tree = useMemo(() => buildAssignedGroupTree(statistics.people), [statistics.people]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selection, setSelection] = useState<{ label: string; filter: StatisticsDrilldownFilter } | null>(null);
  const [filters, setFilters] = useState<DisabilityPeopleFilters>({ difficulty: "", group: "", sort: "name", direction: "asc" });
  const showPeople = (next: NonNullable<typeof selection>) => {
    setFilters(current => ({ ...current, difficulty: "", group: "" }));
    setSelection(next);
  };
  const sortBy = (sort: DisabilityPeopleSort) => setFilters(current => ({
    ...current, sort, direction: current.sort === sort && current.direction === "asc" ? "desc" : "asc",
  }));
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const selectedIds = selection ? new Set(filterStatisticsPeople(statistics.people, selection.filter).map(person => person.registrationId)) : null;
  const selectedPeople = selectedIds ? statistics.people.filter(person => selectedIds.has(person.registrationId)) : [];
  const groupOptions = disabilityGroupOptions(selectedPeople);
  const visiblePeople = filterAndSortDisabilityPeople(selectedPeople, filters);
  useEffect(() => {
    if (selection) {
      resultHeading.current?.scrollIntoView({ block: "start" });
      resultHeading.current?.focus({ preventScroll: true });
    }
  }, [selection]);
  const toggle = (key: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const renderRow = (row: StatisticsGroupTreeRow, depth = 0): ReactNode => (
    <Fragment key={row.key}>
      <tr className="border-b border-[var(--peace-border)] last:border-0">
        <th scope="row" className="px-4 py-2 text-left font-medium">
          <div style={{ paddingLeft: Math.min(depth, 6) * 16 }}>
            {row.children.length ? (
              <button type="button" aria-expanded={expanded.has(row.key)} onClick={() => toggle(row.key)} className="flex min-h-11 items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2">
                {expanded.has(row.key) ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronRight size={18} aria-hidden="true" />}
                <span>{row.label}<span className="block text-xs font-normal text-[var(--peace-muted)]">{row.type}</span></span>
              </button>
            ) : <span className="block py-2 pl-[26px]">{row.label}<span className="block text-xs font-normal text-[var(--peace-muted)]">{row.type}</span></span>}
          </div>
        </th>
        <td className="px-4 py-2 text-center">
          <button type="button" className="min-h-11 min-w-11 rounded-md px-3 font-semibold text-[var(--peace-blue-800)] underline underline-offset-4 hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label={`Mostra ${row.people.length} ${row.people.length === 1 ? "persona" : "persone"} con difficoltà dichiarate: ${row.label}`}
            onClick={() => showPeople({ label: row.label, filter: row.filter })}>{row.people.length}</button>
        </td>
      </tr>
      {expanded.has(row.key) ? row.children.map(child => renderRow(child, depth + 1)) : null}
    </Fragment>
  );

  return (
    <div className="grid min-w-0 gap-5">
      <div className="rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <p className="text-sm leading-6 text-[var(--peace-muted)]">
          Persone che hanno dichiarato almeno una delle difficoltà previste dal modulo.
          Ogni persona è contata una volta, anche con più risposte. Le dichiarazioni
          del genitore non sono attribuite ai figli accompagnati.
        </p>
        <dl className="mt-4 grid gap-3 md:grid-cols-3" aria-label="Totali per difficoltà dichiarata">
          {totals.map(({ key, label, count }) => (
            <div key={key} className="flex flex-col rounded-lg border border-[var(--peace-border)] bg-[#f7fbfe] p-4" data-difficulty-total={key}>
              <dt className="text-sm leading-6 text-[var(--peace-muted)]">{label}</dt>
              <dd className="mt-auto pt-2 text-3xl font-semibold tabular-nums text-[var(--peace-blue-800)]">
                <Link href={`/dashboard/${dashboard}?${new URLSearchParams({ section: "iscritti", nav: navMode, stat: serializeStatisticsDrilldown({ difficulty: key }), columns: "name,email,phone,group,accessibility" })}`}
                  prefetch={false} aria-label={`Apri ${count} persone in Gestione iscritti: ${label}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 underline decoration-[#9fc5dc] underline-offset-4 hover:bg-[var(--peace-sky-100)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--peace-blue-800)]">{count}</Link>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-[var(--peace-muted)]">Chi dichiara più difficoltà è incluso in ciascuna categoria: la somma dei contatori può superare il totale delle persone.</p>
        <button type="button" className="btn-primary mt-4" onClick={() => showPeople({ label: "Tutte le persone con difficoltà dichiarate", filter: {} })}>
          Mostra tutte le persone ({statistics.people.length})
        </button>
      </div>
      <div className="min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <h4 className="font-semibold">Paesi, città e gruppi di iscrizione</h4>
        <p className="mt-1 text-sm leading-6 text-[var(--peace-muted)]">Espandi i nodi per vedere i sottogruppi. I totali comprendono i discendenti della gerarchia di iscrizione; non raggruppano per residenza. Seleziona un numero per vedere le persone e le difficoltà dichiarate.</p>
        {tree.length ? <div className="mt-4 overflow-x-auto rounded-md border border-[var(--peace-border)]">
          <table className="w-full text-sm"><thead className="bg-[#f7fbfe]"><tr><th className="px-4 py-3 text-left">Paese / città / gruppo</th><th className="px-4 py-3">Persone</th></tr></thead><tbody>{tree.map(row => renderRow(row))}</tbody></table>
        </div> : <p className="mt-4 text-sm">Nessuna difficoltà dichiarata nelle iscrizioni attive dell’evento.</p>}
      </div>
      {selection ? <section aria-labelledby="disability-result-title" className="min-w-0 rounded-lg border border-[var(--peace-border)] bg-white p-5">
        <h4 id="disability-result-title" ref={resultHeading} tabIndex={-1} className="scroll-mt-28 font-semibold focus:outline-none">{selection.label} · {selectedPeople.length} {selectedPeople.length === 1 ? "persona" : "persone"}</h4>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid min-w-0 flex-1 basis-64 gap-1 text-sm font-medium">
            Tipo di disabilità / difficoltà
            <select className="min-h-11 w-full min-w-0 rounded-md border border-[var(--peace-border)] bg-white px-3 py-2" value={filters.difficulty}
              onChange={event => setFilters(current => ({ ...current, difficulty: event.target.value as DisabilityPeopleFilters["difficulty"] }))}>
              <option value="">Tutte le difficoltà</option>
              {totals.map(({key,label}) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 flex-1 basis-64 gap-1 text-sm font-medium">
            Gruppo di appartenenza
            <select className="min-h-11 w-full min-w-0 rounded-md border border-[var(--peace-border)] bg-white px-3 py-2" value={filters.group}
              onChange={event => setFilters(current => ({ ...current, group: event.target.value }))}>
              <option value="">Tutti i gruppi</option>
              {groupOptions.map(({key,label}) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <button type="button" className="btn-secondary min-h-11" disabled={!filters.difficulty && !filters.group}
            onClick={() => setFilters(current => ({ ...current, difficulty: "", group: "" }))}>Azzera filtri</button>
        </div>
        <p className="mt-3 text-sm text-[var(--peace-muted)]" aria-live="polite">Persone visualizzate: {visiblePeople.length} di {selectedPeople.length}.</p>
        {visiblePeople.length ? <div className="mt-4 overflow-x-auto rounded-md border border-[var(--peace-border)]">
          <table className="w-full min-w-[36rem] text-left text-sm" data-disability-people><thead className="bg-[#f7fbfe]"><tr>{([
            ["name", "Nome e cognome"], ["group", "Gruppo di iscrizione"], ["difficulty", "Disabilità / difficoltà dichiarate"],
          ] as const).map(([key,label]) => <th key={key} scope="col" className="px-4 py-2" aria-sort={filters.sort === key ? filters.direction === "asc" ? "ascending" : "descending" : "none"}>
            <button type="button" className="flex min-h-11 items-center gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => sortBy(key)} aria-label={`Ordina per ${label.toLocaleLowerCase("it")}`}>
              {label}<span aria-hidden="true">{filters.sort === key ? filters.direction === "asc" ? "↑" : "↓" : "↕"}</span>
            </button>
          </th>)}</tr></thead>
            <tbody>{visiblePeople.map(person => <tr key={person.registrationId} className="border-t border-[var(--peace-border)] align-top"><th scope="row" className="px-4 py-3 font-medium">{person.name}</th><td className="px-4 py-3">{disabilityGroupLabel(person)}</td><td className="px-4 py-3">{person.declaredDifficulties}</td></tr>)}</tbody>
          </table>
        </div> : <p className="mt-4 text-sm">Nessuna persona corrisponde ai filtri selezionati.</p>}
      </section> : null}
    </div>
  );
}
