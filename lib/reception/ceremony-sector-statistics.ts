export type CeremonySectorStatistics = { sectorId: string; sector: string; capacity: number; entered: number; overbooking: number };
export function parseCeremonySectorStatistics(value: unknown): CeremonySectorStatistics[] | null {
  if (!Array.isArray(value) || value.length > 11) return null;
  if (!value.every(x => x && typeof x.sectorId === 'string' && typeof x.sector === 'string' &&
    [x.capacity, x.entered, x.overbooking].every(n => Number.isSafeInteger(n) && n >= 0))) return null;
  if (new Set(value.map(x => x.sectorId)).size !== value.length) return null;
  return value.map(({sectorId, sector, capacity, entered, overbooking}) => ({sectorId, sector, capacity, entered, overbooking}));
}
