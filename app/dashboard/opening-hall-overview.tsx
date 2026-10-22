"use client";
import { useMemo } from "react";
import { openingSeatAddress } from "@/lib/ceremonies/seat-label";
import type { MapSeat, SeatMapView } from "@/lib/ceremonies/seat-map";

// Stage above: blocks 1–6 run left to right while facing the stage.
// B1 and B2 have independent bands and click targets, sharing stable seat IDs.
export function OpeningHallOverview({ seats, sectors, claims, onBlock }: {
  seats: MapSeat[]; sectors: SeatMapView["sectors"]; claims: SeatMapView["claims"];
  onBlock: (sector: string, block: string) => void;
}) {
  const occupied = useMemo(() => new Set(claims.map(c => c.seatId)), [claims]);
  const bands = useMemo(() => {
    const groups = new Map<string, { key: string; block: number; sectorId: string; band: string; seats: MapSeat[] }>();
    for (const seat of seats) {
      const address = openingSeatAddress(seat.row);
      const sector = sectors.find(s => s.id === seat.sectorId);
      if (!address || !sector) continue;
      const code = sector.layoutCode ?? sector.name;
      const band = code.startsWith('A') ? 'A' : code.startsWith('H') ? 'H' : code;
      const key = `${seat.sectorId}:${address.key}`;
      const group = groups.get(key) ?? { key: address.key, block: address.block, sectorId: seat.sectorId, band, seats: [] };
      group.seats.push(seat); groups.set(key,group);
    }
    return ['A','B1','B2','C','D','E','H'].map(band => ({ band, groups: [...groups.values()].filter(g => g.band === band).sort((a,b) => a.block-b.block) })).filter(b => b.groups.length);
  }, [seats,sectors]);
  const name = (id: string) => sectors.find(s => s.id === id)?.name ?? '';
  const f = sectors.find(s => s.layoutCode === 'F');
  return <div className="grid min-w-0 gap-3">
    <p className="text-sm text-[var(--peace-muted)]">Palco in alto. Blocchi da 1 a 6 da sinistra a destra guardando il palco; file dalla più vicina alla più lontana. Scegli un blocco per vedere le sedie.</p>
    <div className="max-w-full overflow-auto rounded-xl border border-[var(--peace-border)] bg-slate-50 p-3" role="region" aria-label="Piantina generale inaugurazione" tabIndex={0}>
      <div className="grid min-w-[720px] gap-4">
        <div className="rounded-xl bg-[var(--peace-blue-800)] p-3 text-center font-bold tracking-widest text-white">PALCO</div>
        {bands.map(({band,groups}) => <section key={band} aria-label={band === 'A' ? 'Settori A1, A e A2' : band === 'H' ? 'Settori H1 e H2' : `Settore ${band}`} className={`rounded-xl border-2 p-2 ${band === 'B1' ? 'border-blue-600 bg-blue-50' : band === 'B2' ? 'border-violet-600 bg-violet-50' : 'border-slate-200 bg-white/60'}`}>
          <h3 className={`mb-2 text-sm font-bold ${band === 'B1' ? 'text-blue-900' : band === 'B2' ? 'text-violet-900' : ''}`}>{band === 'A' ? 'Settori A1 · A · A2' : band === 'H' ? 'Settori H1 · H2' : `Settore ${band}`}{band === 'B1' ? ' · File 1–5 · 300 sedie' : band === 'B2' ? ' · File 6–10 · 300 sedie' : ''}</h3>
          <div className="grid grid-cols-6 gap-2">{groups.map(group => {
            const firstRow = Math.min(...group.seats.map(s => openingSeatAddress(s.row)!.row));
            const lastRow = Math.max(...group.seats.map(s => openingSeatAddress(s.row)!.row));
            const free = group.seats.filter(s => !s.blocked && !occupied.has(s.id)).length;
            return <button key={`${group.sectorId}:${group.key}`} type="button" onClick={() => onBlock(group.sectorId,group.key)} aria-label={`Settore ${name(group.sectorId)} · Blocco ${group.block} · File ${firstRow}–${lastRow} · ${free} sedie libere`} className="grid content-start gap-1 rounded-lg border border-slate-300 bg-white p-2 text-left text-xs focus-visible:outline-4 focus-visible:outline-blue-700" style={{gridColumn:group.block}}>
              <span className="font-semibold">Settore {name(group.sectorId)}</span><span>Blocco {group.block}</span>
              <svg viewBox={`0 0 104 ${(lastRow-firstRow+1)*10+4}`} className="my-1 w-full" aria-hidden="true">{group.seats.map(s => <rect key={s.id} x={(Number(s.number)-1)*10+2} y={(openingSeatAddress(s.row)!.row-firstRow)*10+2} width="7" height="7" rx="1" fill={s.blocked?'#94a3b8':occupied.has(s.id)?'#d97706':'#dbeafe'}/>)}</svg>
              <span>File {firstRow}–{lastRow}</span><span>{free} libere / {group.seats.length}</span>
            </button>;
          })}</div>
        </section>)}
      </div>
    </div>
    {f && <button type="button" onClick={() => onBlock(f.id,'')} className="btn-secondary min-h-12 justify-self-start px-4">Settore F · sala collegata · {f.capacity} posti senza numerazione</button>}
    <p className="text-xs text-[var(--peace-muted)]">Schema delle sedute, non planimetria delle vie di esodo. Grigio: protocollo / non selezionabile; azzurro: libero; arancio: già riservato.</p>
  </div>;
}
