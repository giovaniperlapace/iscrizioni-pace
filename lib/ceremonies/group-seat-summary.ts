import { openingSeatAddress } from './seat-label.ts';
export type GroupCeremonyPlaces = { kind: 'opening' | 'closing'; sector: string; quantity: number; ranges: string[]; unnumbered: number };
export type GroupCeremonySummary = { status: 'ready'; items: GroupCeremonyPlaces[] } | { status: 'unavailable' };
// Merge only consecutive numeric chairs within the same physical row.
export function ceremonySeatRanges(sector: string, seats: { row: string; number: string }[]) {
  const rows = new Map<string, Set<string>>();
  for (const seat of seats) {
    const numbers = rows.get(seat.row) ?? new Set<string>(); numbers.add(seat.number); rows.set(seat.row, numbers);
  }
  return [...rows].sort(([a],[b]) => a.localeCompare(b, 'it', {numeric:true})).map(([row,numbers]) => {
    const address = openingSeatAddress(row), sorted = [...numbers].sort((a,b) => a.localeCompare(b,'it',{numeric:true}));
    const runs: string[] = [];
    for (let i=0; i<sorted.length; i++) {
      const start=sorted[i]; let end=start;
      while (i+1<sorted.length && /^(0|[1-9]\d*)$/.test(end) && /^(0|[1-9]\d*)$/.test(sorted[i+1]) && Number(sorted[i+1]) === Number(end)+1) end=sorted[++i];
      runs.push(start === end ? start : `${start}–${end}`);
    }
    return `Settore ${sector}${address ? ` · Blocco ${address.block}` : ''} · Fila ${address?.row ?? row} · ${numbers.size === 1 ? 'Sedia' : 'Sedie'} ${runs.join(', ')}`;
  });
}
