"use client";
import { useEffect, useState } from "react";
import type { SeatsDesk } from "@/lib/ceremonies/seats-desk";
import {
  subjectKey,
  type SectorPerson,
  type SectorDirectoryQuery,
  type SectorReadResult,
} from "@/lib/ceremonies/sector-desk";
export type GroupNominalSelection = {
  groupId: string;
  revision: number;
  people: SectorPerson[];
};
export function CeremonyGroupNominalPicker({
  desk,
  disabled,
  read,
  onDesk,
  onSelection,
}: {
  desk: SeatsDesk;
  disabled: boolean;
  read: (q: SectorDirectoryQuery) => Promise<SectorReadResult>;
  onDesk: (desk: SeatsDesk) => void;
  onSelection: (value: GroupNominalSelection | null) => void;
}) {
  const [group, setGroup] = useState("");
  const [people, setPeople] = useState<SectorPerson[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [revision, setRevision] = useState(-1);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!group) return;
    void (async () => {
      const all: SectorPerson[] = [];
      let latest: SeatsDesk | null = null;
      let expected = -1;
      let total = -1;
      for (let page = 1; ; page++) {
        const r = await read({
          planId: desk.planId,
          groupId: group,
          withoutGroup: false,
          search: "",
          page,
        });
        if (cancelled) return;
        if (
          r.status !== "loaded" ||
          !r.directory ||
          r.directory.revision !== r.desk.revision ||
          (expected !== -1 && r.desk.revision !== expected)
        )
          throw Error("changed");
        if (r.directory.total > 10000) throw Error("too_many");
        if (total !== -1 && total !== r.directory.total) throw Error("changed");
        total = r.directory.total;
        expected = r.desk.revision;
        latest = r.desk;
        all.push(...r.directory.people);
        if (page >= r.directory.pageCount) break;
      }
      if (all.length !== total || new Set(all.map(subjectKey)).size !== total)
        throw Error("changed");
      if (latest && !cancelled) {
        onDesk(latest);
        setRevision(expected);
        setPeople(all);
      }
    })()
      .catch(() => {
        if (!cancelled)
          setError(
            "Impossibile caricare l’elenco completo e aggiornato del gruppo. Premi Riprova.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [group, desk.planId, read, onDesk, onSelection, retry]);
  function reset() {
    onSelection(null);
    setSelected([]);
    setPeople([]);
    setSearch("");
    setError("");
    setLoading(true);
  }
  const drafts = new Set(
    (desk.drafts ?? []).flatMap((d) => d.subjects.map(subjectKey)),
  );
  const eligible = people.filter(
    (p) => !p.nomineeId && !drafts.has(subjectKey(p)),
  );
  const adults = eligible.filter((p) => !p.childId),
    minors = eligible.filter((p) => !!p.childId);
  const locked = disabled || loading || !!error || revision !== desk.revision;
  function select(keys: string[]) {
    setSelected(keys);
    onSelection({
      groupId: group,
      revision,
      people: eligible.filter((p) => keys.includes(subjectKey(p))),
    });
  }
  function toggleAll(rows: SectorPerson[], checked: boolean) {
    const keys = new Set(rows.map(subjectKey));
    select(
      checked
        ? [...new Set([...selected, ...keys])]
        : selected.filter((id) => !keys.has(id)),
    );
  }
  const visible = people.filter((p) =>
    `${p.name} ${p.parent ?? ""} ${p.code}`
      .toLocaleLowerCase("it")
      .includes(search.trim().toLocaleLowerCase("it")),
  );
  return (
    <section
      className="grid min-w-0 gap-3"
      aria-label="Membri del gruppo da assegnare"
    >
      <label className="grid gap-1">
        Gruppo
        <select
          className="field"
          aria-label="Gruppo per assegnazione nominale"
          value={group}
          disabled={disabled}
          onChange={(e) => {
            reset();
            setGroup(e.target.value);
            if (!e.target.value) setLoading(false);
          }}
        >
          <option value="">Seleziona un gruppo</option>
          {(desk.groups ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm">
        I nomi selezionati riceveranno direttamente il settore e la notifica
        dopo la pubblicazione. Non sarà necessario l’abbinamento da parte del
        capogruppo. I minori vanno scelti esplicitamente.
      </p>
      {loading && (
        <p role="status">Caricamento di tutti i membri del gruppo…</p>
      )}
      {error && <p role="alert">{error}</p>}
      {group && !loading && (
        <button
          type="button"
          className="btn-secondary w-fit px-3 py-2"
          disabled={disabled}
          onClick={() => {
            reset();
            setRetry((n) => n + 1);
          }}
        >
          {error ? "Riprova" : "Aggiorna membri"}
        </button>
      )}
      {people.length > 0 && !loading && (
        <>
          <label className="grid gap-1">
            Cerca nel gruppo
            <input
              type="search"
              className="field"
              value={search}
              maxLength={200}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="grid gap-2 rounded-lg border border-[var(--peace-border)] p-3">
            <label className="flex items-center gap-3">
              <input
                className="size-5"
                type="checkbox"
                disabled={locked || !adults.length}
                checked={
                  !!adults.length &&
                  adults.every((p) => selected.includes(subjectKey(p)))
                }
                onChange={(e) => toggleAll(adults, e.target.checked)}
              />
              Seleziona tutti i membri adulti disponibili ({adults.length})
            </label>
            {minors.length > 0 && (
              <label className="flex items-center gap-3">
                <input
                  className="size-5"
                  type="checkbox"
                  disabled={locked}
                  checked={minors.every((p) =>
                    selected.includes(subjectKey(p)),
                  )}
                  onChange={(e) => toggleAll(minors, e.target.checked)}
                />
                Includi esplicitamente tutti i minori disponibili (
                {minors.length})
              </label>
            )}
            <p className="text-sm text-[var(--peace-muted)]">
              La selezione collettiva riguarda l’intero gruppo, anche i nomi non
              visibili nella ricerca. Chi ha già un posto o una bozza è escluso.
            </p>
          </div>
          <div className="max-h-72 divide-y overflow-y-auto">
            {visible.map((p) => (
              <label
                key={subjectKey(p)}
                className="flex items-start gap-3 py-3"
              >
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0"
                  aria-label={`Seleziona ${p.name}`}
                  disabled={
                    locked || !!p.nomineeId || drafts.has(subjectKey(p))
                  }
                  checked={selected.includes(subjectKey(p))}
                  onChange={(e) =>
                    select(
                      e.target.checked
                        ? [...selected, subjectKey(p)]
                        : selected.filter((id) => id !== subjectKey(p)),
                    )
                  }
                />
                <span className="min-w-0">
                  <strong>{p.name}</strong>
                  <span className="block text-xs text-[var(--peace-muted)]">
                    {p.childId ? `Minore · ${p.parent}` : p.code}
                  </span>
                  <span
                    className={`block text-sm ${p.attendance === "yes" ? "font-semibold text-emerald-800" : ""}`}
                  >
                    {p.attendance === "yes"
                      ? "Presenza confermata"
                      : p.attendance === "no"
                        ? "Assenza dichiarata"
                        : "Presenza da comunicare"}
                  </span>
                  {p.nomineeId && (
                    <span className="block text-sm">
                      Già assegnato · Settore {p.sector}
                    </span>
                  )}
                  {drafts.has(subjectKey(p)) && (
                    <span className="block text-sm text-violet-800">
                      Già in bozza
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <section
              className="rounded-lg border border-[var(--peace-border)] bg-blue-50 p-3"
              aria-label="Destinatari nominali del gruppo"
            >
              <p className="font-semibold">
                {selected.length} destinatari selezionati
              </p>
              <ul className="mt-2 max-h-48 divide-y overflow-y-auto">
                {eligible
                  .filter((p) => selected.includes(subjectKey(p)))
                  .map((p) => (
                    <li
                      key={subjectKey(p)}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <span>
                        {p.name}
                        {p.childId ? " · Minore" : ""}
                      </span>
                      <button
                        type="button"
                        className="btn-secondary px-3 py-2"
                        disabled={locked}
                        onClick={() =>
                          select(selected.filter((id) => id !== subjectKey(p)))
                        }
                      >
                        Rimuovi
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}
      {group && !loading && !error && !people.length && (
        <p>Nessun membro del gruppo disponibile.</p>
      )}
    </section>
  );
}
