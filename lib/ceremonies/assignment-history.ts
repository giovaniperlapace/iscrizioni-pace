import { isMapId, type MapSeat } from './seat-map.ts';
export type AssignmentEntry = {
  kind: 'allocation' | 'nominee' | 'seat'; id: string; allocationId: string; name: string; groupName: string | null;
  createdAt: string; revokedAt: string | null; quantity: number; sector: string; numbered: boolean;
  seats: MapSeat[]; people: string[];
};
export type AssignmentHistory = { revision: number; total: number; page: number; pageCount: number; entries: AssignmentEntry[] };
export type HistoryQuery = { planId: string; page: number; search: string; state: 'all' | 'active' | 'revoked' };
export type RevokeAssignment = { planId: string; revision: number; requestId: string; kind: 'allocation' | 'nominee'; id: string };
export type HistoryResult = { status: string; history?: AssignmentHistory };
export function parseHistoryQuery(value: unknown): HistoryQuery | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as HistoryQuery;
  return isMapId(c.planId) && Number.isInteger(c.page) && c.page >= 1 && c.page <= 1000000 && typeof c.search === 'string' && c.search.length <= 200 && ['all','active','revoked'].includes(c.state) ? c : null;
}
export function parseRevokeAssignment(value: unknown): RevokeAssignment | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as RevokeAssignment;
  return isMapId(c.planId) && isMapId(c.requestId) && isMapId(c.id) && Number.isInteger(c.revision) && c.revision >= 0 && ['allocation','nominee'].includes(c.kind) ? c : null;
}

export type RevokeSeat = { planId: string; revision: number; requestId: string; seatId: string };
export function parseRevokeSeat(value: unknown): RevokeSeat | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as RevokeSeat;
  return isMapId(c.planId) && isMapId(c.requestId) && isMapId(c.seatId) && Number.isInteger(c.revision) && c.revision >= 0 ? c : null;
}
