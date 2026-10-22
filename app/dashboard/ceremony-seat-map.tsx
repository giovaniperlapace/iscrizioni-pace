"use client";
import { ceremonySeatLabel, ceremonyDisplayPoint, openingSeatAddress, seatAddressWords } from "@/lib/ceremonies/seat-label";
import { OpeningHallOverview } from "./opening-hall-overview";
import { useMemo, useState } from "react";
import type { MapSeat, SeatMapView } from "@/lib/ceremonies/seat-map";
import type { SupportedLocale } from "@/lib/i18n/config";
import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
import { SEAT_MAP_COPY } from "@/lib/ceremonies/seat-map-copy";
export function CeremonySeatMap({
  seats,
  layoutKey,
  sectors,
  claims,
  allocationId,
  selectableSeatIds,
  showOverview = true,
  initialBlock = "",
  onBlockChange,
  selected,
  onSelect,
  onOccupied,
  disabled,
  locale,
}: {
  seats: MapSeat[];
  layoutKey?: string | null;
  sectors: SeatMapView["sectors"];
  claims: SeatMapView["claims"];
  allocationId: string;
  selectableSeatIds?: string[];
  showOverview?: boolean;
  initialBlock?: string;
  onBlockChange?: (block: string) => void;
  selected: string[];
  onSelect: (id: string) => void;
  onOccupied?: (id: string) => void;
  disabled: boolean;
  locale: SupportedLocale;
}) {
  const c = SEAT_MAP_COPY[locale];
  const opening = layoutKey === "assisi-opening-2026";
  const [block, setBlock] = useState(initialBlock);
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
      (!block || s.row.startsWith(`${block}-r`)) &&
      `${ceremonySeatLabel(sectorById.get(s.sectorId) ?? "", s, locale)} ${s.row} ${s.number}`
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
  const points = new Map(visible.map(s => [s.id, ceremonyDisplayPoint(s, opening)]));
  const rowGutter = opening ? 88 : 0;
  const minX = Math.min(...[...points.values()].map(s => s.x), 10000), minY = Math.min(...[...points.values()].map(s => s.y), 10000);
  const width = Math.max(400, ...[...points.values()].map(s => s.x - minX + rowGutter + (opening ? 100 : 65))),
    height = Math.max(160, ...[...points.values()].map(s => s.y - minY + (opening ? 122 : 65)));
  const detailBlocks = opening ? Array.from(new Set(visible.map(s => `${s.sectorId}:${openingSeatAddress(s.row)?.key}`))).map(key => {
    const members = visible.filter(s => `${s.sectorId}:${openingSeatAddress(s.row)?.key}` === key);
    const first = members[0];
    const x = Math.min(...members.map(s => points.get(s.id)!.x));
    return { key, sector: sectorById.get(first.sectorId), block: openingSeatAddress(first.row)?.block,
      x, y: Math.min(...members.map(s => points.get(s.id)!.y)), width: Math.max(...members.map(s => points.get(s.id)!.x)) - x + rowGutter + 84,
      rows: Array.from(new Map(members.map(s => [s.row, {
        key: s.row, number: openingSeatAddress(s.row)?.row, y: points.get(s.id)!.y,
      }])).values()),
    };
  }) : [];
  const [, blockWord, rowWord, chairWord] = seatAddressWords(locale);
  const sectorOnly = sectors.find(s => s.id === sector)?.numbered === false;
  const showDetail = !showOverview || !opening || !!sector || !!block || !!query || table;
  const canSelect = (s: MapSeat) =>
    !disabled &&
    !s.blocked &&
    (selectableSeatIds ? selectableSeatIds.includes(s.id) : (!claimById.has(s.id) ||
      claimById.get(s.id)?.allocationId === allocationId));
  const label = (s: MapSeat) =>
    `${ceremonySeatLabel(sectorById.get(s.sectorId) ?? "", s, locale)} · ${c[state(s)]}`;
  return (
    <section className="grid min-w-0 gap-3" aria-label={c.map}>
      {opening && showOverview && <OpeningHallOverview seats={seats} sectors={sectors} claims={claims} onBlock={(id, key) => {setSector(id);setBlock(key);setQuery("");setPage(0);}} />}
      {opening && (block || sector || sectors.length === 1) && <div className="flex flex-wrap items-center gap-3"><strong>{c.sector} {sector || sectors.length === 1 ? sectorById.get(sector || sectors[0].id) : ""}{block && <> · {blockWord} {openingSeatAddress(`${block}-r01`)?.block ?? block}</>}</strong><button type="button" className="btn-secondary min-h-11 px-3" disabled={disabled} aria-pressed={!block && !query && !table} onClick={() => {setBlock("");onBlockChange?.("");setQuery("");setPage(0);setTable(false);}}>{c.wholeSector}</button></div>}
      {sectorOnly && <p className="rounded-lg bg-blue-50 p-4">Questo settore non ha posti numerati. Assegna una quantità al gruppo oppure un posto alla persona; non occorre scegliere una sedia.</p>}
      <div className="flex flex-wrap gap-3">
        {sectors.length > 1 && <label className="grid gap-1">
          {c.sector}
          <select
            className="field max-w-full"
            value={sector}
            onChange={(e) => {
              setSector(e.target.value);
              setBlock("");
              onBlockChange?.("");
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
        </label>}
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
      {showDetail && !sectorOnly && (table ? (
        <>
          <div className="max-w-full overflow-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{c.table}</caption>
              <thead>
                <tr>
                  {[c.selected, c.sector, ...(opening ? [blockWord] : []), rowWord, chairWord, c.map].map((x) => (
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
                      {onOccupied && claimById.has(s.id) ? <button type="button" className="btn-secondary px-3 py-2" disabled={disabled || s.blocked} aria-label={label(s)} onClick={() => onOccupied(s.id)}>Gestisci posto</button> : <input
                        type="checkbox"
                        className="h-6 w-6"
                        aria-label={label(s)}
                        checked={chosen.has(s.id)}
                        disabled={!canSelect(s)}
                        onChange={() => onSelect(s.id)}
                      />}
                    </td>
                    <td className="p-2">{sectorById.get(s.sectorId)}</td>
                    <td className="p-2" hidden={!opening}>{openingSeatAddress(s.row)?.block}</td>
                    <td className="p-2">{opening ? openingSeatAddress(s.row)?.row : s.row}</td>
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
            {opening && <div className="mb-3 rounded-lg bg-[var(--peace-blue-800)] p-3 text-center font-bold text-white">PALCO</div>}
            <div
              className="relative"
              style={{ width: width * zoom, height: height * zoom }}
            >
              {detailBlocks.map(b => <div key={b.key} className={`absolute flex items-center rounded-md border px-2 text-sm font-semibold ${b.sector === "B1" ? "border-blue-600 bg-blue-50 text-blue-900" : b.sector === "B2" ? "border-violet-600 bg-violet-50 text-violet-900" : "border-slate-300 bg-white"}`} style={{left:(b.x-minX)*zoom,top:(b.y-minY)*zoom,width:Math.max(240,b.width)*zoom,height:44*zoom}}>{c.sector} {b.sector} · {blockWord} {b.block}</div>)}
              {detailBlocks.flatMap(b => b.rows.map(row => (
                <div
                  key={`${b.key}:${row.key}`}
                  className="absolute flex min-h-11 items-center pr-2 text-sm font-semibold text-slate-700"
                  style={{ left: (b.x - minX) * zoom, top: (row.y - minY + 52) * zoom, width: rowGutter * zoom, height: 54 * zoom }}
                >
                  {rowWord} {row.number}
                </div>
              )))}
              {visible.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={label(s)}
                  title={label(s)}
                  aria-pressed={chosen.has(s.id)}
                  disabled={!canSelect(s) && !(onOccupied && claimById.has(s.id) && !disabled && !s.blocked)}
                  onClick={() => onOccupied && claimById.has(s.id) ? onOccupied(s.id) : onSelect(s.id)}
                  className="absolute flex min-h-11 min-w-11 items-center justify-center rounded-lg border text-xs font-semibold text-slate-950 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                  style={{
                    left: (points.get(s.id)!.x - minX + rowGutter) * zoom,
                    top: (points.get(s.id)!.y - minY + (opening ? 52 : 0)) * zoom,
                    width: (opening ? 84 : 44) * zoom,
                    height: (opening ? 54 : 44) * zoom,
                    background: colors[state(s)],
                    borderColor: chosen.has(s.id) ? "#1d4ed8" : "#64748b",
                    boxShadow: chosen.has(s.id)
                      ? "inset 0 0 0 3px #1d4ed8"
                      : undefined,
                  }}
                >
                  {opening ? <span>{locale === "it" ? "Posto" : chairWord} {s.number}</span> : <span>{s.row}<br />{s.number}</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      ))}
    </section>
  );
}
