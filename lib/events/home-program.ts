import type { SupportedLocale } from "../i18n/config";
import type { PublicPanelProgramItem } from "../panels/public-program";
import { getEventProgramCopy } from "./program-copy.ts";

export const EVENT_PROGRAM_SOURCE = "https://meetingsforpeace.santegidio.org/pageID/32281/langID/it/PROGRAMMA.html";
// Transcribed 2026-10-10. Only general events: panels always come from the database.
// The source supplies start times only; do not invent end times or capacities.
export function getGeneralHomeProgram(locale: SupportedLocale) {
  const copy = getEventProgramCopy(locale);
  return [
    { id: "opening", startsAt: "2026-10-25T16:30:00+01:00", title: copy.opening, location: "Umbria Fiere, Bastia Umbra" },
    { id: "prayers", startsAt: "2026-10-27T15:30:00+01:00", title: copy.prayers, location: copy.prayerPlace },
    { id: "closing", startsAt: "2026-10-27T16:15:00+01:00", title: copy.closing, location: "Assisi" },
  ];
}

export type HomeProgramItem = {
  id: string;
  startsAt: string;
  endsAt?: string;
  title: string;
  location?: string;
  isPanelSlot?: boolean;
};

/** Each actual start/end pair is a slot. Different days and exceptional
 * schedules remain separate; never stretch a slot across overlapping panels. */
export function getHomeProgram(locale: SupportedLocale, panels: PublicPanelProgramItem[]): HomeProgramItem[] {
  const slots = new Map<string, HomeProgramItem>();
  for (const panel of panels) {
    const start = Date.parse(panel.startsAt);
    const end = Date.parse(panel.endsAt);
    const key = `${start}-${end}`;
    if (!slots.has(key)) slots.set(key, {
      id: `panels-${key}`, startsAt: panel.startsAt, endsAt: panel.endsAt,
      title: getEventProgramCopy(locale).panelSlot, isPanelSlot: true,
    });
  }
  return [...getGeneralHomeProgram(locale), ...slots.values()]
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt) || left.id.localeCompare(right.id));
}
