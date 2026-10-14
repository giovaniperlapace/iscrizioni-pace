"use client";
import Link from "@/components/pending-link";
import { SEAT_MAP_COPY } from "@/lib/ceremonies/seat-map-copy";
import { useRef, useState, useTransition } from "react";
import { ProgressButton } from "@/components/button-progress";
import type { SupportedLocale } from "@/lib/i18n/config";
import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
import {
  eligibleSubjects,
  type DistributionView,
  type NomineeCommand,
} from "@/lib/ceremonies/distribution";
type Props = {
  mode?: "manager" | "leader";
  initialView: DistributionView;
  locale: SupportedLocale;
  canManage: boolean;
  save: (command: NomineeCommand) => Promise<{ status: string }>;
  refresh: () => Promise<DistributionView>;
};
export function CeremonyDistribution({
  initialView,
  mode = "leader",
  locale,
  canManage,
  save,
  refresh,
}: Props) {
  const c = DISTRIBUTION_COPY[locale];
  const [view, setView] = useState(initialView),
    [selected, setSelected] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [targets, setTargets] = useState<Record<string, string>>({});
  const [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState<NomineeCommand | null>(null),
    [pending, startTransition] = useTransition();
  const inFlight = useRef(false),
    [reloadRequired, setReloadRequired] = useState(false);
  const a = view.allocations.find((a) => a.id === selected);
  const rows = a
    ? eligibleSubjects(view, a).filter((p) =>
        `${p.name} ${p.code} ${p.parent ?? ""}`
          .toLocaleLowerCase(locale)
          .includes(query.toLocaleLowerCase(locale)),
      )
    : [];
  const decisions = a
    ? view.nominees.filter((n) => n.allocationId === a.id)
    : [];
  const blocked = pending || !!uncertain || reloadRequired;
  const label = (allocation: DistributionView["allocations"][number]) =>
    `${c[allocation.kind]} · ${allocation.groupName ?? c.direct} · ${allocation.sector} · ${allocation.category}`;
  const errorText = (status: string) =>
    status === "seats_active" ? SEAT_MAP_COPY[locale].seats_active : status in c ? c[status as keyof typeof c] : c.unavailable;
  const reload = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    startTransition(async () => {
      try {
        setView(await refresh());
        setReloadRequired(false);
        setMessage(uncertain ? c.unavailable : "");
      } catch {
        setReloadRequired(true);
        setMessage(c.failure);
      } finally {
        inFlight.current = false;
      }
    });
  };
  const execute = (command: NomineeCommand) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setMessage("");
    startTransition(async () => {
      let result: { status: string };
      try {
        result = await save(command);
      } catch {
        result = { status: "unavailable" };
      }
      if (result.status === "unavailable") {
        setUncertain(command);
        setMessage(c.unavailable);
      } else {
        setUncertain(null);
        setMessage(
          result.status === "saved" ? c.saved : errorText(result.status),
        );
        try {
          setView(await refresh());
          setReloadRequired(false);
        } catch {
          setReloadRequired(true);
          setMessage(c.failure);
        }
      }
      inFlight.current = false;
    });
  };
  const act = (
    action: NomineeCommand["action"],
    registrationId: string | null = null,
    childId: string | null = null,
    nomineeId: string | null = null,
    targetId: string | null = null,
  ) => {
    if (!a || blocked) return;
    execute({
      action,
      registrationId,
      childId,
      nomineeId,
      allocationId:
        action === "revoke" ? null : action === "move" ? targetId : a.id,
      revision: a.revision,
      requestId: crypto.randomUUID(),
    });
  };
  return (
    <section className="grid min-w-0 gap-5">
      <div className="surface-card grid gap-4 p-5">
        <h1 className="text-xl font-semibold">{c.title}</h1>
        <p className="text-sm leading-6 text-[var(--peace-muted)]">{c.intro}</p>
        <label className="grid min-w-0 gap-2 font-semibold">
          {c.allocation}
          <select
            className="field w-full min-w-0 font-normal"
            value={a?.id ?? ""}
            disabled={blocked}
            onChange={(e) => {
              setSelected(e.target.value);
              setPage(0);
              setMessage("");
            }}
          >
            <option value="">{c.choose}</option>
            {view.allocations.map((a) => (
              <option key={a.id} value={a.id}>
                {label(a)}
              </option>
            ))}
          </select>
        </label>
        {!view.allocations.length && <p>{c.empty}</p>}
        {a && (
          <>
            <Link className="underline" href={mode === "manager" ? `/dashboard/manager/cerimonie/mappa?kind=${a.kind}` : `/dashboard/capogruppo/cerimonie/mappa?plan=${a.planId}`}>{SEAT_MAP_COPY[locale].title}</Link>
            <p>
              {a.location} ·{" "}
              {a.startsAt
                ? new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Europe/Rome",
                  }).format(new Date(a.startsAt))
                : c.unconfigured}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                [c.quantity, a.quantity],
                [c.used, a.used],
                [c.remaining, a.quantity - a.used],
              ].map(([name, count]) => (
                <div
                  key={name}
                  className="rounded-lg bg-[var(--peace-sky-100)] p-3"
                >
                  <p className="text-sm">{name}</p>
                  <strong className="text-xl tabular-nums">{count}</strong>
                </div>
              ))}
            </div>
          </>
        )}
        <ProgressButton
          type="button"
          className="btn-secondary min-h-11 justify-self-start px-4"
          disabled={pending}
          aria-busy={pending}
          onClick={reload}
        >
          {c.refresh}
        </ProgressButton>
        {!canManage && <p>{c.readOnly}</p>}
        <div role="status" aria-live="polite">
          {pending ? c.loading : message}
        </div>
        {uncertain && (
          <ProgressButton
            type="button"
            className="btn-primary min-h-11 justify-self-start px-4"
            disabled={pending}
            aria-busy={pending}
            onClick={() => execute(uncertain)}
          >
            {c.retry}
          </ProgressButton>
        )}
      </div>
      {a && (
        <>
          <div className="surface-card grid gap-4 p-5">
            <p className="text-sm leading-6">{c.childHelp}</p>
            {a.groupId && (
              <>
                <label className="grid gap-1 font-semibold">
                  {c.search}
                  <input
                    type="search"
                    className="field font-normal"
                    value={query}
                    disabled={pending}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(0);
                    }}
                  />
                </label>
                {!rows.length && <p>{c.none}</p>}
                <div className="divide-y divide-[var(--peace-border)]">
                  {rows.slice(page * 40, page * 40 + 40).map((row) => (
                    <article
                      key={row.childId ?? row.registrationId}
                      className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                      data-child={!!row.childId}
                    >
                      <div>
                        <h2 className="font-semibold">{row.name}</h2>
                        <p className="text-sm text-[var(--peace-muted)]">
                          {row.parent ? `${c.child} · ${row.parent}` : row.code}
                        </p>
                        <p className="text-sm">
                          {row.assigned
                            ? c.assigned
                            : row.eligible
                              ? c.pending
                              : c.ineligible}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex flex-wrap items-center gap-2">
                          <ProgressButton
                            type="button"
                            className="btn-primary min-h-11 px-3"
                            disabled={
                              blocked ||
                              row.assigned ||
                              !row.eligible ||
                              a.state !== "validated" ||
                              a.used >= a.quantity
                            }
                            aria-busy={pending}
                            onClick={() =>
                              act("assign", row.registrationId, row.childId)
                            }
                          >
                            {c.assign}
                          </ProgressButton>
                          {row.childId && (
                            <ProgressButton
                              type="button"
                              className="btn-secondary min-h-11 px-3"
                              disabled={
                                blocked ||
                                row.assigned ||
                                !row.eligible ||
                                a.state !== "validated"
                              }
                              aria-busy={pending}
                              onClick={() =>
                                act("no_seat", row.registrationId, row.childId)
                              }
                            >
                              {c.noSeat}
                            </ProgressButton>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                {rows.length > 40 && (
                  <div className="flex gap-3">
                    <button
                      className="btn-secondary min-h-11 px-3"
                      type="button"
                      disabled={page === 0 || pending}
                      onClick={() => setPage(page - 1)}
                    >
                      {c.previous}
                    </button>
                    <span>
                      {page + 1} / {Math.ceil(rows.length / 40)}
                    </span>
                    <button
                      className="btn-secondary min-h-11 px-3"
                      type="button"
                      disabled={(page + 1) * 40 >= rows.length || pending}
                      onClick={() => setPage(page + 1)}
                    >
                      {c.next}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="surface-card grid gap-4 p-5">
            <h2 className="text-lg font-semibold">{c.nominees}</h2>
            {!decisions.length && <p>{c.personalEmpty}</p>}
            {decisions.map((n) => (
              <article
                key={n.id}
                className="grid gap-3 rounded-xl border border-[var(--peace-border)] p-4"
              >
                <h3 className="font-semibold">
                  {n.name}
                  {n.childId ? ` · ${c.child}` : ""}
                </h3>
                <p>{n.needsSeat ? c.used : c.noSeatState}</p>
                {n.review && (
                  <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                    {c.review}
                  </p>
                )}
                {canManage && (
                  <>
                    <details>
                      <summary className="cursor-pointer py-2 font-semibold">
                        {c.revoke}
                      </summary>
                      <p className="mb-3 text-sm leading-6">{c.revokeHelp}</p>
                      <ProgressButton
                        type="button"
                        className="btn-secondary min-h-11 px-3"
                        disabled={blocked}
                        aria-busy={pending}
                        onClick={() => act("revoke", null, null, n.id)}
                      >
                        {c.confirm}
                      </ProgressButton>
                    </details>
                    <details>
                      <summary className="cursor-pointer py-2 font-semibold">
                        {c.move}
                      </summary>
                      <label className="grid gap-2">
                        {c.allocation}
                        <select
                          className="field min-w-0 w-full"
                          value={targets[n.id] ?? ""}
                          disabled={blocked}
                          onChange={(e) =>
                            setTargets({ ...targets, [n.id]: e.target.value })
                          }
                        >
                          <option value="">{c.choose}</option>
                          {view.allocations
                            .filter(
                              (other) =>
                                other.id !== a.id &&
                                other.planId === a.planId &&
                                other.groupId !== null,
                            )
                            .map((other) => (
                              <option key={other.id} value={other.id}>
                                {label(other)} · {other.quantity - other.used}
                              </option>
                            ))}
                        </select>
                      </label>
                      <ProgressButton
                        type="button"
                        className="btn-primary mt-3 min-h-11 px-3"
                        disabled={blocked || !targets[n.id]}
                        aria-busy={pending}
                        onClick={() =>
                          act("move", null, null, n.id, targets[n.id])
                        }
                      >
                        {c.confirmMove}
                      </ProgressButton>
                    </details>
                  </>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
