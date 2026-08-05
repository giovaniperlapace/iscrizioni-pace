import type { SupabaseClient } from "@supabase/supabase-js";

export const EVENT_LOCATION_NAME_MAX_LENGTH = 100;
export const EVENT_LOCATION_ADDRESS_MAX_LENGTH = 240;
export const EVENT_LOCATION_SEARCH_MAX_LENGTH = 80;

export type EventLocationPanelUsage = {
  id: string;
  title: string;
  publicationStatus: "draft" | "published";
};

export type EventLocationOption = {
  id: string;
  eventId: string;
  name: string;
  address: string | null;
  maxCapacity: number | null;
  isActive: boolean;
  panels: EventLocationPanelUsage[];
};

type EventLocationRow = {
  id: string;
  event_id: string;
  name: string;
  address: string | null;
  max_capacity: number | null;
  is_active: boolean | null;
};

type EventLocationPanelRow = {
  id: string;
  location_id: string | null;
  title: string;
  publication_status: string | null;
};

export async function getEventLocations(
  supabase: SupabaseClient,
  eventId: string
): Promise<EventLocationOption[]> {
  const [locationsResult, panelsResult] = await Promise.all([
    supabase
      .from("event_locations")
      .select("id,event_id,name,address,max_capacity,is_active")
      .eq("event_id", eventId)
      .order("name", { ascending: true }),
    supabase
      .from("event_moments")
      .select("id,location_id,title,publication_status")
      .eq("event_id", eventId)
      .eq("moment_type", "panel")
      .order("starts_at", { ascending: true }),
  ]);

  if (locationsResult.error) {
    throw locationsResult.error;
  }

  if (panelsResult.error) {
    throw panelsResult.error;
  }

  const panelsByLocation = new Map<string, EventLocationPanelUsage[]>();

  for (const panel of (panelsResult.data ?? []) as EventLocationPanelRow[]) {
    if (!panel.location_id) {
      continue;
    }

    const panels = panelsByLocation.get(panel.location_id) ?? [];
    panels.push({
      id: panel.id,
      title: panel.title,
      publicationStatus:
        panel.publication_status === "published" ? "published" : "draft",
    });
    panelsByLocation.set(panel.location_id, panels);
  }

  return ((locationsResult.data ?? []) as EventLocationRow[]).map((location) => ({
      id: location.id,
      eventId: location.event_id,
      name: location.name,
      address: location.address,
      maxCapacity:
        Number.isInteger(location.max_capacity) && (location.max_capacity ?? 0) > 0
          ? location.max_capacity
          : null,
      isActive: location.is_active !== false,
      panels: panelsByLocation.get(location.id) ?? [],
    }));
}

export function normalizeEventLocationName(value: FormDataEntryValue | null): string {
  return normalizeSingleLine(value);
}

export function normalizeEventLocationAddress(
  value: FormDataEntryValue | null
): string | null {
  return normalizeSingleLine(value) || null;
}

export function parseEventLocationCapacity(
  value: FormDataEntryValue | null
): number | null {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const capacity = Number(normalized);
  return Number.isSafeInteger(capacity) && capacity > 0 ? capacity : null;
}

export function normalizeEventLocationSearch(value: string | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, EVENT_LOCATION_SEARCH_MAX_LENGTH);
}

export function filterEventLocations(
  locations: EventLocationOption[],
  query: string
): EventLocationOption[] {
  if (!query) {
    return locations;
  }

  const needle = query.toLocaleLowerCase("it");

  return locations.filter((location) =>
    [location.name, location.address, ...location.panels.map((panel) => panel.title)]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("it")
      .includes(needle)
  );
}

function normalizeSingleLine(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}
