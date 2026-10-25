import { getForumRelayRoom } from "../events/assisi-2026-relay-rooms.ts";
import type { DutyOption } from "./event-duties.ts";

type DutyTitle = Pick<DutyOption, "key" | "title" | "kind">;
// Reception-only labels, resolved from the canonical source Forum ID.
export function receptionDutyTitle(duty: DutyTitle, choices: readonly DutyTitle[] = []): string {
  const relay = duty.kind === "panel" ? getForumRelayRoom(duty.key) : undefined;
  if (!relay) return duty.title;
  const source = choices.find(item => item.kind === "panel" && item.key === relay.sourceId);
  const sourceTitle = source?.title.replace(/^\s*(?:forum\s*)?\d+\s*[-–—:.]\s*/i, "").trim();
  // The published relay title embeds the source name after the language and venue.
  const embeddedTitle = duty.title.split(" — SALA COLLEGATA — SOLO IN ITALIANO — ")[1]?.split(" — ").slice(1).join(" — ").trim();
  const name = sourceTitle || embeddedTitle;
  return `Collegata F${relay.number}${name ? ` · ${name}` : ""}`;
}
