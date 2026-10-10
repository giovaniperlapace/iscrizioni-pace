import type { PanelDraftRow } from "./panel-drafts";
import type { EventLocationOption } from "./event-locations";
import type { PublicPanelProgramItem } from "./public-program";

/** Private preview only. Never use this mapping for the public catalogue. */
export function buildHomePreview(panels: PanelDraftRow[], locations: EventLocationOption[]) {
  const byId = new Map(locations.map(location => [location.id, location]));
  const complete: PublicPanelProgramItem[] = [];
  const incomplete: Array<{ id: string; title: string }> = [];
  for (const panel of panels) {
    const location = panel.locationId ? byId.get(panel.locationId) : null;
    if (!panel.startsAt || !panel.endsAt || !location) {
      incomplete.push({ id: panel.id, title: panel.title });
      continue;
    }
    const sections = panel.sections.filter(section => section.bookingChannel === "individual");
    for (const section of sections) {
      if (!Number.isInteger(section.occupied) || section.occupied! < 0) throw new Error("Disponibilità panel non caricata.");
    }
    const remainingSeats = sections.reduce((sum, section) => sum + Math.max(0, section.capacity - section.occupied!), 0);
    complete.push({
      id: panel.id, title: panel.title, description: panel.description,
      startsAt: panel.startsAt, endsAt: panel.endsAt,
      locationName: location.name, locationAddress: location.address,
      availability: sections.length ? remainingSeats > 0 ? "available" : "full" : "unavailable",
      remainingSeats, publicationStatus: panel.publicationStatus,
    });
  }
  complete.sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt) || left.title.localeCompare(right.title, "it", { numeric: true }) || left.id.localeCompare(right.id));
  return { panels: complete, incomplete };
}
