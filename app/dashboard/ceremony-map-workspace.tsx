"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { ProgressButton } from "@/components/button-progress";
import { ReliableForm } from "@/components/reliable-form";
import type { SupportedLocale } from "@/lib/i18n/config";
import { SEAT_MAP_COPY } from "@/lib/ceremonies/seat-map-copy";
import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
import {
  contiguousSeats,
  type SeatMapView,
  type SeatMapCommand,
  type MapSeat,
} from "@/lib/ceremonies/seat-map";
import { CeremonySeatMap } from "./ceremony-seat-map";
import { CeremonyMapEditor } from "./ceremony-map-editor";
const EMPTY_MAP_SEATS: MapSeat[] = [];
export function CeremonyMapWorkspace({
  initialView,
  locale,
  admin = false,
  manager = false,
  canManage,
  save,
  refresh,
}: {
  initialView: SeatMapView;
  locale: SupportedLocale;
  admin?: boolean;
  manager?: boolean;
  canManage: boolean;
  save: (c: SeatMapCommand) => Promise<{ status: string }>;
  refresh: (id: string) => Promise<SeatMapView>;
}) {
  const c = SEAT_MAP_COPY[locale],
    dc = DISTRIBUTION_COPY[locale];
  const [view, setView] = useState(initialView),
    [allocation, setAllocation] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [nominee, setNominee] = useState(""),
    [count, setCount] = useState(2),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState<SeatMapCommand | null>(null),
    [stale, setStale] = useState(false),
    [confirm, setConfirm] = useState<"release" | "unname" | null>(null),
    [pending, startTransition] = useTransition();
  const busy = useRef(false),
    statusRef = useRef<HTMLParagraphElement>(null);
  const a = view.allocations.find((a) => a.id === allocation),
    seats = view.active?.seats ?? EMPTY_MAP_SEATS;
  const claims = useMemo(
    () => new Map(view.claims.map((c) => [c.seatId, c])),
    [view.claims],
  );
  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  const allocationById = useMemo(
    () => new Map(view.allocations.map((a) => [a.id, a])),
    [view.allocations],
  );
  const claimByNominee = useMemo(
    () =>
      new Map(
        view.claims.filter((c) => c.nomineeId).map((c) => [c.nomineeId!, c]),
      ),
    [view.claims],
  );
  const directNames = useMemo(
    () =>
      new Map(
        view.nominees
          .filter((n) => !n.childId)
          .map((n) => [n.allocationId, n.name]),
      ),
    [view.nominees],
  );
  const namedIds = new Set(
    view.claims.flatMap((c) => (c.nomineeId ? [c.nomineeId] : [])),
  );
  const blocked = pending || !!uncertain || stale;
  const selectedClaims = selected.map((id) => claims.get(id));
  const mine =
    !!a &&
    selected.length > 0 &&
    selectedClaims.every((x) => x?.allocationId === a.id);
  const free =
    !!a &&
    selected.length > 0 &&
    selected.every(
      (id) => !claims.has(id) && seatById.get(id)?.sectorId === a.sectorId,
    );
  const selectedNames = mine && selectedClaims.some((x) => x?.nomineeId);
  const text = (s: string) =>
    s === "occupied"
      ? c.occupied
      : s in c
        ? c[s as keyof typeof c]
        : c.unavailable;
  const reload = () => {
    if (busy.current) return;
    busy.current = true;
    startTransition(async () => {
      try {
        setView(await refresh(view.planId));
        setStale(false);
        setSelected([]);
        setConfirm(null);
        setMessage(uncertain ? c.unavailable : "");
      } catch {
        setStale(true);
        setMessage(c.failure);
      } finally {
        busy.current = false;
      }
    });
  };
  const execute = (command: SeatMapCommand): Promise<boolean> =>
    new Promise((resolve) => {
      if (busy.current) {
        resolve(false);
        return;
      }
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
          setUncertain(command);
          setMessage(c.unavailable);
        } else {
          setUncertain(null);
          setMessage(text(status));
          setConfirm(null);
          if (status === "saved") setSelected([]);
          try {
            setView(await refresh(view.planId));
            setStale(false);
          } catch {
            setStale(true);
            setMessage(c.failure);
          }
        }
        busy.current = false;
        statusRef.current?.focus();
        resolve(status === "saved");
      });
    });
  const command = (
    change:
      | { operation: "draft"; data: { title: string; seats: MapSeat[] } }
      | { operation: "publish"; data: { versionId: string } },
  ) =>
    execute({
      ...change,
      planId: view.planId,
      revision: view.revision,
      requestId: crypto.randomUUID(),
    });
  const act = (operation: "reserve" | "release" | "name" | "unname") => {
    if (!a || blocked) return;
    return execute({
      planId: view.planId,
      revision: view.revision,
      requestId: crypto.randomUUID(),
      operation,
      data: {
        allocationId: a.id,
        seatIds: selected,
        ...(operation === "name" ? { nomineeId: nominee } : {}),
      },
    });
  };
  const names = view.nominees.filter(
    (n) => n.allocationId === a?.id && n.needsSeat,
  );
  return (
    <section className="ceremony-map-workspace grid min-w-0 gap-5">
      <style>{`@media print { body * { visibility: hidden; } .ceremony-seat-print, .ceremony-seat-print * { visibility: visible; } .ceremony-seat-print { position:absolute;left:0;top:0;width:100%;background:white; } .ceremony-seat-print tr { break-inside:avoid; } }`}</style>
      <header>
        <h1 className="text-2xl font-semibold">
          {c.title} · {dc[view.kind]}
        </h1>
        <p className="mt-2">{c.intro}</p>
      </header>
      <div className="surface-card grid min-w-0 gap-3 p-5">
        {view.active ? (
          <h2 className="text-lg font-semibold">
            {view.active.title} · {c.version} {view.active.version}
          </h2>
        ) : (
          <p>{c.empty}</p>
        )}
        <p ref={statusRef} tabIndex={-1} role="status" aria-live="polite">
          {pending ? c.loading : message}
        </p>
        <div className="flex flex-wrap gap-3">
          <ProgressButton
            type="button"
            className="btn-secondary min-h-11 px-3"
            disabled={pending}
            onClick={reload}
          >
            {c.refresh}
          </ProgressButton>
          {uncertain && (
            <ProgressButton
              type="button"
              className="btn-primary min-h-11 px-3"
              disabled={pending}
              onClick={() => execute(uncertain)}
            >
              {c.retry}
            </ProgressButton>
          )}
        </div>
        {!canManage && <p>{c.readOnly}</p>}
        <label className="grid min-w-0 gap-2">
          {c.allocation}
          <select
            className="field w-full min-w-0"
            disabled={blocked}
            value={allocation}
            onChange={(e) => {
              setAllocation(e.target.value);
              setSelected([]);
              setNominee("");
              setConfirm(null);
            }}
          >
            <option value="">{c.choose}</option>
            {view.allocations.map((a) => (
              <option key={a.id} value={a.id}>
                {a.groupName ?? directNames.get(a.id) ?? dc.direct} · {a.sector}{" "}
                · {a.category}
              </option>
            ))}
          </select>
        </label>
        {a && (
          <>
            <p>
              {c.remaining}:{" "}
              {a.quantity -
                view.claims.filter((x) => x.allocationId === a.id).length}{" "}
              / {a.quantity} · {c.pendingPeople}:{" "}
              {names.filter((n) => !namedIds.has(n.id)).length}
            </p>
            <p>
              {a.location} · {a.sector} · {a.category}
            </p>
          </>
        )}
      </div>
      {view.active && (
        <div className="surface-card grid min-w-0 gap-4 p-5">
          <CeremonySeatMap
            seats={seats}
            sectors={view.sectors}
            claims={view.claims}
            allocationId={allocation}
            selected={selected}
            onSelect={(id) => {
              setSelected((s) =>
                s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
              );
              setConfirm(null);
            }}
            disabled={blocked || !canManage || !a}
            locale={locale}
          />
          <p>
            {c.selected}: {selected.length}
          </p>
          {canManage && (
            <>
              <button
                className="btn-secondary min-h-11 justify-self-start px-3"
                disabled={blocked}
                onClick={() => {
                  setSelected([]);
                  setConfirm(null);
                }}
              >
                {c.clear}
              </button>
              {manager && (
                <ReliableForm
                  locale={locale}
                  className="flex flex-wrap items-end gap-3"
                  action={async () => {
                    if (!a) return;
                    const available = new Set(
                      seats
                        .filter(
                          (s) =>
                            s.sectorId === a.sectorId &&
                            !s.blocked &&
                            !claims.has(s.id),
                        )
                        .map((s) => s.id),
                    );
                    const ids = contiguousSeats(seats, available, count);
                    setSelected(ids);
                    setMessage(ids.length ? "" : c.noRun);
                  }}
                >
                  <label className="grid gap-1">
                    {c.count}
                    <input
                      className="field w-28"
                      type="number"
                      name="count"
                      min={1}
                      max={10000}
                      required
                      value={count}
                      disabled={blocked}
                      onChange={(e) => setCount(Number(e.target.value))}
                    />
                  </label>
                  <ProgressButton
                    type="submit"
                    className="btn-secondary min-h-11 px-3"
                    disabled={blocked || !a}
                  >
                    {c.contiguous}
                  </ProgressButton>
                </ReliableForm>
              )}
              <div className="flex flex-wrap gap-3">
                {manager && (
                  <>
                    <ProgressButton
                      className="btn-primary min-h-11 px-3"
                      disabled={blocked || !free}
                      onClick={() => act("reserve")}
                    >
                      {c.reserve}
                    </ProgressButton>
                    <button
                      className="btn-secondary min-h-11 px-3"
                      disabled={blocked || !mine || !!selectedNames}
                      onClick={() => setConfirm("release")}
                    >
                      {c.release}
                    </button>
                  </>
                )}
                <button
                  className="btn-secondary min-h-11 px-3"
                  disabled={blocked || !selectedNames}
                  onClick={() => setConfirm("unname")}
                >
                  {c.unname}
                </button>
              </div>
              {confirm && (
                <div className="rounded-lg border border-amber-500 p-4">
                  <p>
                    {c.confirm} · {selected.length}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <ProgressButton
                      className="btn-primary min-h-11 px-3"
                      disabled={blocked}
                      onClick={() => act(confirm)}
                    >
                      {confirm === "release" ? c.release : c.unname}
                    </ProgressButton>
                    <button
                      className="btn-secondary min-h-11 px-3"
                      disabled={blocked}
                      onClick={() => setConfirm(null)}
                    >
                      {c.cancel}
                    </button>
                  </div>
                </div>
              )}
              <ReliableForm
                locale={locale}
                className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                action={async () => {
                  await act("name");
                }}
              >
                <label className="grid min-w-0 gap-1">
                  {c.nominee}
                  <select
                    className="field min-w-0"
                    name="nominee"
                    required
                    disabled={blocked}
                    value={nominee}
                    onChange={(e) => setNominee(e.target.value)}
                  >
                    <option value="">{c.choose}</option>
                    {names
                      .filter((n) => !namedIds.has(n.id))
                      .map((n) => (
                        <option key={n.id} value={n.id} disabled={n.review}>
                          {n.name}
                          {n.childId ? ` · ${dc.child}` : ""}
                          {n.review ? ` · ${c.review}` : ""}
                        </option>
                      ))}
                  </select>
                </label>
                <ProgressButton
                  type="submit"
                  className="btn-primary min-h-11 self-end px-3"
                  disabled={
                    blocked ||
                    !mine ||
                    selected.length !== 1 ||
                    !!selectedNames ||
                    !nominee
                  }
                >
                  {c.name}
                </ProgressButton>
              </ReliableForm>
            </>
          )}
        </div>
      )}
      {admin && (
        <CeremonyMapEditor
          view={view}
          blocked={blocked}
          saveDraft={(title, seats) =>
            command({ operation: "draft", data: { title, seats } })
          }
          publish={() => {
            if (view.draft && !blocked)
              void command({
                operation: "publish",
                data: { versionId: view.draft.id },
              });
          }}
        />
      )}
      <button
        type="button"
        className="btn-secondary min-h-11 justify-self-start px-3"
        disabled={stale || pending || !!uncertain}
        onClick={() => window.print()}
      >
        {c.print}
      </button>
      <section className="ceremony-seat-print surface-card min-w-0 p-5">
        <h2 className="mb-3 text-lg font-semibold">
          {dc[view.kind]} · {c.title}
        </h2>
        <p>
          {view.active
            ? `${view.active.title} · ${c.version} ${view.active.version}`
            : c.empty}
        </p>
        <p>{c.intro}</p>
        <div className="max-w-full overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[c.nominee, c.allocation, c.number].map((t) => (
                  <th className="p-2" key={t} scope="col">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.nominees.map((n) => {
                const allocation = allocationById.get(n.allocationId),
                  claim = claimByNominee.get(n.id),
                  seat = claim ? seatById.get(claim.seatId) : undefined;
                return (
                  <tr key={n.id} className="border-b">
                    <td className="p-2">
                      {n.name}
                      {n.childId ? ` · ${dc.child}` : ""}
                      {n.review ? ` · ${c.review}` : ""}
                    </td>
                    <td className="p-2">
                      {allocation?.groupName ?? dc.direct} ·{" "}
                      {allocation?.sector} · {allocation?.category}
                    </td>
                    <td className="p-2">
                      {!n.needsSeat
                        ? dc.noSeatState
                        : seat
                          ? `${c.row} ${seat.row} · ${c.number} ${seat.number}`
                          : c.seatPending}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
