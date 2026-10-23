import { getForumRelayRoom } from "../events/assisi-2026-relay-rooms.ts";

/** Numbered Forum titles precede unnumbered titles, independently of start time.
 * Stable ties preserve the existing order of audience sections for the same Forum. */
export function compareForums(left: { title: string; id?: string; panel_id?: string; panelId?: string }, right: { title: string; id?: string; panel_id?: string; panelId?: string }): number {
  const number = (title: string) => Number(title.match(/^\s*(?:(?:forum|panel|foro|форум)\s+[^\d–—:\-]*?)?(\d+)/i)?.[1] ?? Number.MAX_SAFE_INTEGER);
  return number(left.title) - number(right.title)
    || Number(!!getForumRelayRoom(left.id ?? left.panel_id ?? left.panelId ?? "")) - Number(!!getForumRelayRoom(right.id ?? right.panel_id ?? right.panelId ?? ""))
    || left.title.localeCompare(right.title, "it", { numeric: true, sensitivity: "base" });
}

export function sortForums<T extends { title: string }>(forums: readonly T[]): T[] {
  return [...forums].sort(compareForums);
}
