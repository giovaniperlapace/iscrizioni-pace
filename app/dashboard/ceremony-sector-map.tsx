"use client";
import { memo, useEffect, useRef, useState } from "react";
import type { SeatsDesk } from "@/lib/ceremonies/seats-desk";
import { openingSeatAddress } from "@/lib/ceremonies/seat-label";
import { sectorCapacitySummary } from "@/lib/ceremonies/overbooking";
import { closingSectorLayout } from "@/lib/ceremonies/closing-layout";
import { CLOSING_BADGE_LAYOUT } from "@/lib/ceremonies/closing-badges";
import { ClosingBadgeMap } from "./closing-badge-map";
type Sector = SeatsDesk["sectors"][number];
const colors = { free: "#dbeafe", reserved: "#d97706", nominal: "#16a34a", draft: "#8b5cf6", blocked: "#94a3b8" };
function SectorShape({
  sector,
  desk,
  onSelect,
  disabled,
  compact,
}: {
  sector: Sector;
  desk: SeatsDesk;
  onSelect: (id: string) => void;
  disabled: boolean;
  compact?: "main" | "outside" | "standing";
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (compact !== "standing" || !svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSize(previous => previous?.width === width && previous.height === height ? previous : { width, height });
      }
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, [compact]);
  const seats = (desk.active?.seats ?? []).filter(
    (s) => s.sectorId === sector.id,
  );
  const capacity = sector.capacity ?? seats.length;
  const available =
    sector.assignableLimit ??
    (seats.length ? seats.filter((s) => !s.blocked).length : capacity);
  const counts = sectorCapacitySummary(desk, sector.id);
  const reserved = counts.assigned;
  const closingLayout = compact ? closingSectorLayout(sector.layoutCode ?? sector.name, capacity) : null;
  const columns = compact && size
    ? Math.max(1, Math.ceil(Math.sqrt(capacity * size.width / size.height)))
    : compact === "main" ? 50 : compact ? 40 : 20;
  const colorAt = (index: number) => index < counts.nominal ? colors.nominal : index < counts.nominal + counts.groupPending ? colors.reserved : index < counts.nominal + counts.groupPending + counts.draft ? colors.draft : colors.free;
  const blocks = [
    ...new Set(seats.map((s) => openingSeatAddress(s.row)?.block ?? 1)),
  ].sort((a, b) => a - b);
  let freeIndex = 0;
  const dots = closingLayout
    ? closingLayout.map((seat, i) => ({ ...seat, id: String(i), color: i >= available ? colors.blocked : colorAt(i) }))
    : seats.length
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
        x: (i % columns) * 10,
        y: Math.floor(i / columns) * 10,
        color: i >= available ? colors.blocked : colorAt(i),
      }));
  const width = Math.max(1, ...dots.map((d) => d.x + 8)),
    height = Math.max(1, ...dots.map((d) => d.y + 8));
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(sector.id)}
      aria-label={`Settore ${sector.name} · ${sector.remaining} posti disponibili`}
      className={compact
        ? "grid min-w-0 w-full content-start gap-0.5 rounded-xl border border-slate-300 bg-white p-1.5 text-left break-words focus-visible:outline-4 focus-visible:outline-blue-700"
        : "grid min-w-0 w-full content-start gap-2 rounded-xl border border-slate-300 bg-white p-1 text-left break-words sm:p-3 focus-visible:outline-4 focus-visible:outline-blue-700"}
    >
      <span className="flex flex-wrap items-baseline justify-between gap-2">
        <strong className={compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"}>{compact === "main" ? `Settore ${sector.layoutCode ?? sector.name}` : sector.name}</strong>
        <span className={compact ? "text-[10px] font-semibold text-blue-900 sm:text-xs" : "text-[10px] font-semibold text-blue-900 sm:text-sm"}>
          {sector.remaining} assegnabili
        </span>
      </span>
      {counts.extra > 0 && <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-950 sm:text-xs">Overbooking +{counts.extra} · {counts.usedExtra} impegnati</span>}
      <svg
        ref={svgRef}
        viewBox={`-1 -1 ${width + 2} ${height + 2}`}
        aria-hidden="true"
        className={closingLayout ? "w-full" : compact ? "h-24 w-full sm:h-40" : "w-full"}
        data-sector={sector.layoutCode ?? sector.name}
      >
        {dots.map((d) => (
          <rect
            key={d.id}
            data-block={"block" in d ? d.block : undefined}
            x={d.x}
            y={d.y}
            width="7"
            height="7"
            rx={compact === "standing" ? 3.5 : 1}
            fill={d.color}
          />
        ))}
      </svg>
      {compact ? <span className="text-[10px] leading-3 text-slate-600">
        {capacity} {compact === "standing" ? "in piedi" : "posti"}
        {capacity > available ? ` · ${capacity - available} protocollo` : ` · ${reserved} impegnati`}
      </span> : <span className="hidden text-[9px] text-slate-600 sm:block sm:text-xs">
        {counts.draft} in bozza · {counts.nominal} nominativi · {counts.groupPending} da abbinare · {reserved} impegnati · {capacity} capienza reale · {counts.base} ordinari
        {capacity > available ? ` · ${capacity - available} protocollo` : ""}
      </span>}
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
  if (desk.kind === "closing" && desk.layoutKey === CLOSING_BADGE_LAYOUT) {
    return <ClosingBadgeMap desk={desk} onSelect={onSelect} disabled={disabled} />;
  }
  if (desk.kind === "closing") {
    const mainCodes = ["A", "B", "C", "D", "E"];
    const main = mainCodes.flatMap(code => desk.sectors.filter(s => (s.layoutCode ?? s.name) === code));
    const outside = desk.sectors.filter(s => !mainCodes.includes(s.layoutCode ?? s.name));
    return (
      <div className="grid min-w-0 gap-2" aria-label="Piantina cerimonia finale">
        <div className="grid grid-cols-[minmax(0,4fr)_minmax(0,3fr)] items-start gap-2 sm:gap-4">
          <section className="surface-card grid min-w-0 gap-2 p-2 sm:p-3" aria-label="Piazza inferiore">
            <h2 className="text-xs font-semibold sm:text-base">Piazza inferiore</h2>
            <div className="rounded-lg bg-[var(--peace-blue-800)] p-1 text-center text-xs font-bold text-white sm:text-sm">PALCO</div>
            {main.map(s => <SectorShape key={s.id} sector={s} desk={desk} onSelect={onSelect} disabled={disabled} compact="main" />)}
          </section>
          <section className="surface-card grid min-w-0 gap-2 p-2 sm:p-3" aria-label="Piazza superiore">
            <h2 className="text-xs font-semibold sm:text-base">Piazza superiore</h2>
            {outside.map(s => <SectorShape key={s.id} sector={s} desk={desk} onSelect={onSelect} disabled={disabled} compact={s.layoutCode === "PRATO" ? "standing" : "outside"} />)}
          </section>
        </div>
        <p className="text-xs text-slate-600">Azzurro: libero · Viola: bozza · Verde: nominativo · Arancio: da abbinare · Grigio: protocollo.</p>
        <p className="text-xs text-slate-600">Schema dei settori: quadratini per i posti a sedere, punti per il prato in piedi. Seleziona un settore per i dettagli.</p>
      </div>
    );
  }
  const f = desk.sectors.find((s) => (s.layoutCode ?? s.name) === "F");
  const front = ["A1", "A", "A2"]
    .map((name) => desk.sectors.find((s) => (s.layoutCode ?? s.name) === name))
    .filter((s): s is Sector => !!s);
  const rest = desk.sectors.filter(
    (s) => !["A1", "A", "A2", "F"].includes(s.layoutCode ?? s.name),
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
          className="surface-card grid min-w-0 gap-3 break-words p-2 sm:p-5"
          aria-label={`Settore ${f.name}`}
        >
          <h2 className="text-sm font-semibold sm:text-lg">Settore {f.name}</h2>
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
        rappresentano i posti fisici del settore. L’overbooking è indicato separatamente, senza aggiungere sedie alla piantina.
      </p>
    </div>
  );
});
