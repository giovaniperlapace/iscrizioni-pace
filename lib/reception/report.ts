export type ReceptionCounts = { adults: number; children: number; students: number; companions: number; schoolBookings: number };
export type ReceptionReport = {
  eventId: string; updatedAt: string; day: string | null; part: 'all' | 'morning' | 'afternoon';
  expected: ReceptionCounts; arrivals: ReceptionCounts;
  operations: { duplicateRequests: number; retries: number; corrections: number; cancellations: number };
  hours: { hour: string; people: number }[];
};
export const countPeople = (counts: ReceptionCounts) => counts.adults + counts.children + counts.students + counts.companions;
export function parseReportFilter(params: URLSearchParams) {
  const eventId = params.get('eventId') ?? '';
  const day = params.get('day') || null;
  const part = params.get('part') ?? 'all';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId) ||
    (day !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10) !== day)) ||
    !['all','morning','afternoon'].includes(part) || (!day && part !== 'all')) return null;
  return { eventId, day, part: part as ReceptionReport['part'] };
}
// Project only aggregate fields; malformed or partial data is never a zero.
export function projectReceptionReport(input: unknown): ReceptionReport | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as ReceptionReport;
  const nonnegative = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  const counts = (c: ReceptionCounts) => c && ['adults','children','students','companions','schoolBookings'].every(k => nonnegative(c[k as keyof ReceptionCounts]));
  if (typeof row.eventId !== 'string' || typeof row.updatedAt !== 'string' || !Number.isFinite(Date.parse(row.updatedAt)) ||
    (row.day !== null && typeof row.day !== 'string') || !['all','morning','afternoon'].includes(row.part) ||
    !counts(row.expected) || !counts(row.arrivals) || !row.operations ||
    !['duplicateRequests','retries','corrections','cancellations'].every(k => nonnegative(row.operations[k as keyof ReceptionReport['operations']])) ||
    !Array.isArray(row.hours) || !row.hours.every(h => h && /^\d{4}-\d{2}-\d{2} \d{2}:00$/.test(h.hour) && nonnegative(h.people))) return null;
  const projectCounts = (c: ReceptionCounts) => ({ adults:c.adults, children:c.children, students:c.students, companions:c.companions, schoolBookings:c.schoolBookings });
  return { eventId:row.eventId, updatedAt:row.updatedAt, day:row.day, part:row.part,
    expected:projectCounts(row.expected), arrivals:projectCounts(row.arrivals),
    operations:{ duplicateRequests:row.operations.duplicateRequests, retries:row.operations.retries, corrections:row.operations.corrections, cancellations:row.operations.cancellations },
    hours:row.hours.map(h => ({ hour:h.hour, people:h.people })) };
}
