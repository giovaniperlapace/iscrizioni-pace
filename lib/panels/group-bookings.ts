export type GroupPanel = {
  panelId: string; sectionId: string; title: string; audience: string;
  startsAt: string; endsAt: string; location: string; remaining: number;
};
export type GroupPanelParticipant = {
  registrationId: string; name: string; code: string | null; groupId: string; groupName: string;
  seats: number; status: "available" | "selected" | "conflict" | "full";
};
export type GroupPanelView = { panels: GroupPanel[]; participants: GroupPanelParticipant[] };
export type GroupBookingResult = { count: number; seats: number } | { error: "failure" | "scopeError" | "fullError" | "conflictError" | "unavailable" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string { return typeof value === "string" && UUID.test(value); }
export function validGroupBookingSelection(section: unknown, ids: unknown): ids is string[] {
  return isUuid(section) && Array.isArray(ids) && ids.length > 0 && ids.every(isUuid);
}
export function filterGroupPanelParticipants(rows: GroupPanelParticipant[], query: string, group: string) {
  const search = query.trim().toLocaleLowerCase();
  return rows.filter(row => (!group || row.groupId === group) &&
    (!search || `${row.name} ${row.code ?? ""}`.toLocaleLowerCase().includes(search)));
}
export function toggleVisiblePanelSelection(selected: string[], visible: GroupPanelParticipant[]): string[] {
  const eligible = visible.filter(row => row.status === "available").map(row => row.registrationId);
  const next = new Set(selected);
  const remove = eligible.length > 0 && eligible.every(id => next.has(id));
  for (const id of eligible) { if (remove) next.delete(id); else next.add(id); }
  return [...next];
}
export function groupBookingError(error: {code?: string; message: string}): GroupBookingResult {
  if (error.code === "42501") return {error: "scopeError"};
  if (error.code === "23P01") return {error: "conflictError"};
  if (/full|capacity exceeded/i.test(error.message)) return {error: "fullError"};
  if (error.code === "22023" || error.code === "P0002") return {error: "unavailable"};
  return {error: "failure"};
}
