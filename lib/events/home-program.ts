import type { SupportedLocale } from "../i18n/config";
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
