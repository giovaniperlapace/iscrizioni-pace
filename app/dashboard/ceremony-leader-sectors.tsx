"use client";
import { useEffect, useRef, useState } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import type {
  LeaderTickets,
  PairTicketCommand,
} from "@/lib/ceremonies/leader-tickets";
import { leaderSectorSubjects } from "@/lib/ceremonies/leader-tickets";
import { rebaseLeaderBatch } from "@/lib/ceremonies/leader-batch-retry";
import { Check, Download, LoaderCircle, Ticket, Users, X } from "lucide-react";
import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
import { SECTOR_COPY } from "@/lib/ceremonies/sector-copy";
import {
  subjectKey,
  type LeaderBatchCommand,
} from "@/lib/ceremonies/sector-desk";
import { CeremonyPersonalBadge } from "./ceremony-personal-badge";
import { closingLeaderDownloadTickets, CLOSING_DOWNLOAD_COPY } from "@/lib/ceremonies/closing-leader-download";
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
    [savedNeedsRefresh, setSavedNeedsRefresh] = useState(false),
    [downloading, setDownloading] = useState(false),
    [stale, setStale] = useState(false),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState<Command | null>(null),
    [confirmation, setConfirmation] = useState<{
      command: Command;
      names: string[];
    } | null>(null);
  const busy = useRef(false),
    downloadRequest = useRef<AbortController | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => () => downloadRequest.current?.abort(), []);
  useEffect(() => {
    if (confirmation) dialog.current?.showModal();
  }, [confirmation]);
  const a = view.allocations.find((a) => a.id === allocation),
    blocked = pending || savedNeedsRefresh || downloading || stale || !!uncertain;
  const downloadCopy = CLOSING_DOWNLOAD_COPY[locale];
  const hasClosingTickets = closingLeaderDownloadTickets(view).length > 0;
  async function downloadAll() {
    if (blocked || downloadRequest.current) return;
    const controller = new AbortController();
    downloadRequest.current = controller;
    setDownloading(true);
    setMessage("");
    try {
      const response = await fetch("/dashboard/ceremonies/badges", { cache: "no-store", signal: controller.signal });
      if (response.status === 404) { setMessage(downloadCopy.empty); return; }
      if (!response.ok || !response.headers.get("Content-Type")?.startsWith("application/pdf")) throw Error("download_failed");
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "cerimonia-finale-tutti-i-biglietti.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      if (!controller.signal.aborted) setMessage(c.failure);
    } finally {
      downloadRequest.current = null;
      if (!controller.signal.aborted) setDownloading(false);
    }
  }
  const subjects = a ? leaderSectorSubjects(view, a) : [];
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
      if (savedNeedsRefresh) {
        setSavedNeedsRefresh(false);
        setSelected([]);
        setDecisionPage(0);
        setMessage(c.saved);
        setConfirmation(null);
      }
    } catch {
      setStale(true);
      setMessage(`${savedNeedsRefresh ? c.saved + " " : ""}${c.failure}`);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function execute(command: Command) {
    if (busy.current || savedNeedsRefresh) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    let activeCommand = command;
    async function submit() {
      try {
        return (await ("subjects" in activeCommand
          ? saveMany(activeCommand)
          : save(activeCommand))).status;
      } catch {
        return "unavailable";
      }
    }
    let status = await submit();
    let conflictView: LeaderTickets | null = null;
    if (status === "conflict" && "subjects" in activeCommand) {
      setUncertain(null);
      try {
        conflictView = await refresh();
        setView(conflictView);
        setStale(false);
      } catch {
        setStale(true);
        setMessage(c.failure);
        setConfirmation(null);
        busy.current = false;
        setPending(false);
        return;
      }
      const retry = rebaseLeaderBatch(
        activeCommand, view, conflictView, crypto.randomUUID(),
      );
      if (retry) {
        // One bounded retry after a confirmed rejection. An uncertain result
        // must retain this exact updated command for its idempotent replay.
        activeCommand = retry;
        conflictView = null;
        setConfirmation((current) => current ? { ...current, command: retry } : null);
        status = await submit();
      }
    }
    const outcomeMessage =
      status in t
        ? t[status as keyof typeof t]
        : status in c
          ? c[status as keyof typeof c]
          : c.unavailable;
    if (status === "unavailable") {
      setUncertain(activeCommand);
      setMessage(outcomeMessage);
    } else {
      setUncertain(null);
      if (status === "saved") setSavedNeedsRefresh(true);
      try {
        setView(conflictView ?? await refresh());
        setStale(false);
        setSavedNeedsRefresh(false);
        if (status === "saved") {
          setSelected([]);
          setDecisionPage(0);
        }
        setMessage(outcomeMessage);
        setConfirmation(null);
      } catch {
        setStale(true);
        setMessage(`${status === "saved" ? c.saved + " " : ""}${c.failure}`);
        if (status !== "saved") setConfirmation(null);
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
    setMessage("");
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
  const allocations = view.allocations.filter(
    (item) => !kind || item.kind === kind,
  );
  return (
    <section className="grid min-w-0 gap-4">
      <header className="surface-card grid gap-3 p-5">
        <h1 className="text-xl font-semibold">{kind ? c[kind] : c.title}</h1>
        <p>{t.intro}</p>
        <button
          className="btn-secondary justify-self-start px-4 py-2"
          disabled={pending || downloading || !!uncertain}
          onClick={() => void reload()}
        >
          {c.refresh}
        </button>
        {kind === "closing" && (
          <div className="grid justify-items-start gap-2">
            <button type="button" className="btn-primary inline-flex min-h-11 max-w-full items-center gap-2 px-4 py-2 text-left"
              disabled={blocked || !hasClosingTickets} onClick={() => void downloadAll()}
              aria-describedby="closing-download-help" aria-busy={downloading}>
              <Download size={18} className="shrink-0" aria-hidden="true" />
              <span>{downloading ? downloadCopy.preparing : downloadCopy.download}</span>
            </button>
            <p id="closing-download-help" className="text-sm text-[var(--peace-muted)]">
              {hasClosingTickets ? downloadCopy.help : downloadCopy.empty}
            </p>
            {downloading && <p role="status">{downloadCopy.preparing}</p>}
          </div>
        )}
      </header>
      {message && !confirmation && <p role="status">{message}</p>}
      {uncertain && !confirmation && (
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
      {!allocations.length && <p>{t.empty}</p>}
      {allocations.length > 0 && (
        <fieldset className="surface-card min-w-0 p-5" disabled={blocked}>
          <legend className="px-2 text-lg font-semibold text-[var(--peace-blue-900)]">
            {t.chooseSector}
          </legend>
          <p className="mb-4 text-sm leading-6 text-[var(--peace-muted)]">
            {t.chooseHelp}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {allocations.map((x) => (
              <label
                key={x.id}
                className={`relative flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--peace-blue-500)] ${allocation === x.id ? "border-[var(--peace-blue-700)] bg-[var(--peace-sky-100)]" : "border-[var(--peace-border)] bg-white hover:bg-[var(--peace-soft)]"} ${blocked ? "opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name={`ceremony-allocation-${kind ?? "all"}`}
                  className="mt-1 size-5 shrink-0"
                  aria-label={`${c[x.kind]} · ${x.groupName} · ${t.sector} ${x.sector}`}
                  value={x.id}
                  checked={allocation === x.id}
                  onChange={() => {
                    setAllocation(x.id);
                    setSelected([]);
                    setQuery("");
                    setPage(0);
                    setDecisionPage(0);
                    setMessage("");
                  }}
                />
                <span className="grid min-w-0 flex-1 gap-2">
                  <span className="flex items-center justify-between gap-2 font-semibold text-[var(--peace-blue-900)]">
                    <span className="flex items-center gap-2">
                      <Ticket size={18} aria-hidden="true" />
                      {t.sector} {x.sector}
                    </span>
                    {allocation === x.id && (
                      <Check size={18} aria-hidden="true" />
                    )}
                  </span>
                  <span className="break-words text-sm">
                    {x.groupName}
                    {!kind ? ` · ${c[x.kind]}` : ""}
                  </span>
                  <span className="text-xs text-[var(--peace-muted)]">
                    {t.received}: {x.quantity} · {c.used}: {x.used}
                  </span>
                  <span className="text-sm font-semibold text-[var(--peace-blue-800)]">
                    {c.remaining}: {x.quantity - x.used}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {a && (
        <>
          <section
            className="surface-card grid gap-2 p-5"
            aria-label={t.received}
          >
            <h2 className="text-lg font-semibold">
              {a.groupName} · {t.sector} {a.sector}
            </h2>
            <p className="text-sm text-[var(--peace-muted)]">
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "full",
                timeStyle: "short",
                timeZone: "Europe/Rome",
              }).format(new Date(a.startsAt))}{" "}
              · {a.location}
            </p>
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
          <section
            className="surface-card grid min-w-0 gap-4 p-5"
            aria-label={t.choosePeople}
          >
            <h2 className="text-lg font-semibold text-[var(--peace-blue-900)]">
              {t.choosePeople}
            </h2>
            <p className="text-sm leading-6 text-[var(--peace-muted)]">
              {t.attendanceHelp}
            </p>
            <p className="text-sm text-[var(--peace-muted)]">{c.childHelp}</p>
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
            <div className="divide-y divide-[var(--peace-border)]">
              {rows.map((row) => {
                const choice = row.attendance,
                  existing = personById
                    .get(row.registrationId)
                    ?.assigned.find(
                      (x) => x.planId === a.planId && x.childId === row.childId,
                    );
                return (
                  <article
                    key={subjectKey(row)}
                    aria-label={row.name}
                    className={`flex flex-wrap items-start gap-3 rounded-lg px-3 py-4 ${ids.has(subjectKey(row)) ? "bg-[var(--peace-sky-100)]" : ""}`}
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
                      <span className="min-w-0 break-words">
                        <strong className="text-[var(--peace-blue-900)]">
                          {row.name}
                        </strong>
                        <span className="block text-xs">
                          {row.parent ? `${c.child} · ${row.parent}` : row.code}
                        </span>
                        <span
                          className={`my-1 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${choice === "yes" ? "bg-green-100 text-green-900" : "bg-[var(--peace-soft)] text-[var(--peace-muted)]"}`}
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
            <section
              aria-label={t.recipients}
              className="grid min-w-0 gap-4 rounded-xl border border-[var(--peace-border-strong)] bg-[var(--peace-soft)] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-[var(--peace-blue-900)]">
                    <Users size={20} aria-hidden="true" />
                    {t.recipients}
                  </h3>
                  <p className="mt-1 text-sm">
                    {a.groupName} · {t.sector} {a.sector}
                  </p>
                </div>
                <p
                  className="rounded-full bg-[var(--peace-sky-100)] px-3 py-1.5 text-sm font-semibold text-[var(--peace-blue-800)]"
                  aria-live="polite"
                >
                  {t.selected}: {selected.length} · {c.remaining}:{" "}
                  {a.quantity - a.used}
                </p>
              </div>
              <p className="text-sm leading-6 text-[var(--peace-muted)]">
                {selected.length ? t.selectionHelp : t.selectionEmpty}
              </p>
              {!!selected.length && (
                <ul className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                  {selected.map((person) => (
                    <li
                      key={subjectKey(person)}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[var(--peace-border)] bg-white p-3"
                    >
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-[var(--peace-blue-900)]">
                          {person.name}
                        </p>
                        <p className="text-xs text-[var(--peace-muted)]">
                          {person.childId
                            ? `${c.child} · ${personById.get(person.registrationId)?.name ?? ""}`
                            : personById.get(person.registrationId)?.code}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm"
                        disabled={blocked}
                        onClick={() => toggle(person)}
                        aria-label={`${t.remove} ${person.name}`}
                      >
                        <X size={16} aria-hidden="true" />
                        {t.remove}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selected.length > a.quantity - a.used && (
                <p
                  role="alert"
                  className="text-sm font-semibold text-[var(--peace-danger)]"
                >
                  {t.overCapacity}
                </p>
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
                onClick={() => {
                  setMessage("");
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
                  });
                }}
              >
                {t.confirm}
              </button>
            </section>
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
                    {a.kind === "closing" && n.needsSeat && <CeremonyPersonalBadge nomineeId={n.id} badgeCode={a.badgeCode} name={n.name} locale={locale} />}
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
          closedby={pending || savedNeedsRefresh ? "none" : "closerequest"}
          onKeyDown={(e) => {
            // Repeated Escape presses can bypass the browser's cancel event.
            if (e.key === "Escape" && (busy.current || savedNeedsRefresh)) {
              e.preventDefault();
            }
          }}
          onCancel={(e) => {
            e.preventDefault();
            if (!busy.current && !savedNeedsRefresh) setConfirmation(null);
          }}
          aria-labelledby="leader-sector-confirm"
          aria-busy={pending}
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
            confirmation.command.action === "revoke" && <p>{t.revokeHelp}</p>}
          {pending ? (
            <p role="status" className="flex items-center gap-2">
              <LoaderCircle
                size={20}
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {c.loading}
            </p>
          ) : message && <p role="status">{message}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="btn-primary px-4 py-2"
              disabled={pending}
              onClick={() =>
                void (savedNeedsRefresh ? reload() : execute(confirmation.command))
              }
            >
              {pending
                ? c.loading
                : savedNeedsRefresh
                  ? c.refresh
                  : uncertain
                    ? c.retry
                    : "subjects" in confirmation.command
                      ? t.confirm
                      : confirmation.command.action === "revoke"
                        ? c.confirm
                        : c.noSeat}
            </button>
            <button
              className="btn-secondary px-4 py-2"
              disabled={pending || savedNeedsRefresh}
              onClick={() => {
                if (!busy.current && !savedNeedsRefresh) setConfirmation(null);
              }}
            >
              {t.cancel}
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}
