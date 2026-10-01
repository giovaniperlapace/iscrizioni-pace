import assisi from "./assisi-2026.json" with { type: "json" };
import type { PresenceConfig } from "./types.ts";

// Never apply one edition's group IDs or reporting sections to another event.
export function presenceConfigForEvent(eventId: string): PresenceConfig | null {
  return eventId === assisi.eventId ? assisi : null;
}
