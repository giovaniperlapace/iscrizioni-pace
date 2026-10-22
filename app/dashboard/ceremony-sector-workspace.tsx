"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DeskCommand, SeatsDesk } from "@/lib/ceremonies/seats-desk";
import {
  SECTOR_MESSAGES,
  sectorBudget,
  subjectKey,
  type SectorDirectory,
  type SectorDirectoryQuery,
  type SectorPerson,
  type SectorReadResult,
} from "@/lib/ceremonies/sector-desk";
import type {
  HistoryQuery,
  HistoryResult,
  RevokeAssignment,
} from "@/lib/ceremonies/assignment-history";
import { CeremonySectorMap } from "./ceremony-sector-map";
import { CeremonyAssignmentHistory } from "./ceremony-assignment-history";
import { readCeremonySector } from "./ceremony-sector-read";
import { readCeremonyHistory } from "./ceremony-history-read";
const attendance = {
  yes: "Presenza confermata",
  no: "Assenza dichiarata",
  unknown: "Presenza da comunicare",
};
export function CeremonySectorWorkspace({
  initialDesk,
  save,
  revoke,
  read = readCeremonySector,
  loadHistory = readCeremonyHistory,
}: {
  initialDesk: SeatsDesk;
  save: (c: DeskCommand) => Promise<{ status: string }>;
  revoke: (c: RevokeAssignment) => Promise<{ status: string }>;
  read?: (q: SectorDirectoryQuery) => Promise<SectorReadResult>;
  loadHistory?: (q: HistoryQuery) => Promise<HistoryResult>;
}) {
  const [desk, setDesk] = useState(initialDesk),
    [sectorId, setSectorId] = useState(""),
    [mode, setMode] = useState<"single" | "group">("single"),
    [method, setMethod] = useState<"names" | "quantity">("names");
  const [group, setGroup] = useState(""),
    [search, setSearch] = useState(""),
    [applied, setApplied] = useState(""),
    [quantity, setQuantity] = useState(1);
  const [directory, setDirectory] = useState<SectorDirectory | null>(null),
    [selected, setSelected] = useState<SectorPerson[]>([]),
    [confirmation, setConfirmation] = useState(false);
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [stale, setStale] = useState(false),
    [status, setStatus] = useState(""),
    [uncertain, setUncertain] = useState<DeskCommand | null>(null),
    [historyVersion, setHistoryVersion] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null),
    sequence = useRef(0),
    busy = useRef(false);
  const sector = desk.sectors.find((s) => s.id === sectorId),
    groups = desk.groups ?? [];
  const groupName =
    groups.find((g) => g.id === group)?.name ??
    (group === "none" ? "Senza gruppo" : "Tutti gli iscritti");
  const locked = saving || !!uncertain,
    reserved = sectorBudget(directory, sectorId);
  const count = method === "names" ? selected.length : quantity;
  const canSave =
    !!sector &&
    !sector.numbered &&
    !loading &&
    !stale &&
    !locked &&
    !!directory &&
    count > 0 &&
    Number.isInteger(count) &&
    (method === "names"
      ? count <= sector.remaining + reserved
      : !!group && group !== "none" && quantity <= sector.remaining);
  const selectedIds = new Set(selected.map(subjectKey));
  const selectable = (directory?.people ?? []).filter((p) => !p.nomineeId);
  useEffect(() => {
    if (sectorId) dialog.current?.showModal();
  }, [sectorId]);
  const load = useCallback(
    async (nextGroup = group, nextSearch = applied, page = 1) => {
      const token = ++sequence.current;
      setLoading(true);
      setStale(true);
      setDirectory(null);
      setConfirmation(false);
      try {
        const result = await read({
          planId: desk.planId,
          groupId: nextGroup && nextGroup !== "none" ? nextGroup : null,
          withoutGroup: nextGroup === "none",
          search: nextSearch,
          page,
        });
        if (token !== sequence.current) return;
        if (result.status !== "loaded" || !result.directory)
          throw Error(result.status);
        setDesk(result.desk);
        setDirectory(result.directory);
        setStale(false);
      } catch {
        if (token === sequence.current) {
          setDirectory(null);
          setStatus(
            "Impossibile aggiornare disponibilità e iscritti. Premi Aggiorna per riprovare.",
          );
        }
      } finally {
        if (token === sequence.current) setLoading(false);
      }
    },
    [desk.planId, group, applied, read],
  );
  const open = useCallback(
    (id: string) => {
      setSectorId(id);
      setSelected([]);
      setConfirmation(false);
      setStatus("");
      void load();
    },
    [load],
  );
  function close() {
    if (locked) return;
    ++sequence.current;
    setLoading(false);
    setSectorId("");
    dialog.current?.close();
  }
  function toggle(p: SectorPerson) {
    setConfirmation(false);
    setSelected((prev) =>
      prev.some((s) => subjectKey(s) === subjectKey(p))
        ? prev.filter((s) => subjectKey(s) !== subjectKey(p))
        : mode === "single"
          ? [p]
          : [...prev, p],
    );
  }
  async function submit(command?: DeskCommand) {
    if (busy.current || (!command && !canSave)) return;
    busy.current = true;
    setSaving(true);
    const c = command ?? {
      planId: desk.planId,
      revision: desk.revision,
      requestId: crypto.randomUUID(),
      data: {
        action:
          method === "quantity" ? ("group" as const) : ("assign" as const),
        sectorId,
        seatIds: [],
        quantity: count,
        groupId: group && group !== "none" ? group : null,
        subjects:
          method === "names"
            ? selected.map(({ registrationId, childId }) => ({
                registrationId,
                childId,
              }))
            : [],
      },
    };
    let result: string;
    try {
      result = (await save(c)).status;
    } catch {
      result = "unavailable";
    }
    setStatus(SECTOR_MESSAGES[result] ?? SECTOR_MESSAGES.unavailable);
    if (result === "unavailable") setUncertain(c);
    else {
      setUncertain(null);
      setConfirmation(false);
      if (result === "saved") {
        setSelected([]);
        setQuantity(1);
        setHistoryVersion((v) => v + 1);
      }
      await load();
    }
    busy.current = false;
    setSaving(false);
  }
  const pagination = directory && (
    <nav
      className="flex flex-wrap items-center gap-3 text-sm"
      aria-label="Pagine persone"
    >
      <span>
        {directory.total} persone · Pagina {directory.page} di{" "}
        {directory.pageCount}
      </span>
      <button
        className="btn-secondary px-3 py-2"
        type="button"
        disabled={locked || loading || directory.page <= 1}
        onClick={() => void load(group, applied, directory.page - 1)}
      >
        Precedente
      </button>
      <button
        className="btn-secondary px-3 py-2"
        type="button"
        disabled={locked || loading || directory.page >= directory.pageCount}
        onClick={() => void load(group, applied, directory.page + 1)}
      >
        Successiva
      </button>
    </nav>
  );
  return (
    <div className="ceremony-seats-workspace grid min-w-0 gap-4">
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p>
            {desk.location} · {desk.day.split("-").reverse().join("/")}
          </p>
          <p className="text-sm">
            Scegli un settore per assegnare persone o riservare posti a un
            gruppo.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary px-4 py-2"
          disabled={locked || loading}
          onClick={() => void load()}
        >
          Aggiorna disponibilità
        </button>
        <a href="#cronologia-assegnazioni" className="text-sm underline">
          Cronologia e revoche
        </a>
      </div>
      {!sectorId && status && <p role="status">{status}</p>}
      <CeremonySectorMap desk={desk} onSelect={open} disabled={locked} />
      <CeremonyAssignmentHistory
        planId={desk.planId}
        refreshKey={historyVersion}
        load={loadHistory}
        revoke={async (c) => {
          const r = await revoke(c);
          if (r.status === "saved") await load();
          return r;
        }}
      />
      {sector && (
        <dialog
          ref={dialog}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
          aria-labelledby="sector-dialog-title"
          className="fixed inset-0 z-50 m-auto max-h-[92dvh] w-[min(96vw,65rem)] overflow-y-auto rounded-xl border bg-white p-4 shadow-2xl backdrop:bg-black/35 sm:p-6"
        >
          <header className="sticky -top-4 z-10 -mx-1 mb-4 flex flex-wrap items-center justify-between gap-3 border-b bg-white p-1 pb-3">
            <div>
              <h2 id="sector-dialog-title" className="text-xl font-bold">
                Settore {sector.name}
              </h2>
              <p aria-live="polite">
                <strong>{sector.remaining} posti disponibili</strong>
                {reserved > 0
                  ? ` · ${reserved} già riservati a ${groupName}, da abbinare`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              className="btn-secondary px-4 py-2"
              disabled={locked}
              onClick={close}
            >
              Chiudi
            </button>
          </header>
          {sector.numbered && (
            <p role="alert">
              La configurazione per l’assegnazione al settore deve essere
              aggiornata prima di salvare.
            </p>
          )}
          <fieldset
            disabled={locked}
            className="grid min-w-0 gap-4"
            aria-busy={saving || loading}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                Modalità di assegnazione
                <select
                  aria-label="Modalità di assegnazione"
                  className="field"
                  value={mode}
                  onChange={(e) => {
                    setMode(e.target.value as "single" | "group");
                    setSelected([]);
                    setConfirmation(false);
                  }}
                >
                  <option value="single">Singoli</option>
                  <option value="group">Gruppi</option>
                </select>
              </label>
              <label className="grid gap-1">
                Gruppo
                <select
                  aria-label="Gruppo"
                  className="field"
                  value={group}
                  onChange={(e) => {
                    const g = e.target.value;
                    setGroup(g);
                    setSelected([]);
                    setApplied("");
                    setSearch("");
                    setConfirmation(false);
                    void load(g, "");
                  }}
                >
                  <option value="">Tutti gli iscritti</option>
                  <option value="none">Senza gruppo</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="grid gap-1">
              Come assegnare
              <select
                aria-label="Come assegnare"
                className="field"
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value as "names" | "quantity");
                  setConfirmation(false);
                }}
              >
                <option value="names">Scegli i nomi</option>
                <option value="quantity">Indica solo la quantità</option>
              </select>
            </label>
            {directory && (
              <section
                aria-label="Riepilogo gruppo"
                className="rounded-xl bg-blue-50 p-4 text-sm"
              >
                <h3 className="mb-2 font-semibold">{groupName}</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <p>
                    <strong>{directory.summary.total}</strong> persone iscritte,
                    minori compresi
                  </p>
                  <p>
                    <strong>{directory.summary.assigned}</strong> persone con
                    settore assegnato
                  </p>
                  <p>
                    <strong>{directory.summary.unassigned}</strong> persone
                    ancora da assegnare
                  </p>
                  {directory.summary.withoutSeat > 0 && (
                    <p>
                      <strong>{directory.summary.withoutSeat}</strong> minori
                      senza sedia
                    </p>
                  )}
                </div>
                <p className="mt-2">
                  Il conteggio comprende assegnazioni singole e nomine nelle
                  riserve del gruppo.
                </p>
                {directory.reserves.map((r) => (
                  <p key={r.sectorId} className="mt-2">
                    Settore {r.sector}: {r.quantity} posti riservati · {r.used}{" "}
                    persone assegnate ·{" "}
                    <strong>
                      {r.quantity - r.used} posti ancora da abbinare
                    </strong>
                  </p>
                ))}
              </section>
            )}
            {method === "quantity" ? (
              <div className="grid gap-3">
                <p className="text-sm">
                  Riserva una quantità al gruppo selezionato. Il capogruppo
                  sceglierà poi le persone per questo settore. Per una persona
                  senza gruppo scegli il nome.
                </p>
                <label className="grid gap-1">
                  Quantità di posti
                  <input
                    className="field"
                    type="number"
                    min="1"
                    max={sector.remaining}
                    value={quantity}
                    onChange={(e) => {
                      setQuantity(Number(e.target.value));
                      setConfirmation(false);
                    }}
                  />
                </label>
                {(!group || group === "none") && (
                  <p>Seleziona un gruppo per riservare una quantità.</p>
                )}
              </div>
            ) : (
              <>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setApplied(search);
                    void load(group, search);
                  }}
                >
                  <label className="grid min-w-0 flex-1 gap-1">
                    Cerca persona nel gruppo
                    <input
                      type="search"
                      className="field"
                      maxLength={200}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <button className="btn-primary px-4 py-2" disabled={loading}>
                    Cerca
                  </button>
                </form>
                <p className="text-sm">
                  Tutti gli iscritti attivi sono selezionabili, anche senza
                  presenza confermata. I minori si scelgono esplicitamente. La
                  selezione si conserva tra le pagine.
                </p>
                {loading ? (
                  <p role="status">Caricamento persone…</p>
                ) : (
                  <>
                    {pagination}
                    {mode === "group" && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-5"
                          checked={
                            selectable.length > 0 &&
                            selectable.every((p) =>
                              selectedIds.has(subjectKey(p)),
                            )
                          }
                          disabled={!selectable.length || stale}
                          onChange={(e) => {
                            setConfirmation(false);
                            setSelected((prev) =>
                              e.target.checked
                                ? [
                                    ...prev,
                                    ...selectable.filter(
                                      (p) => !selectedIds.has(subjectKey(p)),
                                    ),
                                  ]
                                : prev.filter(
                                    (p) =>
                                      !selectable.some(
                                        (s) => subjectKey(s) === subjectKey(p),
                                      ),
                                  ),
                            );
                          }}
                        />
                        Seleziona tutte le persone disponibili in questa pagina
                      </label>
                    )}
                    <div className="divide-y">
                      {directory?.people.map((p) => (
                        <label
                          key={subjectKey(p)}
                          className="flex items-start gap-3 py-3"
                        >
                          <input
                            type="checkbox"
                            className="mt-1 size-5 shrink-0"
                            aria-label={`Seleziona ${p.name}`}
                            checked={selectedIds.has(subjectKey(p))}
                            disabled={!!p.nomineeId || stale}
                            onChange={() => toggle(p)}
                          />
                          <span className="min-w-0 flex-1">
                            <strong>{p.name}</strong>
                            <span className="block text-xs text-slate-600">
                              {p.parent ? `Minore · ${p.parent}` : p.code}
                            </span>
                            <span
                              className={`block text-sm ${p.attendance === "yes" ? "font-semibold text-emerald-800" : "text-slate-700"}`}
                            >
                              {attendance[p.attendance]}
                            </span>
                            {p.nomineeId && (
                              <span className="block text-sm font-semibold">
                                Settore {p.sector}
                                {p.needsSeat
                                  ? " · Già assegnato"
                                  : " · Senza sedia"}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                    {directory?.people.length === 0 && (
                      <p>Nessuna persona corrisponde alla ricerca.</p>
                    )}
                    {pagination}
                  </>
                )}
                {!!selected.length && (
                  <section
                    aria-label="Persone selezionate"
                    className="rounded-lg border p-3"
                  >
                    <p className="font-semibold">
                      {selected.length} persone selezionate
                    </p>
                    <ul className="max-h-40 overflow-y-auto">
                      {selected.map((p) => (
                        <li
                          key={subjectKey(p)}
                          className="flex flex-wrap justify-between gap-2 py-1"
                        >
                          {p.name}
                          <button
                            type="button"
                            className="text-sm underline"
                            onClick={() => toggle(p)}
                          >
                            Rimuovi {p.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
            {status && (
              <p role="status" className="rounded-lg bg-slate-100 p-3">
                {status}
              </p>
            )}
            {!uncertain && (
              <button
                type="button"
                className="btn-secondary justify-self-start px-4 py-2"
                disabled={loading}
                onClick={() => void load()}
              >
                Aggiorna
              </button>
            )}
            {confirmation ? (
              <section
                className="space-y-3 rounded-xl border border-blue-300 bg-blue-50 p-4"
                aria-label="Conferma assegnazione"
              >
                <p className="font-semibold">
                  Assegnare {count} posti nel settore {sector.name} a{" "}
                  {groupName}?
                </p>
                {method === "names" ? (
                  <ul className="max-h-48 list-disc overflow-y-auto pl-5">
                    {selected.map((p) => (
                      <li key={subjectKey(p)}>{p.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Il capogruppo completerà l’assegnazione dei nomi.</p>
                )}
                <button
                  type="button"
                  className="btn-primary mr-2 px-4 py-2"
                  disabled={!canSave}
                  onClick={() => void submit()}
                >
                  Conferma assegnazione
                </button>
                <button
                  type="button"
                  className="btn-secondary px-4 py-2"
                  onClick={() => setConfirmation(false)}
                >
                  Annulla
                </button>
              </section>
            ) : (
              <button
                type="button"
                className="btn-primary justify-self-start px-4 py-2"
                disabled={!canSave}
                onClick={() => setConfirmation(true)}
              >
                Verifica e assegna
              </button>
            )}
          </fieldset>
          {uncertain && (
            <div className="mt-4" role="alert">
              <p>{SECTOR_MESSAGES.unavailable}</p>
              <button
                type="button"
                disabled={saving}
                className="btn-primary mt-2 px-4 py-2"
                onClick={() => void submit(uncertain)}
              >
                Riprova la stessa assegnazione
              </button>
            </div>
          )}
        </dialog>
      )}
    </div>
  );
}
