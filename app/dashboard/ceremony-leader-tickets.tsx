"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
import { SEAT_MAP_COPY } from "@/lib/ceremonies/seat-map-copy";
import { LEADER_TICKETS_COPY } from "@/lib/ceremonies/leader-tickets-copy";
import { eligibleSubjects } from "@/lib/ceremonies/distribution";
import { ceremonySeatLabel } from "@/lib/ceremonies/seat-label";
import type {
  LeaderTickets,
  PairTicketCommand,
} from "@/lib/ceremonies/leader-tickets";

export function CeremonyLeaderTickets({
  initialView,
  locale,
  save,
  refresh,
}: {
  initialView: LeaderTickets;
  locale: SupportedLocale;
  save: (c: PairTicketCommand) => Promise<{ status: string }>;
  refresh: () => Promise<LeaderTickets>;
}) {
  const c = DISTRIBUTION_COPY[locale],
    t = LEADER_TICKETS_COPY[locale];
  const [view, setView] = useState(initialView),
    [allocation, setAllocation] = useState("");
  const [ticket, setTicket] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [ticketQuery, setTicketQuery] = useState("");
  const [page, setPage] = useState(0),
    [ticketPage, setTicketPage] = useState(0),
    [decisionPage, setDecisionPage] = useState(0);
  const [confirmation, setConfirmation] = useState<{
    command: PairTicketCommand;
    label: string;
  } | null>(null);
  const [uncertain, setUncertain] = useState<PairTicketCommand | null>(null),
    [stale, setStale] = useState(false),
    [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition(),
    busy = useRef(false),
    peopleRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmation) dialogRef.current?.showModal();
  }, [confirmation]);
  const a = view.allocations.find((x) => x.id === allocation),
    blocked = pending || !!uncertain || stale;
  const decisions = view.nominees.filter((n) => n.allocationId === a?.id);
  const tickets = view.tickets.filter((x) => x.allocationId === a?.id);
  const assigned = new Set(
    view.tickets.flatMap((x) => (x.nomineeId ? [x.nomineeId] : [])),
  );
  const nomineeById = new Map(view.nominees.map((n) => [n.id, n]));
  const seatText = (s: LeaderTickets["tickets"][number]["seat"]) =>
    ceremonySeatLabel(a?.sector ?? "", s, locale);
  const chosen = tickets.find((x) => x.seat.id === ticket && !x.nomineeId);
  const ticketLabel = chosen ? seatText(chosen.seat) : t.unnumbered;
  const filteredTickets = tickets.filter((x) =>
    `${seatText(x.seat)} ${nomineeById.get(x.nomineeId ?? "")?.name ?? ""}`
      .toLocaleLowerCase(locale)
      .includes(ticketQuery.toLocaleLowerCase(locale)),
  );
  const rows = a
    ? eligibleSubjects(view, a)
        .map((row) => {
          const existing = decisions.find(
            (n) =>
              n.registrationId === row.registrationId &&
              n.childId === row.childId,
          );
          const incomplete = !!(
            a.numbered &&
            existing?.needsSeat &&
            !assigned.has(existing.id)
          );
          return {
            ...row,
            incomplete,
            eligible: row.eligible && !existing?.review,
            assigned: row.assigned && !incomplete,
          };
        })
        .filter((row) =>
          `${row.name} ${row.code} ${row.parent ?? ""}`
            .toLocaleLowerCase(locale)
            .includes(query.toLocaleLowerCase(locale)),
        )
    : [];
  const canPair =
    !!a &&
    a.state === "validated" &&
    (a.numbered ? !!chosen : ticket === "unnumbered" && a.used < a.quantity);
  const errorText = (status: string) =>
    status === "occupied"
      ? SEAT_MAP_COPY[locale].occupied
      : status in c
        ? c[status as keyof typeof c]
        : c.unavailable;
  function reload() {
    if (busy.current) return;
    busy.current = true;
    startTransition(async () => {
      try {
        setView(await refresh());
        setStale(false);
        setConfirmation(null);
        setTicket(null);
        setMessage(uncertain ? c.unavailable : "");
      } catch {
        setStale(true);
        setMessage(c.failure);
      } finally {
        busy.current = false;
      }
    });
  }
  function execute(command: PairTicketCommand) {
    if (busy.current) return;
    busy.current = true;
    setMessage("");
    startTransition(async () => {
      let status: string;
      try {
        status = (await save(command)).status;
      } catch {
        status = "unavailable";
      }
      if (status === "unavailable") {
        setConfirmation(null);
        setUncertain(command);
        setMessage(c.unavailable);
      } else {
        setUncertain(null);
        setConfirmation(null);
        setTicket(null);
        setMessage(status === "saved" ? c.saved : errorText(status));
        try {
          setView(await refresh());
          setStale(false);
        } catch {
          setStale(true);
          setMessage(`${status === "saved" ? c.saved + " " : ""}${c.failure}`);
        }
      }
      busy.current = false;
    });
  }
  function prepare(
    action: PairTicketCommand["action"],
    registrationId: string | null,
    childId: string | null,
    nomineeId: string | null,
    label: string,
  ) {
    if (!a || blocked) return;
    setConfirmation({
      label,
      command: {
        action,
        allocationId: a.id,
        revision: a.revision,
        requestId: crypto.randomUUID(),
        registrationId,
        childId,
        nomineeId,
        seatId:
          action === "assign" && a.numbered ? (chosen?.seat.id ?? null) : null,
      },
    });
  }
  function chooseTicket(id: string) {
    setTicket(id);
    setConfirmation(null);
    setQuery("");
    setPage(0);
    // The member picker remains mounted so focus follows the explicit choice.
    requestAnimationFrame(() => {
      peopleRef.current?.focus();
      peopleRef.current?.scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
  }
  function pagination(
    total: number,
    current: number,
    set: (page: number) => void,
  ) {
    const last = Math.max(0, Math.ceil(total / 100) - 1),
      safe = Math.min(current, last);
    return total > 100 ? (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn-secondary min-h-11 px-3"
          disabled={blocked || safe === 0}
          onClick={() => set(safe - 1)}
        >
          {c.previous}
        </button>
        <span>
          {safe + 1} / {last + 1}
        </span>
        <button
          type="button"
          className="btn-secondary min-h-11 px-3"
          disabled={blocked || safe === last}
          onClick={() => set(safe + 1)}
        >
          {c.next}
        </button>
      </div>
    ) : null;
  }
  const slice = <T,>(items: T[], index: number) =>
    items.slice(
      Math.min(index, Math.max(0, Math.ceil(items.length / 100) - 1)) * 100,
      Math.min(index, Math.max(0, Math.ceil(items.length / 100) - 1)) * 100 +
        100,
    );
  return (
    <section className="grid min-w-0 gap-5">
      <header className="surface-card grid gap-4 p-5">
        <h1 className="text-xl font-semibold">{c.title}</h1>
        <p>{t.intro}</p>
        <label className="grid gap-2">
          {c.allocation}
          <select
            aria-label={c.allocation}
            className="field min-w-0 w-full"
            value={a?.id ?? ""}
            disabled={blocked}
            onChange={(e) => {
              setAllocation(e.target.value);
              setTicket(null);
              setConfirmation(null);
              setQuery("");
              setTicketQuery("");
              setPage(0);
              setTicketPage(0);
              setDecisionPage(0);
              setMessage("");
            }}
          >
            <option value="">{c.choose}</option>
            {view.allocations.map((x) => (
              <option key={x.id} value={x.id}>
                {c[x.kind]} · {x.groupName} · {x.sector}
              </option>
            ))}
          </select>
        </label>
        {!view.allocations.length && <p>{c.empty}</p>}
        {a && (
          <>
            <p>
              {a.location}
              {a.startsAt && (
                <>
                  {" "}
                  ·{" "}
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Europe/Rome",
                  }).format(new Date(a.startsAt))}
                </>
              )}
            </p>
            <dl className="grid grid-cols-3 gap-3">
              {[
                [c.quantity, a.quantity],
                [c.used, a.used],
                [c.remaining, a.quantity - a.used],
              ].map(([name, count]) => (
                <div
                  key={name}
                  className="rounded-lg bg-[var(--peace-sky-100)] p-3"
                >
                  <dt className="text-sm">{name}</dt>
                  <dd className="text-xl font-semibold">{count}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <button
          type="button"
          className="btn-secondary min-h-11 justify-self-start px-4"
          disabled={pending}
          onClick={reload}
        >
          {c.refresh}
        </button>
        <p role="status">{pending ? c.loading : message}</p>
        {uncertain && (
          <button
            type="button"
            className="btn-primary min-h-11 justify-self-start px-4"
            disabled={pending}
            onClick={() => execute(uncertain)}
          >
            {c.retry}
          </button>
        )}
      </header>
      {a && (
        <>
          <section
            className="surface-card grid min-w-0 gap-4 p-5"
            aria-label={t.tickets}
          >
            <h2 className="text-lg font-semibold">{t.tickets}</h2>
            {a.numbered ? (
              <>
                <label className="grid gap-1">
                  {t.searchTickets}
                  <input
                    type="search"
                    className="field min-w-0"
                    value={ticketQuery}
                    disabled={blocked}
                    onChange={(e) => {
                      setTicketQuery(e.target.value);
                      setTicketPage(0);
                    }}
                  />
                </label>
                {!tickets.length && <p>{t.awaiting}</p>}
                <div className="divide-y">
                  {slice(filteredTickets, ticketPage).map((x) => (
                    <article
                      key={x.seat.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                      aria-label={seatText(x.seat)}
                    >
                      <div>
                        <p className="font-semibold">{seatText(x.seat)}</p>
                        <p>
                          {x.nomineeId
                            ? `${t.paired} ${nomineeById.get(x.nomineeId)?.name ?? c.assigned}`
                            : SEAT_MAP_COPY[locale].free}
                        </p>
                      </div>
                      {!x.nomineeId && (
                        <button
                          type="button"
                          className="btn-primary min-h-11 px-4"
                          disabled={blocked || a.state !== "validated"}
                          aria-pressed={ticket === x.seat.id}
                          onClick={() => chooseTicket(x.seat.id)}
                        >
                          {t.pair}
                        </button>
                      )}
                    </article>
                  ))}
                </div>
                {pagination(filteredTickets.length, ticketPage, setTicketPage)}
              </>
            ) : (
              <>
                <p>
                  {t.unnumbered} · {c.remaining}: {a.quantity - a.used}
                </p>
                <button
                  type="button"
                  className="btn-primary min-h-11 justify-self-start px-4"
                  disabled={
                    blocked || a.used >= a.quantity || a.state !== "validated"
                  }
                  onClick={() => chooseTicket("unnumbered")}
                >
                  {t.pair}
                </button>
              </>
            )}
          </section>
          <div
            ref={peopleRef}
            tabIndex={-1}
            className="surface-card grid min-w-0 scroll-mt-24 gap-4 p-5"
            aria-label={t.choose}
          >
            <h2 className="text-lg font-semibold">{t.choose}</h2>
            {ticket !== null && (
              <p>
                {t.selected}: {ticketLabel}
              </p>
            )}
            <p>{c.childHelp}</p>
            <label className="grid gap-1">
              {c.search}
              <input
                type="search"
                className="field min-w-0"
                value={query}
                disabled={blocked}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </label>
            {!rows.length && <p>{c.none}</p>}
            <div className="divide-y">
              {slice(rows, page).map((row) => (
                <article
                  key={row.childId ?? row.registrationId}
                  aria-label={row.name}
                  className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div>
                    <h3 className="font-semibold">{row.name}</h3>
                    <p>
                      {row.parent ? `${c.child} · ${row.parent}` : row.code}
                    </p>
                    <p>
                      {row.incomplete
                        ? t.pendingSeat
                        : row.assigned
                          ? c.assigned
                          : !row.eligible
                            ? c.ineligible
                            : c.pending}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="btn-primary min-h-11 px-4"
                      disabled={
                        blocked || !canPair || row.assigned || !row.eligible
                      }
                      onClick={() =>
                        prepare(
                          "assign",
                          row.registrationId,
                          row.childId,
                          null,
                          `${ticketLabel} → ${row.name}`,
                        )
                      }
                    >
                      {t.pair}
                    </button>
                    {row.childId && (
                      <button
                        type="button"
                        className="btn-secondary min-h-11 px-3"
                        disabled={
                          blocked ||
                          row.assigned ||
                          row.incomplete ||
                          !row.eligible ||
                          a.state !== "validated"
                        }
                        onClick={() =>
                          prepare(
                            "no_seat",
                            row.registrationId,
                            row.childId,
                            null,
                            `${row.name} · ${c.noSeatState}`,
                          )
                        }
                      >
                        {c.noSeat}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {pagination(rows.length, page, setPage)}
          </div>
          <section
            className="surface-card grid gap-4 p-5"
            aria-label={c.nominees}
          >
            <h2 className="text-lg font-semibold">{c.nominees}</h2>
            {!decisions.length && <p>{c.personalEmpty}</p>}
            {slice(decisions, decisionPage).map((n) => {
              const seat = tickets.find((x) => x.nomineeId === n.id)?.seat;
              return (
                <article
                  key={n.id}
                  aria-label={n.name}
                  className="grid gap-2 rounded-lg border p-3"
                >
                  <h3 className="font-semibold">
                    {n.name}
                    {n.childId ? ` · ${c.child}` : ""}
                  </h3>
                  <p>
                    {!n.needsSeat
                      ? c.noSeatState
                      : seat
                        ? seatText(seat)
                        : a.numbered
                          ? t.pendingSeat
                          : t.unnumbered}
                  </p>
                  {n.review && <p className="bg-amber-50 p-2">{c.review}</p>}
                  <button
                    type="button"
                    className="btn-secondary min-h-11 justify-self-start px-4"
                    disabled={blocked}
                    onClick={() =>
                      prepare(
                        "revoke",
                        null,
                        null,
                        n.id,
                        `${n.name} · ${seat ? seatText(seat) : n.needsSeat ? t.unnumbered : c.noSeatState}`,
                      )
                    }
                  >
                    {t.remove}
                  </button>
                </article>
              );
            })}
            {pagination(decisions.length, decisionPage, setDecisionPage)}
          </section>
        </>
      )}
      {confirmation && (
        <dialog
          ref={dialogRef}
          onCancel={(e) => {
            e.preventDefault();
            if (!pending) setConfirmation(null);
          }}
          className="fixed inset-0 z-50 m-auto max-h-[80vh] w-[min(90vw,36rem)] overflow-auto rounded-xl border bg-white p-6 shadow-2xl backdrop:bg-black/40"
          aria-labelledby="pair-confirm-title"
        >
          <h2 id="pair-confirm-title" className="text-lg font-semibold">
            {confirmation.command.action === "revoke" ? t.remove : t.confirm}
          </h2>
          <p className="my-4">{confirmation.label}</p>
          {confirmation.command.action === "revoke" && <p>{t.removeHelp}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="btn-primary min-h-11 px-4"
              disabled={blocked}
              onClick={() => execute(confirmation.command)}
            >
              {confirmation.command.action === "revoke" ? c.confirm : t.confirm}
            </button>
            <button
              type="button"
              className="btn-secondary min-h-11 px-4"
              disabled={pending || !!uncertain}
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
