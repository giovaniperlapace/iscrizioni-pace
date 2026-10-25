"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DeskCommand, SeatsDesk } from "@/lib/ceremonies/seats-desk";
import {
  SECTOR_MESSAGES,
  sectorAssignments,
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
import { CeremonyDraftPanel } from "./ceremony-draft-panel";
import type { DraftCommand, DraftResult } from "@/lib/ceremonies/drafts";
import {
  CeremonyGroupNominalPicker,
  type GroupNominalSelection,
} from "./ceremony-group-nominal-picker";
import { sectorCapacitySummary, type OverbookingCommand } from "@/lib/ceremonies/overbooking";
const attendance = {
  yes: "Presenza confermata",
  no: "Assenza dichiarata",
  unknown: "Presenza da comunicare",
};
type Revocation = {
  command: RevokeAssignment;
  name: string;
  people: string[];
  group: boolean;
  uncertain: boolean;
};
export function CeremonySectorWorkspace({
  initialDesk,
  save,
  revoke,
  manageDrafts,
  setOverbooking,
  read = readCeremonySector,
  loadHistory = readCeremonyHistory,
}: {
  setOverbooking?: (c: OverbookingCommand) => Promise<{ status: string }>;
  initialDesk: SeatsDesk;
  save: (c: DeskCommand) => Promise<{ status: string }>;
  revoke: (c: RevokeAssignment) => Promise<{ status: string }>;
  manageDrafts?: (c: DraftCommand) => Promise<DraftResult>;
  read?: (q: SectorDirectoryQuery) => Promise<SectorReadResult>;
  loadHistory?: (q: HistoryQuery) => Promise<HistoryResult>;
}) {
  const [extra, setExtra] = useState(0);
  const [pendingExtra, setPendingExtra] = useState<OverbookingCommand | null>(null);
  const [extraMessage, setExtraMessage] = useState("");
  const [desk, setDesk] = useState(initialDesk);
  const [sectorId, setSectorId] = useState("");
  const [mode, setMode] = useState<"single" | "group" | "group_nominal">(
    "single",
  );
  const [members, setMembers] = useState<GroupNominalSelection | null>(null);
  const [memberVersion, setMemberVersion] = useState(0);
  const [group, setGroup] = useState("");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [directory, setDirectory] = useState<SectorDirectory | null>(null);
  const [selected, setSelected] = useState<SectorPerson | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [status, setStatus] = useState("");
  const [uncertain, setUncertain] = useState<DeskCommand | null>(null);
  const [revocation, setRevocation] = useState<Revocation | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [nominalOpen, setNominalOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const revokeDialog = useRef<HTMLDialogElement>(null);
  const revokeTrigger = useRef<HTMLElement | null>(null);
  const sequence = useRef(0);
  const busy = useRef(false);
  const sector = desk.sectors.find((s) => s.id === sectorId);
  const capacity = sector ? sectorCapacitySummary(desk, sector.id) : null;
  const groups = desk.groups ?? [];
  const draftSubjects = new Map(
    (desk.drafts ?? []).flatMap((d) =>
      d.subjects.map((s) => [subjectKey(s), d.sector] as const),
    ),
  );
  const groupName = groups.find((g) => g.id === group)?.name;
  const locked = saving || !!pendingExtra || !!uncertain || !!revocation?.uncertain;
  const children = selected?.childId ? [] : (selected?.children ?? []);
  const familyKnown =
    !!selected &&
    (selected.childId !== null || Array.isArray(selected.children));
  const familyAssigned =
    !!selected?.nomineeId ||
    (!!selected && draftSubjects.has(subjectKey(selected))) ||
    children.some((c) => c.nomineeId || draftSubjects.has(c.id));
  const count =
    mode === "single"
      ? selected
        ? 1 + children.length
        : 0
      : mode === "group_nominal"
        ? (members?.people.length ?? 0)
        : quantity;
  const canSave =
    !!sector &&
    !sector.numbered &&
    !loading &&
    !stale &&
    !locked &&
    !revocation &&
    !!directory &&
    Number.isInteger(count) &&
    count > 0 &&
    count <= sector.remaining &&
    (mode === "single"
      ? familyKnown && !familyAssigned
      : mode === "group_nominal"
        ? members?.revision === desk.revision
        : !!groupName);
  const assignments = sectorAssignments(desk, sectorId);
  const totals = desk.sectors.reduce((sum, s) => {
    const c = sectorCapacitySummary(desk, s.id);
    return { physical: sum.physical + (c.physical ?? 0), assigned: sum.assigned + c.assigned, extra: sum.extra + c.extra, remaining: sum.remaining + s.remaining };
  }, { physical: 0, assigned: 0, extra: 0, remaining: 0 });
  useEffect(() => {
    if (sectorId) dialog.current?.showModal();
  }, [sectorId]);
  useEffect(() => {
    if (revocation) {
      if (!revokeDialog.current?.open) revokeDialog.current?.showModal();
    } else if (revokeTrigger.current) {
      const trigger = revokeTrigger.current;
      revokeTrigger.current = null;
      if (trigger.isConnected && !trigger.matches(":disabled"))
        trigger.focus({ preventScroll: true });
      else dialog.current?.focus({ preventScroll: true });
    }
  }, [revocation]);
  function closeRevocation() {
    revokeDialog.current?.close();
    setRevocation(null);
  }
  useEffect(
    () => () => {
      ++sequence.current;
    },
    [],
  );
  const load = useCallback(
    async (nextSearch = applied, page = 1, activeSector = sectorId) => {
      const token = ++sequence.current;
      setLoading(true);
      setStale(true);
      setDirectory(null);
      setSelected(null);
      try {
        const result = await read({
          planId: desk.planId,
          groupId: null,
          withoutGroup: false,
          search: nextSearch,
          page,
        });
        if (token !== sequence.current) return;
        if (result.status !== "loaded" || !result.directory)
          throw Error(result.status);
        setDesk(result.desk);
        setExtra(result.desk.sectors.find(s => s.id === activeSector)?.overbooking ?? 0);
        setDirectory(result.directory);
        setStale(false);
      } catch {
        if (token === sequence.current)
          setStatus(
            "Impossibile aggiornare disponibilità e iscritti. Premi Aggiorna per riprovare.",
          );
      } finally {
        if (token === sequence.current) setLoading(false);
      }
    },
    [desk.planId, applied, read, sectorId],
  );
  function resetForm() {
    setExtraMessage("");
    setMembers(null);
    setMemberVersion((v) => v + 1);
    setMode("single");
    setGroup("");
    setSearch("");
    setApplied("");
    setQuantity(1);
    setSelected(null);
    setDirectory(null);
    setStatus("");
    setRevocation(null);
    setNominalOpen(false);
  }
  function open(id: string) {
    if (busy.current || locked) return;
    resetForm();
    setSectorId(id);
    setExtra(desk.sectors.find(s => s.id === id)?.overbooking ?? 0);
    void load("", 1, id);
  }
  function close() {
    if (busy.current || locked) return;
    ++sequence.current;
    setLoading(false);
    dialog.current?.close();
    setSectorId("");
    resetForm();
  }
  async function submit(command?: DeskCommand) {
    if (busy.current || (!command && !canSave)) return;
    busy.current = true;
    setSaving(true);
    const c: DeskCommand = command ?? {
      planId: desk.planId,
      revision: desk.revision,
      requestId: crypto.randomUUID(),
      data: {
        action: mode === "single" ? "assign_direct" : mode,
        sectorId,
        seatIds: [],
        quantity: count,
        groupId:
          mode === "group"
            ? group
            : mode === "group_nominal"
              ? (members?.groupId ?? null)
              : null,
        subjects:
          mode === "single" && selected
            ? [
                {
                  registrationId: selected.registrationId,
                  childId: selected.childId,
                },
                ...children.map((child) => ({
                  registrationId: selected.registrationId,
                  childId: child.id,
                })),
              ]
            : mode === "group_nominal"
              ? (members?.people ?? []).map(({ registrationId, childId }) => ({
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
    setStatus(
      result === "saved" && manageDrafts
        ? "Bozza salvata. Visibile solo ad Admin e Manager fino alla pubblicazione."
        : (SECTOR_MESSAGES[result] ?? SECTOR_MESSAGES.unavailable),
    );
    if (result === "unavailable") setUncertain(c);
    else {
      setUncertain(null);
      setMembers(null);
      setMemberVersion((v) => v + 1);
      if (result === "saved") {
        setSelected(null);
        setQuantity(1);
        setHistoryVersion((v) => v + 1);
      }
      await load();
    }
    busy.current = false;
    setSaving(false);
  }
  async function saveExtra(retry?: OverbookingCommand) {
    if (!setOverbooking || !sector || busy.current || (!retry && (locked || loading || stale))) return;
    const command = retry ?? { planId: desk.planId, sectorId: sector.id, revision: desk.revision, requestId: crypto.randomUUID(), extra };
    busy.current = true;
    setSaving(true);
    let outcome: string;
    try { outcome = (await setOverbooking(command)).status; } catch { outcome = "unavailable"; }
    if (outcome === "unavailable") {
      setPendingExtra(command);
      setExtraMessage("Esito non verificabile. Riprova la stessa richiesta.");
    } else {
      setPendingExtra(null);
      setExtraMessage(outcome === "saved" ? "Overbooking aggiornato." : outcome === "overbooking_in_use" ? "Questi posti sono già impegnati, anche in bozza. Riduci prima le assegnazioni." : (SECTOR_MESSAGES[outcome] ?? SECTOR_MESSAGES.unavailable));
      await load();
    }
    busy.current = false;
    setSaving(false);
  }
  function prepareRevoke(
    kind: "allocation" | "nominee",
    id: string,
    name: string,
    people: string[] = [],
  ) {
    revokeTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setStatus("");
    setRevocation({
      name,
      people,
      group: kind === "allocation",
      uncertain: false,
      command: {
        planId: desk.planId,
        revision: desk.revision,
        requestId: crypto.randomUUID(),
        kind,
        id,
      },
    });
  }
  async function submitRevoke() {
    if (!revocation || busy.current) return;
    busy.current = true;
    setSaving(true);
    let result: string;
    try {
      result = (await revoke(revocation.command)).status;
    } catch {
      result = "unavailable";
    }
    if (!["saved", "conflict", "forbidden", "invalid"].includes(result)) {
      setRevocation({ ...revocation, uncertain: true });
      setStatus(
        "Esito non verificabile. Riprova la stessa revoca per evitare duplicati.",
      );
    } else {
      closeRevocation();
      setStatus(
        result === "saved" ? "Assegnazione revocata." : SECTOR_MESSAGES[result],
      );
      if (result === "saved") setHistoryVersion((v) => v + 1);
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
        onClick={() => void load(applied, directory.page - 1)}
      >
        Precedente
      </button>
      <button
        className="btn-secondary px-3 py-2"
        type="button"
        disabled={locked || loading || directory.page >= directory.pageCount}
        onClick={() => void load(applied, directory.page + 1)}
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
            {manageDrafts
              ? "Scegli un settore per preparare un’assegnazione in bozza a una persona o a un gruppo."
              : "Scegli un settore per assegnare posti a una persona o a un gruppo."}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary px-4 py-2"
          disabled={locked || loading}
          onClick={() => void load("")}
        >
          Aggiorna disponibilità
        </button>
        <a href="#cronologia-assegnazioni" className="text-sm underline">
          Cronologia e revoche
        </a>
      </div>
      <dl aria-label="Totali cerimonia" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Capienza reale", totals.physical], ["Impegnati, incluse bozze", totals.assigned], ["Overbooking previsto", `+${totals.extra}`], ["Ancora assegnabili", totals.remaining]].map(([label,value]) => <div key={label} className="surface-card p-4"><dt className="text-sm text-slate-600">{label}</dt><dd className="text-2xl font-semibold tabular-nums">{value}</dd></div>)}
      </dl>
      {!sectorId && status && <p role="status">{status}</p>}
      {manageDrafts && (
        <CeremonyDraftPanel
          desk={desk}
          disabled={locked || loading}
          execute={manageDrafts}
          onBusy={setSaving}
          onSaved={async () => {
            setHistoryVersion((v) => v + 1);
            await load();
          }}
        />
      )}
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
          className="m-auto max-h-[90dvh] w-[min(56rem,calc(100%-2rem))] min-w-0 space-y-4 overflow-y-auto rounded-2xl bg-white p-4 text-slate-900 shadow-2xl backdrop:bg-black/50 sm:p-6"
        >
          <header className="sticky -top-4 z-10 -mx-4 -mt-4 flex items-start justify-between gap-3 bg-white p-4 sm:-top-6 sm:-mx-6 sm:-mt-6 sm:p-6">
            <div>
              <h2 id="sector-dialog-title" className="text-xl font-semibold">
                Settore {sector.name}
              </h2>
              <p>
                <strong>{sector.remaining} posti assegnabili</strong>
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
          {capacity && <dl aria-label="Conteggi del settore" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["Capienza reale", capacity.physical ?? "—"], ["Posti ordinari", capacity.base], ["Impegnati, incluse bozze", capacity.assigned], ["Overbooking previsto", `+${capacity.extra}`]].map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--peace-border)] bg-[var(--peace-soft)] p-3"><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd></div>)}
          </dl>}
          {setOverbooking && capacity && !sector.numbered && <section aria-labelledby="overbooking-title" className="grid gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <div><h3 id="overbooking-title" className="font-semibold text-amber-950">Overbooking del settore</h3><p className="mt-1 text-sm text-amber-950">Autorizza posti aggiuntivi oltre i {capacity.base} posti ordinari. La capienza reale resta di {capacity.physical ?? "—"} persone.</p></div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-sm">Posti aggiuntivi autorizzati<input className="field w-36" type="number" min={0} max={10000} step={1} value={Number.isNaN(extra) ? "" : extra} disabled={locked || loading || stale} onChange={e => setExtra(e.target.value === "" ? NaN : Number(e.target.value))}/></label>
              <button className="btn-secondary min-h-11 px-4 py-2" type="button" disabled={locked || loading || stale || !Number.isInteger(extra) || extra < 0 || extra > 10000 || extra === capacity.extra} onClick={() => void saveExtra()}>Salva overbooking</button>
            </div>
            <p className="text-sm">{capacity.usedExtra} posti aggiuntivi impegnati · {capacity.extraRemaining} ancora assegnabili. Totale autorizzato: {capacity.total}.</p>
            <p className="text-sm text-amber-950">Dopo il salvataggio, assegna i posti qui sotto. Le assegnazioni seguono la normale pubblicazione; l’accoglienza vedrà capienza reale, ingressi e overbooking previsto.</p>
            {extraMessage && <p role="status" className="text-sm font-semibold">{extraMessage}</p>}
            {pendingExtra && <button className="btn-primary px-4 py-2" type="button" disabled={saving} onClick={() => void saveExtra(pendingExtra)}>Riprova lo stesso overbooking</button>}
          </section>}
          {sector.numbered && (
            <p role="alert">
              La configurazione per l’assegnazione al settore deve essere
              aggiornata prima di salvare.
            </p>
          )}
          <fieldset
            disabled={locked || !!revocation}
            className="grid min-w-0 gap-4"
            aria-busy={saving || loading}
          >
            <legend className="mb-2 font-semibold">
              {manageDrafts
                ? "Nuova assegnazione in bozza"
                : "Nuova assegnazione"}
            </legend>
            {manageDrafts && (
              <p className="rounded-lg bg-violet-50 p-3 text-sm text-violet-950">
                Il salvataggio crea solo una bozza. Il posto sarà visibile al
                destinatario e notificato via email soltanto dopo la
                pubblicazione dalla piantina.
              </p>
            )}
            <label className="grid gap-1">
              Modalità di assegnazione
              <select
                className="field"
                aria-label="Modalità di assegnazione"
                value={mode}
                onChange={(e) => {
                  setMode(
                    e.target.value as "single" | "group" | "group_nominal",
                  );
                  setMembers(null);
                  setSelected(null);
                  setGroup("");
                  setSearch("");
                  setApplied("");
                  setQuantity(1);
                  setStatus("");
                  void load("");
                }}
              >
                <option value="single">A una persona</option>
                <option value="group">
                  A un gruppo · abbinamento del capogruppo
                </option>
                {manageDrafts && (
                  <option value="group_nominal">
                    Ai membri di un gruppo · assegnazione nominale
                  </option>
                )}
              </select>
            </label>
            {mode === "group_nominal" ? (
              <CeremonyGroupNominalPicker
                key={`${sectorId}-${memberVersion}`}
                desk={desk}
                disabled={locked || !!revocation}
                read={read}
                onDesk={setDesk}
                onSelection={setMembers}
              />
            ) : mode === "group" ? (
              <>
                <label className="grid gap-1">
                  Gruppo
                  <select
                    className="field"
                    aria-label="Gruppo"
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                  >
                    <option value="">Seleziona un gruppo</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  Quantità di posti
                  <input
                    className="field"
                    type="number"
                    min="1"
                    max={sector.remaining}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                </label>
                <p className="text-sm">
                  Il capogruppo potrà abbinare i posti ricevuti ai membri del
                  gruppo.
                </p>
                {groupName && (
                  <p>
                    Verranno assegnati {quantity} posti a {groupName} nel
                    settore {sector.name}.
                  </p>
                )}
              </>
            ) : (
              <>
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setApplied(search);
                    setStatus("");
                    void load(search);
                  }}
                >
                  <label className="grid min-w-0 flex-1 gap-1">
                    Cerca tra tutti i partecipanti
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
                  Scegli una persona. Se ha figli al seguito, la conferma
                  assegna un posto anche a ciascuno di loro.
                </p>
                {!loading && (
                  <>
                    {pagination}
                    <div className="max-h-72 overflow-y-auto divide-y">
                      {directory?.people.map((p) => (
                        <label
                          key={subjectKey(p)}
                          className="flex items-start gap-3 py-3"
                        >
                          <input
                            type="radio"
                            name="ceremony-person"
                            className="mt-1 size-5 shrink-0"
                            aria-label={`Seleziona ${p.name}`}
                            checked={
                              !!selected &&
                              subjectKey(selected) === subjectKey(p)
                            }
                            disabled={
                              !!p.nomineeId ||
                              draftSubjects.has(subjectKey(p)) ||
                              stale
                            }
                            onChange={() => {
                              setSelected(p);
                              setStatus("");
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <strong>{p.name}</strong>
                            {draftSubjects.has(subjectKey(p)) && (
                              <span className="block text-sm font-semibold text-violet-800">
                                In bozza · Settore{" "}
                                {draftSubjects.get(subjectKey(p))}
                              </span>
                            )}
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
                                Settore {p.sector} ·{" "}
                                {p.needsSeat ? "Già assegnato" : "Senza sedia"}
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
                {selected && (
                  <section
                    aria-label="Riepilogo persona"
                    className="rounded-lg border bg-blue-50 p-3"
                  >
                    <p className="font-semibold">
                      {children.length > 0
                        ? `A ${selected.name} verranno assegnati 1 + ${children.length} posti (${count} in totale): un posto per la persona e uno per ciascun figlio al seguito.`
                        : `A ${selected.name} verrà assegnato 1 posto nel settore ${sector.name}.`}
                    </p>
                    {children.length > 0 && (
                      <ul className="mt-2 list-disc pl-5">
                        {children.map((child) => (
                          <li key={child.id}>
                            {child.name}
                            {child.nomineeId
                              ? ` · Già assegnato: settore ${child.sector}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    {familyAssigned && (
                      <p role="alert">
                        Un componente della famiglia ha già un’assegnazione o
                        una bozza. Controlla le assegnazioni esistenti prima di
                        procedere.
                      </p>
                    )}
                    {!familyKnown && (
                      <p role="alert">
                        Impossibile verificare i figli al seguito. Aggiorna i
                        dati prima di assegnare.
                      </p>
                    )}
                  </section>
                )}
              </>
            )}
            {loading && (
              <p role="status">Caricamento persone e assegnazioni…</p>
            )}
            {count > sector.remaining && (
              <p role="alert">
                Posti insufficienti nel settore per questa assegnazione.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn-primary px-4 py-2"
                disabled={!canSave}
                onClick={() => void submit()}
              >
                {saving
                  ? "Salvataggio…"
                  : manageDrafts
                    ? "Salva assegnazione in bozza"
                    : "Conferma assegnazione"}
              </button>
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                disabled={loading}
                onClick={() => {
                  setStatus("");
                  void load();
                }}
              >
                Aggiorna
              </button>
            </div>
          </fieldset>
          {status && (
            <p role="status" className="rounded-lg bg-slate-100 p-3">
              {status}
            </p>
          )}
          {uncertain && (
            <button
              type="button"
              className="btn-primary px-4 py-2"
              disabled={saving}
              onClick={() => void submit(uncertain)}
            >
              {manageDrafts
                ? "Riprova la stessa bozza"
                : "Riprova la stessa assegnazione"}
            </button>
          )}
          {manageDrafts && (
            <CeremonyDraftPanel
              desk={desk}
              sectorId={sectorId}
              disabled={locked || loading || !!revocation}
              execute={manageDrafts}
              onBusy={setSaving}
              onSaved={async () => {
                await load();
              }}
            />
          )}
          <section
            aria-label="Assegnazioni del settore"
            className="space-y-3 border-t pt-4"
          >
            <h3 className="font-semibold">Posti già assegnati nel settore</h3>
            {stale ? (
              <p>
                {loading
                  ? "Aggiornamento assegnazioni…"
                  : "Assegnazioni non aggiornate. Premi Aggiorna."}
              </p>
            ) : (
              <>
                <details
                  key={`${sectorId}-nominal`}
                  open={nominalOpen}
                  onToggle={(e) => setNominalOpen(e.currentTarget.open)}
                  className="rounded-lg border p-3"
                >
                  <summary className="cursor-pointer font-semibold">
                    {assignments.nominalCount}{" "}
                    {assignments.nominalCount === 1
                      ? "posto assegnato nominalmente"
                      : "posti assegnati nominalmente"}
                  </summary>
                  <ul className="mt-2 divide-y">
                    {assignments.nominal.map((n) => (
                      <li
                        key={n.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2"
                      >
                        <span>
                          {n.name}
                          {!n.needsSeat ? " · Senza sedia" : ""}
                        </span>
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2"
                          disabled={locked || !!revocation}
                          aria-label={`Revoca ${n.name}`}
                          onClick={() => prepareRevoke("nominee", n.id, n.name)}
                        >
                          Revoca
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!assignments.nominal.length && (
                    <p className="mt-2 text-sm">
                      Nessuna assegnazione nominale.
                    </p>
                  )}
                </details>
                {assignments.groups.map((a) => (
                  <div key={a.id} className="space-y-2 rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p>
                        <strong>
                          {a.groupName ?? "Gruppo non disponibile"}
                        </strong>{" "}
                        · {a.quantity}{" "}
                        {a.quantity === 1
                          ? "posto assegnato"
                          : "posti assegnati"}
                      </p>
                      <button
                        type="button"
                        className="btn-secondary px-3 py-2"
                        disabled={locked || !!revocation}
                        onClick={() =>
                          prepareRevoke(
                            "allocation",
                            a.id,
                            a.groupName ?? "Gruppo",
                            a.people.map((n) => n.name),
                          )
                        }
                      >
                        Revoca dotazione
                      </button>
                    </div>
                    <p className="text-sm">
                      {a.people.filter((n) => n.needsSeat).length} posti
                      abbinati ·{" "}
                      {a.quantity - a.people.filter((n) => n.needsSeat).length}{" "}
                      ancora da abbinare
                    </p>
                    {a.people.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-sm underline">
                          Persone abbinate al gruppo
                        </summary>
                        <ul className="mt-2 list-disc pl-5">
                          {a.people.map((n) => (
                            <li key={n.id}>
                              {n.name}
                              {!n.needsSeat ? " · Senza sedia" : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ))}
                {!assignments.groups.length && (
                  <p className="text-sm">
                    Nessun posto assegnato a gruppi in questo settore.
                  </p>
                )}
              </>
            )}
          </section>
          {revocation && (
            <dialog
              ref={revokeDialog}
              aria-labelledby="sector-revoke-title"
              aria-describedby="sector-revoke-description"
              onCancel={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="fixed inset-0 m-auto max-h-[80dvh] w-[min(28rem,calc(100%-2rem))] space-y-4 overflow-y-auto rounded-2xl border border-[var(--peace-border)] bg-white p-5 text-[var(--peace-ink)] shadow-2xl backdrop:bg-black/40"
            >
              <h3
                id="sector-revoke-title"
                className="text-lg font-semibold text-[var(--peace-blue-900)]"
              >
                Revocare {revocation.name} nel settore {sector.name}?
              </h3>
              <p id="sector-revoke-description" className="text-sm leading-6">
                {revocation.group
                  ? "Verranno liberati tutti i posti della dotazione e revocate le persone abbinate elencate qui sotto."
                  : "Il posto tornerà disponibile. Le altre assegnazioni della famiglia resteranno invariate."}
              </p>
              {revocation.people.length > 0 && (
                <ul className="max-h-48 overflow-y-auto list-disc pl-5">
                  {revocation.people.map((name, i) => (
                    <li key={i}>{name}</li>
                  ))}
                </ul>
              )}
              {revocation.uncertain && (
                <p role="alert" className="text-sm text-[var(--peace-danger)]">
                  {status}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-primary px-4 py-2"
                  disabled={saving}
                  onClick={() => void submitRevoke()}
                >
                  {revocation.uncertain
                    ? "Riprova la stessa revoca"
                    : "Conferma revoca"}
                </button>
                <button
                  type="button"
                  className="btn-secondary px-4 py-2"
                  disabled={locked}
                  onClick={closeRevocation}
                >
                  Annulla
                </button>
              </div>
            </dialog>
          )}
        </dialog>
      )}
    </div>
  );
}
