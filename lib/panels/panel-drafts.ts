import type { SupabaseClient } from "@supabase/supabase-js";

export const PANEL_TITLE_MAX_LENGTH = 160;
export const PANEL_DESCRIPTION_MAX_LENGTH = 2000;
export const PANEL_SEARCH_MAX_LENGTH = 80;
export const PANEL_MAX_SECTIONS = 20;
export const PANEL_TIME_ZONE = "Europe/Rome";

export type PanelAudienceTypeOption = {
  id: string;
  name: string;
  code: string;
  bookingChannel: "individual" | "school_booking" | "internal_assignment";
  isActive: boolean;
};

export type PanelSeatSection = {
  id: string;
  audienceTypeId: string;
  audienceName: string;
  bookingChannel: PanelAudienceTypeOption["bookingChannel"];
  capacity: number;
};

export type PanelDraftRow = {
  id: string;
  eventId: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  locationId: string | null;
  locationName: string | null;
  locationCapacity: number | null;
  publicationStatus: "draft" | "published";
  publishedAt: string | null;
  updatedAt: string | null;
  confirmedRegistrationCount: number;
  sections: PanelSeatSection[];
  assignedCapacity: number;
};

export type PanelDraftFilters = {
  query: string;
  status: "all" | "draft" | "published";
  date: string;
  locationId: string;
};

type PanelRow = {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location_id: string | null;
  publication_status: string | null;
  published_at: string | null;
  updated_at: string | null;
};

type SectionRow = {
  id: string;
  panel_id: string;
  audience_type_id: string;
  capacity: number;
};

type AudienceRow = {
  id: string;
  name: string;
  code: string;
  booking_channel: PanelAudienceTypeOption["bookingChannel"];
  is_active: boolean | null;
  sort_order: number | null;
};

type LocationRow = {
  id: string;
  name: string;
  max_capacity: number | null;
};

export async function getPanelDraftCatalog(
  supabase: SupabaseClient,
  eventId: string
): Promise<{ panels: PanelDraftRow[]; audienceTypes: PanelAudienceTypeOption[] }> {
  const [panelsResult, sectionsResult, audienceResult, locationsResult] =
    await Promise.all([
      supabase
        .from("event_moments")
        .select(
          "id,event_id,title,description,starts_at,ends_at,location_id,publication_status,published_at,updated_at"
        )
        .eq("event_id", eventId)
        .eq("moment_type", "panel")
        .order("starts_at", { ascending: true }),
      supabase
        .from("panel_seat_sections")
        .select("id,panel_id,audience_type_id,capacity")
        .eq("event_id", eventId),
      supabase
        .from("panel_audience_types")
        .select("id,name,code,booking_channel,is_active,sort_order")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("event_locations")
        .select("id,name,max_capacity")
        .eq("event_id", eventId),
    ]);

  for (const result of [panelsResult, sectionsResult, audienceResult, locationsResult]) {
    if (result.error) {
      throw result.error;
    }
  }

  const panelRows = (panelsResult.data ?? []) as PanelRow[];
  const panelIds = panelRows.map((row) => row.id);
  const choicesResult = panelIds.length
    ? await supabase
        .from("moment_attendance_choices")
        .select("moment_id,registration_id,registrations!inner(status)")
        .in("moment_id", panelIds)
        .eq("choice", "yes")
        .neq("registrations.status", "cancelled")
    : { data: [], error: null };

  if (choicesResult.error) {
    throw choicesResult.error;
  }

  const confirmedRegistrationsByPanel = new Map<string, Set<string>>();
  for (const choice of (choicesResult.data ?? []) as Array<{
    moment_id: string;
    registration_id: string;
  }>) {
    const registrations =
      confirmedRegistrationsByPanel.get(choice.moment_id) ?? new Set<string>();
    registrations.add(choice.registration_id);
    confirmedRegistrationsByPanel.set(choice.moment_id, registrations);
  }

  const audienceRows = (audienceResult.data ?? []) as AudienceRow[];
  const audienceById = new Map(audienceRows.map((row) => [row.id, row]));
  const locationsById = new Map(
    ((locationsResult.data ?? []) as LocationRow[]).map((row) => [row.id, row])
  );
  const sectionsByPanel = new Map<string, PanelSeatSection[]>();

  for (const row of (sectionsResult.data ?? []) as SectionRow[]) {
    const audience = audienceById.get(row.audience_type_id);

    if (!audience) {
      continue;
    }

    const sections = sectionsByPanel.get(row.panel_id) ?? [];
    sections.push({
      id: row.id,
      audienceTypeId: row.audience_type_id,
      audienceName: audience.name,
      bookingChannel: audience.booking_channel,
      capacity: row.capacity,
    });
    sectionsByPanel.set(row.panel_id, sections);
  }

  const panels = panelRows.map((row) => {
    const location = row.location_id ? locationsById.get(row.location_id) : null;
    const sections = sectionsByPanel.get(row.id) ?? [];

    return {
      id: row.id,
      eventId: row.event_id,
      title: row.title,
      description: row.description,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      locationId: row.location_id,
      locationName: location?.name ?? null,
      locationCapacity: location?.max_capacity ?? null,
      publicationStatus:
        row.publication_status === "published" ? "published" : "draft",
      publishedAt: row.published_at,
      updatedAt: row.updated_at,
      confirmedRegistrationCount:
        confirmedRegistrationsByPanel.get(row.id)?.size ?? 0,
      sections,
      assignedCapacity: sections.reduce((sum, section) => sum + section.capacity, 0),
    } satisfies PanelDraftRow;
  });

  return {
    panels,
    audienceTypes: audienceRows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      bookingChannel: row.booking_channel,
      isActive: row.is_active !== false,
    })),
  };
}

