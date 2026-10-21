"use client";
import { useMemo } from "react";
import type { MapSeat, SeatMapView } from "@/lib/ceremonies/seat-map";

// Orientation follows the source photo: stage left. b1 is on the viewer's
// left while facing the stage, hence at the bottom of this drawing.
export function OpeningHallOverview({ seats, sectors, claims, onBlock }: {
  seats: MapSeat[];
  sectors: SeatMapView["sectors"];
  claims: SeatMapView["claims"];
  onBlock: (sector: string, block: string) => void;
}) {
  const occupied = useMemo(() => new Set(claims.map(c => c.seatId)), [claims]);
  const blocks = useMemo(() => {
    const grouped = new Map<string, MapSeat[]>();
    for (const seat of seats) {
      const key = seat.row.replace(/-r\d+$/, "");
      const group = grouped.get(key) ?? [];
      group.push(seat); grouped.set(key, group);
    }
    return Array.from(grouped, ([key, values]) => {
      const match = /^([A-E])-b([1-6])$/.exec(key);
      const rear = key === "H1" || key === "H2";
      if (!match && !rear) return null;
      const block = match ? Number(match[2]) : key === "H1" ? 1 : 6;
      return { key, values, column: match ? match[1].charCodeAt(0)-65 : 5, block };
    }).filter(b => b !== null);
  }, [seats]);
  const name = (id: string) => sectors.find(s => s.id === id)?.name ?? "";
  const f = sectors.find(s => s.layoutCode === "F");
  return <div className="grid min-w-0 gap-3">
    <p className="text-sm text-[var(--peace-muted)]">Vista d’insieme · palco a sinistra. Scegli un blocco per vedere le singole sedie. I blocchi b1–b6 sono numerati da sinistra a destra guardando il palco.</p>
    <div className="max-w-full overflow-auto rounded-xl border border-[var(--peace-border)] bg-slate-50 p-3" role="region" aria-label="Piantina generale inaugurazione" tabIndex={0}>
      <div className="grid min-w-[610px] gap-2" style={{gridTemplateColumns:"46px repeat(6,minmax(0,1fr))",gridTemplateRows:"repeat(6,minmax(100px,1fr))"}}>
        <div className="flex items-center justify-center rounded-xl bg-[var(--peace-blue-800)] text-white" style={{gridRow:"1 / 7",gridColumn:1}}><span style={{writingMode:"vertical-rl",transform:"rotate(180deg)"}} className="font-bold tracking-widest">PALCO</span></div>
        {blocks.map(({key,values,column,block}) => {
          const sectorNames = Array.from(new Set(values.map(s => name(s.sectorId)))).join(" / ");
          const available = values.filter(s => !s.blocked && !occupied.has(s.id)).length;
          return <button key={key} type="button" onClick={() => onBlock("",key)} aria-label={`Blocco ${key} · settore ${sectorNames} · ${available} sedie libere`} className="grid gap-1 rounded-md border border-slate-300 bg-white p-1.5 text-left text-xs focus-visible:outline-4 focus-visible:outline-blue-700" style={{gridRow:7-block,gridColumn:column+2}}>
            <span className="font-semibold">{key} <span className="font-normal">{sectorNames !== key ? `· ${sectorNames}` : ""}</span></span>
            <svg viewBox="0 0 104 104" className="w-full" aria-hidden="true">
              {values.map(s => { const row = Number(s.row.match(/-r(\d+)$/)?.[1] ?? 1);return <rect key={s.id} x={(row-1)*10+2} y={(10-Number(s.number))*10+2} width="7" height="7" rx="1" fill={s.blocked?"#94a3b8":occupied.has(s.id)?"#d97706":"#dbeafe"} />;})}
            </svg>
            <span>{available} libere / {values.length}</span>
          </button>;
        })}
      </div>
    </div>
    {f && <button type="button" onClick={() => onBlock(f.id,"")} className="btn-secondary min-h-12 justify-self-start px-4">F · sala collegata · {f.capacity} posti senza numerazione</button>}
    <p className="text-xs text-[var(--peace-muted)]">Schema delle sedute, non planimetria delle vie di esodo. F è mostrata separatamente. Grigio: protocollo / non selezionabile; azzurro: libero; arancio: già riservato.</p>
  </div>;
}
