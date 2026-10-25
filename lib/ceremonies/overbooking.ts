import { isMapId } from './seat-map.ts';
import type { SeatsDesk } from './seats-desk.ts';
import { sectorCounts } from './drafts.ts';

export type OverbookingCommand = {
  planId: string; sectorId: string; revision: number; requestId: string; extra: number;
};
export function parseOverbookingCommand(input: unknown): OverbookingCommand | null {
  if (!input || typeof input !== 'object') return null;
  const c = input as OverbookingCommand;
  return isMapId(c.planId) && isMapId(c.sectorId) && isMapId(c.requestId) &&
    Number.isInteger(c.revision) && c.revision >= 0 && c.revision < 2147483647 &&
    Number.isInteger(c.extra) && c.extra >= 0 && c.extra <= 10000 ? c : null;
}
export function sectorCapacitySummary(desk: SeatsDesk, sectorId: string) {
  const sector = desk.sectors.find(s => s.id === sectorId)!;
  const counts = sectorCounts(desk, sectorId);
  const assigned = counts.nominal + counts.groupPending + counts.draft;
  const extra = sector.overbooking ?? 0;
  const base = sector.baseAssignable ?? sector.assignableLimit ?? sector.capacity ?? 0;
  return { ...counts, assigned, extra, base, physical: sector.capacity,
    total: base + extra, usedExtra: Math.max(0, assigned - base),
    ordinaryRemaining: Math.max(0, base - assigned),
    extraRemaining: Math.max(0, extra - Math.max(0, assigned - base)) };
}
