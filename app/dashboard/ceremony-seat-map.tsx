"use client";
import { useMemo, useState } from "react";
import type { MapSeat, SeatMapView } from "@/lib/ceremonies/seat-map";
import type { SupportedLocale } from "@/lib/i18n/config";
import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
import { SEAT_MAP_COPY } from "@/lib/ceremonies/seat-map-copy";
export function CeremonySeatMap({
  seats,
  sectors,
  claims,
  allocationId,
  selected,
  onSelect,
  disabled,
  locale,
}: {
  seats: MapSeat[];
  sectors: SeatMapView["sectors"];
  claims: SeatMapView["claims"];
  allocationId: string;
  selected: string[];
  onSelect: (id: string) => void;
  disabled: boolean;
  locale: SupportedLocale;
}) {
  const c = SEAT_MAP_COPY[locale];
  const [table, setTable] = useState(false),
    [zoom, setZoom] = useState(1),
    [sector, setSector] = useState(""),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  const claimById = useMemo(
    () => new Map(claims.map((c) => [c.seatId, c])),
    [claims],
  );
  const sectorById = useMemo(
    () => new Map(sectors.map((s) => [s.id, s.name])),
    [sectors],
  );
  const chosen = useMemo(() => new Set(selected), [selected]);
  const visible = seats.filter(
    (s) =>
      (!sector || s.sectorId === sector) &&
      `${s.row} ${s.number}`
        .toLocaleLowerCase(locale)
        .includes(query.toLocaleLowerCase(locale)),
  );
  const state = (s: MapSeat) =>
    s.blocked
      ? "blocked"
      : claimById.get(s.id)?.nomineeId
        ? "named"
        : claimById.has(s.id)
          ? claimById.get(s.id)?.allocationId === allocationId
            ? "own"
            : "occupied"
          : "free";
  const colors = {
    blocked: "#e2e8f0",
    named: "#c4b5fd",
    own: "#a7f3d0",
    occupied: "#fcd34d",
    free: "#fff",
  };
  const width = Math.max(400, ...visible.map((s) => s.x + 65)),
    height = Math.max(160, ...visible.map((s) => s.y + 65));
  const canSelect = (s: MapSeat) =>
    !disabled &&
    !s.blocked &&
    (!claimById.has(s.id) ||
      claimById.get(s.id)?.allocationId === allocationId);
  const label = (s: MapSeat) =>
    `${sectorById.get(s.sectorId)} · ${c.row} ${s.row} · ${c.number} ${s.number} · ${c[state(s)]}`;
  return (
    <section className="grid min-w-0 gap-3" aria-label={c.map}>
      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1">
          {c.sector}
          <select
            className="field max-w-full"
            value={sector}
            onChange={(e) => {
              setSector(e.target.value);
              setPage(0);
            }}
          >
            <option value="">{c.all}</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1">
          {c.search}
          <input
            className="field min-w-0"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <button
          type="button"
          className="btn-secondary min-h-11 px-3"
          aria-pressed={table}
          onClick={() => setTable(!table)}
        >
          {table ? c.map : c.table}
        </button>
      </div>
      <ul className="flex flex-wrap gap-3 text-sm" aria-label={c.map}>
        {(["free", "blocked", "occupied", "own", "named"] as const).map((k) => (
          <li key={k} className="flex items-center gap-1">
            <span
              className="inline-block h-4 w-4 border border-slate-600"
              style={{ background: colors[k] }}
            />
            {c[k]}
          </li>
        ))}
      </ul>
      {table ? (
        <>
          <div className="max-w-full overflow-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{c.table}</caption>
              <thead>
                <tr>
                  {[c.selected, c.sector, c.row, c.number, c.map].map((x) => (
                    <th className="p-2" key={x} scope="col">
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.slice(page * 50, page * 50 + 50).map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        className="h-6 w-6"
                        aria-label={label(s)}
                        checked={chosen.has(s.id)}
                        disabled={!canSelect(s)}
                        onChange={() => onSelect(s.id)}
                      />
                    </td>
                    <td className="p-2">{sectorById.get(s.sectorId)}</td>
                    <td className="p-2">{s.row}</td>
                    <td className="p-2">{s.number}</td>
                    <td className="p-2">{c[state(s)]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length > 50 && (
            <div className="flex gap-3">
              <button
                aria-label={DISTRIBUTION_COPY[locale].previous}
                className="btn-secondary min-h-11 px-3"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                ←
              </button>
              <span>
                {page + 1}/{Math.ceil(visible.length / 50)}
              </span>
              <button
                aria-label={DISTRIBUTION_COPY[locale].next}
                className="btn-secondary min-h-11 px-3"
                disabled={(page + 1) * 50 >= visible.length}
                onClick={() => setPage(page + 1)}
              >
                →
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <label className="flex gap-3">
            {c.zoom}
            <input
              type="range"
              min="0.75"
              max="2"
              step="0.25"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            {Math.round(zoom * 100)}%
          </label>
          <div
            className="max-h-[65vh] max-w-full overflow-auto rounded-xl border border-slate-300 bg-slate-50 p-3"
            tabIndex={0}
            role="region"
            aria-label={c.map}
          >
            <div
              className="relative"
              style={{ width: width * zoom, height: height * zoom }}
            >
              {visible.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={label(s)}
                  aria-pressed={chosen.has(s.id)}
                  disabled={!canSelect(s)}
                  onClick={() => onSelect(s.id)}
                  className="absolute flex min-h-11 min-w-11 items-center justify-center rounded-lg border text-xs font-semibold text-slate-950 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  style={{
                    left: s.x * zoom,
                    top: s.y * zoom,
                    width: 44 * zoom,
                    height: 44 * zoom,
                    background: colors[state(s)],
                    borderColor: chosen.has(s.id) ? "#1d4ed8" : "#64748b",
                    boxShadow: chosen.has(s.id)
                      ? "inset 0 0 0 3px #1d4ed8"
                      : undefined,
                  }}
                >
                  {s.row}
                  <br />
                  {s.number}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
