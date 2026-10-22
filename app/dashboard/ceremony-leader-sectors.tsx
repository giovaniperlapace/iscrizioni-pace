"use client";
import { useEffect, useRef, useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import type {
  LeaderTickets,
  PairTicketCommand,
} from "@/lib/ceremonies/leader-tickets";
import { eligibleSubjects } from "@/lib/ceremonies/distribution";
import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
import { SECTOR_COPY } from "@/lib/ceremonies/sector-copy";
import {
  subjectKey,
  type LeaderBatchCommand,
} from "@/lib/ceremonies/sector-desk";
type Subject = { registrationId: string; childId: string | null; name: string };
type Command = LeaderBatchCommand | PairTicketCommand;
export function CeremonyLeaderSectors({
  kind,
  initialView,
  locale,
  save,
  saveMany,
  refresh,
}: {
  kind?: "opening" | "closing";
  initialView: LeaderTickets;
  locale: SupportedLocale;
  save: (c: PairTicketCommand) => Promise<{ status: string }>;
  saveMany: (c: LeaderBatchCommand) => Promise<{ status: string }>;
  refresh: () => Promise<LeaderTickets>;
}) {
  const c = DISTRIBUTION_COPY[locale],
    t = SECTOR_COPY[locale];
  const [view, setView] = useState(initialView),
    [allocation, setAllocation] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [decisionPage, setDecisionPage] = useState(0),
    [selected, setSelected] = useState<Subject[]>([]);
  const [pending, setPending] = useState(false),
    [stale, setStale] = useState(false),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState<Command | null>(null),
    [confirmation, setConfirmation] = useState<{
      command: Command;
      names: string[];
    } | null>(null);
  const busy = useRef(false),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmation) dialog.current?.showModal();
  }, [confirmation]);
  const a = view.allocations.find((a) => a.id === allocation),
    blocked = pending || stale || !!uncertain;
  const subjects = a ? eligibleSubjects(view, a) : [];
  const filtered = subjects.filter((p) =>
    `${p.name} ${p.code} ${p.parent ?? ""}`
      .toLocaleLowerCase(locale)
      .includes(query.toLocaleLowerCase(locale)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 100)),
    currentPage = Math.min(page, pages - 1),
    rows = filtered.slice(currentPage * 100, (currentPage + 1) * 100),
    available = rows.filter((p) => !p.assigned && p.eligible),
    ids = new Set(selected.map(subjectKey));
  const nominees = view.nominees.filter((n) => n.allocationId === a?.id);
  const personById = new Map(view.people.map((p) => [p.registrationId, p]));
  const allAssigned = subjects.filter((s) => s.assigned).length;
  const seated = subjects.filter((s) =>
    personById
      .get(s.registrationId)
      ?.assigned.some(
        (n) => n.planId === a?.planId && n.childId === s.childId && n.needsSeat,
      ),
  ).length;
  async function reload() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      setView(await refresh());
      setStale(false);
    } catch {
      setStale(true);
      setMessage(c.failure);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function execute(command: Command) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    let status: string;
    try {
      status = (
        await ("subjects" in command ? saveMany(command) : save(command))
      ).status;
    } catch {
      status = "unavailable";
    }
    setConfirmation(null);
    setMessage(status in c ? c[status as keyof typeof c] : c.unavailable);
    if (status === "unavailable") setUncertain(command);
    else {
      setUncertain(null);
      if (status === "saved") setSelected([]);
      try {
        setView(await refresh());
        setStale(false);
      } catch {
        setStale(true);
        setMessage(`${status === "saved" ? c.saved + " " : ""}${c.failure}`);
      }
    }
    busy.current = false;
    setPending(false);
  }
  function preparePair(
    action: "revoke" | "no_seat",
    row: Subject | null,
    nomineeId: string | null,
    name: string,
  ) {
    if (!a || blocked) return;
    setConfirmation({
      names: [name],
      command: {
        action,
        allocationId: a.id,
        revision: a.revision,
        requestId: crypto.randomUUID(),
        seatId: null,
        registrationId: row?.registrationId ?? null,
        childId: row?.childId ?? null,
        nomineeId,
      },
    });
  }
  function toggle(s: Subject) {
    setSelected((prev) =>
      prev.some((p) => subjectKey(p) === subjectKey(s))
        ? prev.filter((p) => subjectKey(p) !== subjectKey(s))
        : [...prev, s],
    );
  }
  const allocations = view.allocations.filter((item) => !kind || item.kind === kind);
  return (
    <section className="grid min-w-0 gap-4">
      <header className="surface-card grid gap-3 p-5">
        <h1 className="text-xl font-semibold">{kind ? c[kind] : c.title}</h1>
        <p>{t.intro}</p>
        <button
          className="btn-secondary justify-self-start px-4 py-2"
          disabled={pending || !!uncertain}
          onClick={() => void reload()}
        >
          {c.refresh}
        </button>
      </header>
      {message && <p role="status">{message}</p>}
      {uncertain && (
        <div role="alert">
          <p>{c.unavailable}</p>
          <button
            className="btn-primary px-4 py-2"
            disabled={pending}
            onClick={() => void execute(uncertain)}
          >
            {c.retry}
          </button>
        </div>
      )}
      {!allocations.length && <p>{c.empty}</p>}
      <label className="grid gap-1">
        {c.choose}
        <select
          aria-label={c.choose}
          className="field"
          value={allocation}
          disabled={blocked}
          onChange={(e) => {
            setAllocation(e.target.value);
            setSelected([]);
            setQuery("");
            setPage(0);
            setDecisionPage(0);
          }}
        >
          <option value="">—</option>
          {allocations.map((x) => (
            <option key={x.id} value={x.id}>
              {c[x.kind]} · {x.groupName} · {t.sector} {x.sector} ·{" "}
              {x.quantity - x.used} {c.remaining.toLocaleLowerCase(locale)}
            </option>
          ))}
        </select>
      </label>
      {a && (
        <>
          <section
            className="surface-card grid gap-2 p-5"
            aria-label={c.allocation}
          >
            <h2 className="text-lg font-semibold">
              {a.groupName} · {t.sector} {a.sector}
            </h2>
            <p>
              {c.quantity}: <strong>{a.quantity}</strong> · {c.used}:{" "}
              <strong>{a.used}</strong> · {t.remaining}:{" "}
              <strong>{a.quantity - a.used}</strong>
            </p>
            <p>
              {t.total}: {subjects.length} · {t.assigned}: {seated} ·{" "}
              {t.unassigned}: {subjects.length - allAssigned}
            </p>
            {a.numbered && <p role="alert">{c.unconfigured}</p>}
          </section>
          <section className="surface-card grid gap-4 p-5">
            <p className="text-sm">{c.childHelp}</p>
            <label className="grid gap-1">
              {c.search}
              <input
                className="field"
                type="search"
                value={query}
                disabled={blocked}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                className="size-5"
                type="checkbox"
                disabled={blocked || !available.length || a.numbered}
                checked={
                  !!available.length &&
                  available.every((p) => ids.has(subjectKey(p)))
                }
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked
                      ? [
                          ...prev,
                          ...available.filter((p) => !ids.has(subjectKey(p))),
                        ]
                      : prev.filter(
                          (p) =>
                            !available.some(
                              (s) => subjectKey(p) === subjectKey(s),
                            ),
                        ),
                  )
                }
              />
              {t.all}
            </label>
            <div className="divide-y">
              {rows.map((row) => {
                const person = view.people.find(
                    (p) => p.registrationId === row.registrationId,
                  ),
                  choice =
                    person?.attendance?.find((x) => x.planId === a.planId)
                      ?.choice ?? "unknown",
                  existing = person?.assigned.find(
                    (x) => x.planId === a.planId && x.childId === row.childId,
                  );
                return (
                  <article
                    key={subjectKey(row)}
                    className="flex flex-wrap items-start gap-3 py-3"
                  >
                    <label className="flex min-w-0 flex-1 items-start gap-3">
                      <input
                        className="mt-1 size-5 shrink-0"
                        type="checkbox"
                        aria-label={`${t.select} ${row.name}`}
                        checked={ids.has(subjectKey(row))}
                        disabled={
                          blocked || row.assigned || !row.eligible || a.numbered
                        }
                        onChange={() => toggle(row)}
                      />
                      <span>
                        <strong>{row.name}</strong>
                        <span className="block text-xs">
                          {row.parent ? `${c.child} · ${row.parent}` : row.code}
                        </span>
                        <span
                          className={`block text-sm ${choice === "yes" ? "font-semibold text-emerald-800" : ""}`}
                        >
                          {t[choice]}
                        </span>
                        <span className="block text-sm">
                          {row.assigned
                            ? `${c.assigned}${existing?.sector ? ` · ${t.sector} ${existing.sector}` : ""}`
                            : c.pending}
                        </span>
                      </span>
                    </label>
                    {row.childId && !row.assigned && (
                      <button
                        className="btn-secondary px-3 py-2 text-sm"
                        disabled={blocked}
                        onClick={() =>
                          preparePair("no_seat", row, null, row.name)
                        }
                      >
                        {c.noSeat}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
            {!rows.length && <p>{c.none}</p>}
            <nav className="flex flex-wrap items-center gap-3">
              <button
                className="btn-secondary px-3 py-2"
                disabled={blocked || currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                {c.previous}
              </button>
              <span>
                {t.page} {currentPage + 1} / {pages}
              </span>
              <button
                className="btn-secondary px-3 py-2"
                disabled={blocked || currentPage >= pages - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                {c.next}
              </button>
            </nav>
            <p>
              {t.selected}: <strong>{selected.length}</strong> · {t.remaining}:{" "}
              {a.quantity - a.used}
            </p>
            {!!selected.length && (
              <ul className="max-h-40 overflow-y-auto">
                {selected.map((s) => (
                  <li key={subjectKey(s)}>
                    {s.name}{" "}
                    <button
                      className="underline"
                      disabled={blocked}
                      onClick={() => toggle(s)}
                      aria-label={`${t.cancel} ${s.name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              className="btn-primary justify-self-start px-4 py-2"
              disabled={
                blocked ||
                !selected.length ||
                selected.length > a.quantity - a.used ||
                a.state !== "validated" ||
                a.numbered
              }
              onClick={() =>
                setConfirmation({
                  names: selected.map((s) => s.name),
                  command: {
                    allocationId: a.id,
                    revision: a.revision,
                    requestId: crypto.randomUUID(),
                    subjects: selected.map(({ registrationId, childId }) => ({
                      registrationId,
                      childId,
                    })),
                  },
                })
              }
            >
              {t.confirm}
            </button>
          </section>
          <section className="surface-card grid gap-3 p-5">
            <h2 className="text-lg font-semibold">{c.nominees}</h2>
            {nominees
              .slice(decisionPage * 100, (decisionPage + 1) * 100)
              .map((n) => (
                <article
                  key={n.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t py-3"
                >
                  <div>
                    <strong>{n.name}</strong>
                    <p>
                      {n.needsSeat ? `${t.sector} ${a.sector}` : c.noSeatState}
                    </p>
                    {n.review && <p>{c.review}</p>}
                  </div>
                  <button
                    className="btn-secondary px-4 py-2"
                    disabled={blocked}
                    onClick={() => preparePair("revoke", null, n.id, n.name)}
                  >
                    {c.revoke}
                  </button>
                </article>
              ))}
            {nominees.length > 100 && (
              <nav className="flex gap-3">
                <button
                  className="btn-secondary px-3 py-2"
                  disabled={blocked || decisionPage === 0}
                  onClick={() => setDecisionPage((p) => p - 1)}
                >
                  {c.previous}
                </button>
                <button
                  className="btn-secondary px-3 py-2"
                  disabled={
                    blocked || (decisionPage + 1) * 100 >= nominees.length
                  }
                  onClick={() => setDecisionPage((p) => p + 1)}
                >
                  {c.next}
                </button>
              </nav>
            )}
          </section>
        </>
      )}
      {confirmation && (
        <dialog
          ref={dialog}
          onCancel={(e) => {
            e.preventDefault();
            if (!pending) setConfirmation(null);
          }}
          aria-labelledby="leader-sector-confirm"
          className="fixed inset-0 z-50 m-auto max-h-[80dvh] w-[min(92vw,36rem)] overflow-y-auto rounded-xl border bg-white p-6 shadow-xl backdrop:bg-black/40"
        >
          <h2 id="leader-sector-confirm" className="text-lg font-semibold">
            {"subjects" in confirmation.command
              ? t.confirm
              : confirmation.command.action === "revoke"
                ? c.confirm
                : c.noSeat}
          </h2>
          <p className="my-3">
            {t.sector} {a?.sector}
          </p>
          <ul className="my-3 max-h-60 list-disc overflow-y-auto pl-5">
            {confirmation.names.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
          {"action" in confirmation.command &&
            confirmation.command.action === "revoke" && <p>{c.revokeHelp}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="btn-primary px-4 py-2"
              disabled={pending}
              onClick={() => void execute(confirmation.command)}
            >
              {"subjects" in confirmation.command
                ? t.confirm
                : confirmation.command.action === "revoke"
                  ? c.confirm
                  : c.noSeat}
            </button>
            <button
              className="btn-secondary px-4 py-2"
              disabled={pending}
              onClick={() => setConfirmation(null)}
            >
              {t.cancel}
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}
