import type { SupabaseClient } from "@supabase/supabase-js";

import type { SupportedLocale } from "@/lib/i18n/config";

export const PANEL_PROGRAM_TIME_ZONE = "Europe/Rome";

export type PublicPanelAvailability = "available" | "full" | "unavailable";

export type PublicPanelProgramItem = {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  locationName: string;
  locationAddress: string | null;
  availability: PublicPanelAvailability;
};

type PublicPanelProgramRow = {
  panel_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location_name: string;
  location_address: string | null;
  availability: PublicPanelAvailability;
};

const intlLocales: Record<SupportedLocale, string> = {
  it: "it-IT",
  en: "en-GB",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
  nl: "nl-NL",
  uk: "uk-UA",
};

export async function getPublicPanelProgram(
  supabase: SupabaseClient
): Promise<PublicPanelProgramItem[]> {
  const { data, error } = await supabase.rpc("get_public_panel_program");

  if (error) {
    // Keep the public home usable during a migration-first rollout. Do not
    // hide connectivity, authorization or query failures behind an empty list.
    if (error.code === "PGRST202") {
      return [];
    }

    throw error;
  }

  return ((data ?? []) as PublicPanelProgramRow[]).map((row) => ({
    id: row.panel_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    locationName: row.location_name,
    locationAddress: row.location_address,
    availability: row.availability,
  }));
}

export function getPanelProgramDayKey(isoDate: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PANEL_PROGRAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoDate));
  const values = new Map(parts.map((part) => [part.type, part.value]));

  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function formatPanelProgramDay(
  isoDate: string,
  locale: SupportedLocale
): string {
  return new Intl.DateTimeFormat(intlLocales[locale], {
    timeZone: PANEL_PROGRAM_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(isoDate));
}

export function formatPanelProgramTimeRange(
  startsAt: string,
  endsAt: string,
  locale: SupportedLocale
): string {
  const formatter = new Intl.DateTimeFormat(intlLocales[locale], {
    timeZone: PANEL_PROGRAM_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formatter.format(new Date(startsAt))}–${formatter.format(new Date(endsAt))}`;
}

export function groupPublicPanelsByDay(items: PublicPanelProgramItem[]) {
  const groups: Array<{ key: string; startsAt: string; panels: PublicPanelProgramItem[] }> = [];

  for (const panel of items) {
    const key = getPanelProgramDayKey(panel.startsAt);
    const currentGroup = groups.at(-1);

    if (currentGroup?.key === key) {
      currentGroup.panels.push(panel);
    } else {
      groups.push({ key, startsAt: panel.startsAt, panels: [panel] });
    }
  }

  return groups;
}
