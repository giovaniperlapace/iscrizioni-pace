import type { MapVersion, SeatMapView } from './seat-map.ts';
import type { Nominee } from './distribution.ts';
import { isMapId } from './seat-map.ts';
export type SeatsDesk = {
  drafts?: import('./drafts.ts').CeremonyDraft[];
  notifications?: Record<string, number>;
  planId: string; kind: 'opening' | 'closing'; revision: number; state: 'draft' | 'validated';
  layoutKey: string | null; day: string; part: string; location: string; active: MapVersion | null;
  sectors: (SeatMapView['sectors'][number] & { remaining: number })[];
  groups?: { id: string; name: string }[];
  allocations: { id: string; sectorId: string; groupId: string | null; groupName: string | null; quantity: number }[];
  nominees: Nominee[]; claims: SeatMapView['claims'];
};
export type SeatPerson = { registrationId: string; name: string; code: string; place: string; group: string | null; attendance: string; priority: boolean; children: { id: string; name: string }[] };
export type SeatSubject = { registrationId: string; childId: string | null; name: string };
export type DeskCommand = { planId: string; revision: number; requestId: string; data: {
  action: 'assign' | 'assign_direct' | 'group' | 'group_nominal'; sectorId: string; seatIds: string[]; quantity: number;
  groupId: string | null; subjects: { registrationId: string; childId: string | null }[];
} };
export function parseDeskCommand(input: unknown): DeskCommand | null {
  if (!input || typeof input !== 'object') return null;
  const c = input as DeskCommand, d = c.data;
  if (!isMapId(c.planId) || !isMapId(c.requestId) || !Number.isInteger(c.revision) || c.revision < 0 || !d || !['assign','assign_direct','group','group_nominal'].includes(d.action) || !isMapId(d.sectorId) || !Number.isInteger(d.quantity) || d.quantity < 1 || d.quantity > 10000 || !Array.isArray(d.seatIds) || d.seatIds.length > 10000 || !d.seatIds.every(isMapId) || new Set(d.seatIds).size !== d.seatIds.length || !Array.isArray(d.subjects)) return null;
  if (d.seatIds.length && d.seatIds.length !== d.quantity) return null;
  if (d.action === 'group') return isMapId(d.groupId) && !d.subjects.length ? c : null;
  if ((d.groupId !== null && (!isMapId(d.groupId) || d.seatIds.length > 0)) || d.subjects.length !== d.quantity || !d.subjects.every(s => s && isMapId(s.registrationId) && (s.childId === null || isMapId(s.childId))) || new Set(d.subjects.map(s => s.childId ?? s.registrationId)).size !== d.subjects.length) return null;
  if (d.action === 'assign_direct' && (d.groupId !== null || d.seatIds.length > 0 || new Set(d.subjects.map(s => s.registrationId)).size !== 1 || (!d.subjects.some(s => s.childId === null) && d.subjects.length !== 1))) return null;
  if (d.action === 'group_nominal' && (!isMapId(d.groupId) || d.seatIds.length)) return null;
  return c;
}
