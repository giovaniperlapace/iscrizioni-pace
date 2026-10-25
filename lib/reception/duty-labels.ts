import { getForumRelayRoom } from "../events/assisi-2026-relay-rooms.ts";
import type { DutyOption } from "./event-duties.ts";

// Reception-only display labels. Canonical/public titles and routing IDs stay intact.
export function receptionDutyTitle(duty: Pick<DutyOption, "key" | "title" | "kind">): string {
  const relay = duty.kind === "panel" ? getForumRelayRoom(duty.key) : undefined;
  if (!relay) return duty.title;
  const venue = relay.venue === "Domus Letitiae" ? "Domus" : relay.venue;
  return `Collegata F${relay.number} · ${venue}`;
}
