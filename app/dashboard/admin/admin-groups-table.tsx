"use client";

import { useState, type ReactNode } from "react";

type Filters = { q: string; eventId: string; nodeType: string; visibility: string };
type GroupRow = {
  id: string;
  eventId: string;
  nodeType: string | null;
  isAssignable: boolean | null;
  isPublicCatalog: boolean | null;
  searchText: string;
  content: ReactNode;
};

export function AdminGroupsTable({ rows, initialFilters, linkCount }: {
  rows: GroupRow[];
  initialFilters: Filters;
  linkCount: number;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const query = filters.q.replace(/\s+/g, " ").trim().toLowerCase();
  const filteredGroups = rows.filter((group) =>
    (filters.eventId === "all" || group.eventId === filters.eventId) &&
    (filters.nodeType === "all" || group.nodeType === filters.nodeType) &&
    (filters.visibility !== "public" || (group.isAssignable && group.isPublicCatalog)) &&
    (filters.visibility !== "reserved" || (group.isAssignable && !group.isPublicCatalog)) &&
    (filters.visibility !== "internal" || !group.isAssignable) &&
    group.searchText.includes(query)
  );

  function updateFilters(next: Filters) {
    setFilters(next);
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries({ groupQ: next.q, groupEvent: next.eventId, groupType: next.nodeType, groupVisibility: next.visibility })) {
      if (!value || value === "all") url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    // Preserve shareable filters without requesting the server page again.
    window.history.replaceState(null, "", url);
  }

  return <>
    <div className="mt-4 grid gap-3 sm:grid-cols-4">
      <EventValue label="Gruppi visibili" value={filteredGroups.length} />
      <EventValue label="Iscrivibili" value={filteredGroups.filter((group) => group.isAssignable).length} />
      <EventValue label="Nel form pubblico" value={filteredGroups.filter((group) => group.isPublicCatalog).length} />
      <EventValue label="Link attivi" value={linkCount} />
    </div>
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--peace-border)] text-xs uppercase tracking-wide text-[#6f7f91]">
            <th className="py-3 pr-4 font-semibold">Nodo</th>
            <th className="py-3 pr-4 font-semibold">Età</th>
            <th className="py-3 pr-4 font-semibold">Referenti</th>
            <th className="py-3 pr-4 font-semibold">Accesso iscrizione</th>
            <th className="py-3 text-right font-semibold">Azioni</th>
          </tr>
          <tr className="border-b border-[var(--peace-border)] bg-[#f7fbfe] align-top">
            <th className="py-3 pr-4">
              <label className="sr-only" htmlFor="admin-group-q">Cerca gruppo</label>
              <input
                id="admin-group-q"
                name="groupQ"
                maxLength={80}
                value={filters.q}
                onChange={(event) => updateFilters({ ...filters, q: event.target.value })}
                className="field min-h-10 bg-white text-sm font-normal"
                placeholder="Nome, referente, label"
              />
            </th>
            <th className="py-3 pr-4">
              <label className="sr-only" htmlFor="admin-group-type">Tipo nodo</label>
              <select
                id="admin-group-type"
                name="groupType"
                value={filters.nodeType}
                onChange={(event) => updateFilters({ ...filters, nodeType: event.target.value })}
                className="field min-h-10 bg-white text-sm font-normal"
              >
                <option value="all">Tutti i tipi</option>
                <option value="country">Paese</option>
                <option value="city">Città</option>
                <option value="area">Area</option>
                <option value="group">Gruppo</option>
                <option value="newcomers">Nuovi partecipanti</option>
              </select>
            </th>
            <th className="py-3 pr-4">
              <label className="sr-only" htmlFor="admin-group-visibility">Accesso iscrizione</label>
              <select
                id="admin-group-visibility"
                name="groupVisibility"
                value={filters.visibility}
                onChange={(event) => updateFilters({ ...filters, visibility: event.target.value })}
                className="field min-h-10 bg-white text-sm font-normal"
              >
                <option value="all">Tutti</option>
                <option value="public">Nel form pubblico</option>
                <option value="reserved">Solo con link</option>
                <option value="internal">Non iscrivibile</option>
              </select>
            </th>
            <th colSpan={2} className="py-3 text-right">
              <div className="flex justify-end gap-2">
                {filters.q ||
                filters.eventId !== "all" ||
                filters.nodeType !== "all" ||
                filters.visibility !== "all" ? (
                  <button
                    type="button"
                    onClick={() => updateFilters({ q: "", eventId: "all", nodeType: "all", visibility: "all" })}
                    className="inline-flex min-h-10 items-center rounded-md border border-[var(--peace-border-strong)] px-3 text-sm font-semibold text-[var(--peace-blue-800)] transition hover:bg-white"
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>{filteredGroups.map((group) => group.content)}</tbody>
      </table>
    </div>
    <p role="status" className="mt-4 text-sm text-[var(--peace-muted)]">
      {filteredGroups.length === 0 ? "Nessun gruppo corrisponde ai filtri correnti." : `${filteredGroups.length} gruppi trovati`}
    </p>
  </>;
}

function EventValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-t border-[var(--peace-border)] pt-3">
      <p className="text-sm text-[var(--peace-muted)]">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

