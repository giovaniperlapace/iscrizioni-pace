"use client";
import { memo } from "react";
import type { SeatsDesk } from "@/lib/ceremonies/seats-desk";
import { openingSeatAddress } from "@/lib/ceremonies/seat-label";
import { sectorCounts } from "@/lib/ceremonies/drafts";
type Sector = SeatsDesk["sectors"][number];
const colors = { free: "#dbeafe", reserved: "#d97706", nominal: "#16a34a", draft: "#8b5cf6", blocked: "#94a3b8" };
function SectorShape({
  sector,
  desk,
  onSelect,
  disabled,
}: {
  sector: Sector;
  desk: SeatsDesk;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  const seats = (desk.active?.seats ?? []).filter(
    (s) => s.sectorId === sector.id,
  );
  const capacity = sector.capacity ?? seats.length;
  const available =
    sector.assignableLimit ??
    (seats.length ? seats.filter((s) => !s.blocked).length : capacity);
  const reserved = Math.max(0, available - sector.remaining);
  const counts = sectorCounts(desk, sector.id);
  const colorAt = (index: number) => index < counts.nominal ? colors.nominal : index < counts.nominal + counts.groupPending ? colors.reserved : index < counts.nominal + counts.groupPending + counts.draft ? colors.draft : colors.free;
  const blocks = [
    ...new Set(seats.map((s) => openingSeatAddress(s.row)?.block ?? 1)),
  ].sort((a, b) => a - b);
  let freeIndex = 0;
  const dots = seats.length
    ? seats.map((s) => {
        const address = openingSeatAddress(s.row),
          block = address?.block ?? 1;
        const rear = block > 6;
        const x =
          (block === 7 ? 0 : Math.max(0, Math.min(5, blocks.length - 1))) *
            112 +
          (Number(s.number) - 1) * 10;
        const normalX =
          blocks.indexOf(block) * 112 + (Number(s.number) - 1) * 10;
        return {
          id: s.id,
          x: rear ? x : normalX,
          y: (rear ? 112 : 0) + ((address?.row ?? 1) - 1) * 10,
          color: s.blocked
            ? colors.blocked
            : colorAt(freeIndex++),
        };
      })
    : Array.from({ length: capacity }, (_, i) => ({
        id: String(i),
        x: (i % 20) * 10,
        y: Math.floor(i / 20) * 10,
        color: colorAt(i),
      }));
  const width = Math.max(1, ...dots.map((d) => d.x + 8)),
    height = Math.max(1, ...dots.map((d) => d.y + 8));
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(sector.id)}
      aria-label={`Settore ${sector.name} · ${sector.remaining} posti disponibili`}
      className="grid min-w-0 w-full content-start gap-2 rounded-xl border border-slate-300 bg-white p-1 text-left break-words sm:p-3 focus-visible:outline-4 focus-visible:outline-blue-700"
    >
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <strong className="text-sm sm:text-base">{sector.name}</strong>
        <span className="text-[10px] font-semibold text-blue-900 sm:text-sm">
          {sector.remaining} liberi
        </span>
      </span>
      <svg
        viewBox={`-1 -1 ${width + 2} ${height + 2}`}
        aria-hidden="true"
        className="w-full"
        data-sector={sector.name}
      >
        {dots.map((d) => (
          <rect
            key={d.id}
            x={d.x}
            y={d.y}
            width="7"
            height="7"
            rx="1"
            fill={d.color}
          />
        ))}
      </svg>
      <span className="hidden text-[9px] text-slate-600 sm:block sm:text-xs">
        {counts.draft} in bozza · {counts.nominal} nominativi · {counts.groupPending} da abbinare · {reserved} occupati su {available}
        {capacity > available ? ` · ${capacity - available} protocollo` : ""}
      </span>
    </button>
  );
}
export const CeremonySectorMap = memo(function CeremonySectorMap({
  desk,
  onSelect,
  disabled = false,
}: {
  desk: SeatsDesk;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const f = desk.sectors.find((s) => s.name === "F");
  const front = ["A1", "A", "A2"]
    .map((name) => desk.sectors.find((s) => s.name === name))
    .filter((s): s is Sector => !!s);
  const rest = desk.sectors.filter(
    (s) => !["A1", "A", "A2", "F"].includes(s.name),
  );
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,3fr)_minmax(5.5rem,1fr)] items-start gap-2 sm:gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(16rem,1fr)]">
      <section
        className="surface-card grid min-w-0 gap-3 p-2 sm:p-5"
        aria-label="Sala principale"
      >
        <h2 className="text-sm font-semibold sm:text-lg">Sala principale</h2>
        <div className="rounded-lg bg-[var(--peace-blue-800)] p-2 text-center font-bold text-white">
          PALCO
        </div>
        {!!front.length && (
          <div className="grid grid-cols-[1fr_4fr_1fr] gap-1 sm:gap-2">
            {front.map((s) => (
              <SectorShape
                key={s.id}
                sector={s}
                desk={desk}
                onSelect={onSelect}
                disabled={disabled}
              />
            ))}
          </div>
        )}
        {rest.map((s) => (
          <SectorShape
            key={s.id}
            sector={s}
            desk={desk}
            onSelect={onSelect}
            disabled={disabled}
          />
        ))}
      </section>
      {f && (
        <section
          className="surface-card grid gap-3 p-2 sm:p-5"
          aria-label="Sala collegata F"
        >
          <h2 className="text-sm font-semibold sm:text-lg">Sala collegata F</h2>
          <p className="text-sm">{f.capacity} posti</p>
          <SectorShape
            sector={f}
            desk={desk}
            onSelect={onSelect}
            disabled={disabled}
          />
        </section>
      )}
      <p className="col-span-2 text-sm">
        Azzurro: libero · Viola: bozza · Verde: pubblicato e nominativo · Arancio: pubblicato al gruppo, da abbinare · Grigio: protocollo. I quadratini
        rappresentano le quantità disponibili nel settore, senza assegnare una
        sedia specifica.
      </p>
    </div>
  );
});
