"use client";
import { useEffect, useRef, useState } from "react";
import type { SeatsDesk } from "@/lib/ceremonies/seats-desk";
import { sectorCapacitySummary } from "@/lib/ceremonies/overbooking";
import { CLOSING_BADGE_SECTORS } from "@/lib/ceremonies/closing-badges";

// The dots are quantities, not addresses or a physical seating plan.
const statusColors = { free: "#dbeafe", draft: "#8b5cf6", nominal: "#16a34a", group: "#d97706", blocked: "#94a3b8" };
export function ClosingBadgeMap({ desk, onSelect, disabled }: { desk: SeatsDesk; onSelect: (id: string) => void; disabled: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(50);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setColumns(Math.max(50, Math.floor((entry.contentRect.width - 26) / 8))));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={container} className="grid min-w-0 gap-3" aria-label="Settori cerimonia finale">
    {CLOSING_BADGE_SECTORS.map(badge => {
      const sector = desk.sectors.find(s => s.layoutCode === badge.code);
      if (!sector) return null;
      const counts = sectorCapacitySummary(desk, sector.id);
      const capacity = sector.capacity ?? 0;
      const rows = Math.max(1, Math.ceil(capacity / columns));
      return <button key={sector.id} type="button" onClick={() => onSelect(sector.id)} disabled={disabled}
        aria-label={`${sector.name} · Badge ${badge.color} · ${sector.remaining} posti assegnabili`}
        className="grid min-w-0 gap-2 rounded-xl border border-slate-300 bg-white p-3 text-left focus-visible:outline-4 focus-visible:outline-blue-700 disabled:opacity-60">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm sm:text-base">{sector.name}</strong>
          <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: badge.hex }}>Badge {badge.color}</span>
        </span>
        <span className="text-xs sm:text-sm"><strong>{sector.remaining} assegnabili</strong> · {capacity} posti</span>
        <svg viewBox={`0 0 ${columns * 10} ${rows * 10}`} className="w-full" aria-hidden="true" data-sector={badge.code}>
          {Array.from({ length: capacity }, (_, i) => <rect key={i} x={(i % columns) * 10 + 1} y={Math.floor(i / columns) * 10 + 1} width="7" height="7" rx="1"
            fill={i >= (sector.assignableLimit ?? capacity) ? statusColors.blocked : i < counts.nominal ? statusColors.nominal : i < counts.nominal + counts.groupPending ? statusColors.group : i < counts.nominal + counts.groupPending + counts.draft ? statusColors.draft : statusColors.free} />)}
        </svg>
        <span className="text-xs text-slate-600">{counts.draft} in bozza · {counts.nominal} nominativi · {counts.groupPending} da abbinare</span>
        {counts.extra > 0 && <span className="text-xs font-semibold text-amber-900">Overbooking +{counts.extra} · {counts.usedExtra} impegnati</span>}
      </button>;
    })}
    <p className="text-xs text-slate-600">Legenda posti: azzurro libero · viola in bozza · verde nominativo · arancio da abbinare · grigio riservato.</p>
    <p className="text-xs text-slate-600">I simboli rappresentano le quantità, senza indicare file o sedute. Accesso al settore con il badge del colore indicato; sistemazione a riempimento.</p>
  </div>;
}
