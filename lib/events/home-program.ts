import type { SupportedLocale } from "../i18n/config";
import { getPanelProgramDayKey, type PublicPanelProgramItem } from "../panels/public-program.ts";
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

/** Summary envelopes for simultaneous/overlapping panels on the same day.
 * Detailed panels retain their individual times, including the 17:00 start. */
export function getHomeProgram(locale: SupportedLocale, panels: PublicPanelProgramItem[]): HomeProgramItem[] {
  const slots: HomeProgramItem[] = [];
  const ordered = [...panels].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
  for (const panel of ordered) {
    const last = slots.at(-1);
    if (last && getPanelProgramDayKey(last.startsAt) === getPanelProgramDayKey(panel.startsAt)
      && Date.parse(panel.startsAt) < Date.parse(last.endsAt!)) {
      if (Date.parse(panel.endsAt) > Date.parse(last.endsAt!)) last.endsAt = panel.endsAt;
    } else {
      slots.push({
        id: `panels-${Date.parse(panel.startsAt)}`, startsAt: panel.startsAt, endsAt: panel.endsAt,
        title: getEventProgramCopy(locale).panelSlot, isPanelSlot: true,
      });
    }
  }
  return [...getGeneralHomeProgram(locale), ...slots]
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt) || left.id.localeCompare(right.id));
}

export function getHomeProgramDays(locale: SupportedLocale, panels: PublicPanelProgramItem[]) {
  const items = getHomeProgram(locale, panels);
  return ["2026-10-25", "2026-10-26", "2026-10-27"].map(key => ({
    key, startsAt: `${key}T12:00:00+01:00`,
    items: items.filter(item => getPanelProgramDayKey(item.startsAt) === key),
  }));
}

/** Shared summary slots and detail anchors, including later starts within a slot. */
export function getHomePanelSlots(panels: PublicPanelProgramItem[]) {
  return getHomeProgram("it", panels).filter(item => item.isPanelSlot).map(slot => ({
    ...slot,
    panels: panels.filter(panel => getPanelProgramDayKey(panel.startsAt) === getPanelProgramDayKey(slot.startsAt)
      && Date.parse(panel.startsAt) >= Date.parse(slot.startsAt)
      && Date.parse(panel.startsAt) < Date.parse(slot.endsAt!)),
  }));
}