export function normalizePanelTitle(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function normalizePanelDescription(
  value: FormDataEntryValue | null
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\r\n/g, "\n").trim();
  return normalized || null;
}

export function parsePanelCapacity(value: FormDataEntryValue | null): number | null {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const capacity = Number(normalized);
  return Number.isSafeInteger(capacity) && capacity >= 0 ? capacity : null;
}

export function parsePanelLocalDateTime(
  value: FormDataEntryValue | null
): Date | null {
  const normalized = typeof value === "string" ? value.trim() : "";
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const guessedDate = new Date(utcGuess);

  if (
    guessedDate.getUTCFullYear() !== year ||
    guessedDate.getUTCMonth() !== month - 1 ||
    guessedDate.getUTCDate() !== day ||
    guessedDate.getUTCHours() !== hour ||
    guessedDate.getUTCMinutes() !== minute
  ) {
    return null;
  }

  let instant = utcGuess;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    instant = utcGuess - getTimeZoneOffsetMilliseconds(new Date(instant));
  }

  const result = new Date(instant);
  return Number.isNaN(result.getTime()) ? null : result;
}

export function parsePanelDraftFilters(input: {
  panelQ?: string;
  panelStatus?: string;
  panelDate?: string;
  panelLocation?: string;
}): PanelDraftFilters {
  const status =
    input.panelStatus === "draft" || input.panelStatus === "published"
      ? input.panelStatus
      : "all";

  return {
    query: (input.panelQ ?? "").replace(/\s+/g, " ").trim().slice(0, PANEL_SEARCH_MAX_LENGTH),
    status,
    date: /^\d{4}-\d{2}-\d{2}$/.test(input.panelDate ?? "")
      ? input.panelDate ?? ""
      : "",
    locationId: input.panelLocation?.trim() || "all",
  };
}

export function filterPanelDrafts(
  panels: PanelDraftRow[],
  filters: PanelDraftFilters
): PanelDraftRow[] {
  const needle = filters.query.toLocaleLowerCase("it");

  return panels.filter((panel) => {
    if (filters.status !== "all" && panel.publicationStatus !== filters.status) {
      return false;
    }

    if (filters.locationId !== "all" && panel.locationId !== filters.locationId) {
      return false;
    }

    if (filters.date && panelDateKey(panel.startsAt) !== filters.date) {
      return false;
    }

    if (
      needle &&
      ![panel.title, panel.description, panel.locationName]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("it")
        .includes(needle)
    ) {
      return false;
    }

    return true;
  });
}

export function panelDateKey(value: string | null): string {
  if (!value) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PANEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function panelDateTimeLocalValue(value: string | null): string {
  if (!value) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: PANEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}T${byType.hour}:${byType.minute}`;
}

export function panelCapacityDifference(
  assigned: number,
  capacity: number | null
): number | null {
  return capacity === null ? null : capacity - assigned;
}

export function findPanelScheduleConflict(
  input: {
    panelId?: string | null;
    locationId: string;
    startsAtLocal: string;
    endsAtLocal: string;
  },
  panels: Array<{
    id: string;
    title: string;
    locationId: string | null;
    startsAt: string | null;
    endsAt: string | null;
  }>
) {
  const start = parsePanelLocalDateTime(input.startsAtLocal)?.getTime();
  const end = parsePanelLocalDateTime(input.endsAtLocal)?.getTime();

  if (!input.locationId || start === undefined || end === undefined || end <= start) {
    return null;
  }

  return (
    panels.find((panel) => {
      if (
        panel.id === input.panelId ||
        panel.locationId !== input.locationId ||
        !panel.startsAt ||
        !panel.endsAt
      ) {
        return false;
      }

      return start < new Date(panel.endsAt).getTime() && end > new Date(panel.startsAt).getTime();
    }) ?? null
  );
}

function getTimeZoneOffsetMilliseconds(date: Date): number {
  const zoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: PANEL_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = zoneName?.match(/^GMT([+-])(\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error(`Unable to resolve ${PANEL_TIME_ZONE} offset`);
  }

  const [, sign, hours, minutes] = match;
  const value = (Number(hours) * 60 + Number(minutes)) * 60 * 1000;
  return sign === "+" ? value : -value;
}
