import type { SupabaseClient } from "@supabase/supabase-js";

import { PANEL_TIME_ZONE } from "./panel-drafts.ts";

export type PanelStatisticsBookingChannel =
  | "individual"
  | "school_booking"
  | "internal_assignment"
  | "unknown";

export type PanelStatisticsState =
  | "available"
  | "nearly_full"
  | "full"
  | "not_configured"
  | "inconsistent";

export type PanelStatisticsAudienceInput = {
  id: string;
  name: string;
  bookingChannel: PanelStatisticsBookingChannel;
};

export type PanelStatisticsLocationInput = {
  id: string;
  name: string;
  maxCapacity: number | null;
};

export type PanelStatisticsPanelInput = {
  id: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  locationId: string | null;
  publicationStatus: "draft" | "published";
};

export type PanelStatisticsSectionInput = {
  id: string;
  panelId: string;
  audienceTypeId: string;
  capacity: number;
};

export type PanelStatisticsIndividualChoiceInput = {
  registrationId: string;
  panelId: string;
  sectionId: string | null;
  choice: string;
  registrationStatus: string;
  childrenCount: number;
};

export type PanelStatisticsSchoolReservationInput = {
  bookingId: string;
  panelId: string;
  sectionId: string;
  reservationStatus: string;
  bookingStatus: string;
  studentCount: number;
  companionCount: number;
};

export type PanelStatisticsSectionRow = {
  id: string;
  audienceTypeId: string;
  audienceName: string;
  bookingChannel: PanelStatisticsBookingChannel;
  capacity: number;
  individualBookings: number;
  individualPeople: number;
  inheritedChildren: number;
  schoolBookings: number;
  schoolPeople: number;
  bookedPeople: number;
  remainingSeats: number;
  isInconsistent: boolean;
};

export type PanelStatisticsRow = {
  id: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  day: string | null;
  locationId: string | null;
  locationName: string;
  locationCapacity: number | null;
  publicationStatus: "draft" | "published";
  state: PanelStatisticsState;
  issues: string[];
  sections: PanelStatisticsSectionRow[];
  capacity: number;
  individualBookings: number;
  individualPeople: number;
  inheritedChildren: number;
  schoolBookings: number;
  schoolPeople: number;
  bookedPeople: number;
  remainingSeats: number;
  utilizationPercent: number | null;
  actualPeople: number | null;
  noShowPeople: number | null;
};

export type PanelStatisticsSummary = {
  panelCount: number;
  totalCapacity: number;
  bookedPeople: number;
  remainingSeats: number;
  overCapacitySeats: number;
  individualPeople: number;
  inheritedChildren: number;
  schoolBookings: number;
  schoolPeople: number;
  stateCounts: Record<PanelStatisticsState, number>;
};

export type PanelStatisticsSnapshot = {
  panels: PanelStatisticsRow[];
  audienceTypes: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  days: string[];
  summary: PanelStatisticsSummary;
  actualAttendanceAvailable: boolean;
};

type PanelDbRow = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  location_id: string | null;
  publication_status: string | null;
};

type LocationDbRow = {
  id: string;
  name: string;
  max_capacity: number | null;
};

type AudienceDbRow = {
  id: string;
  name: string;
  booking_channel: string;
  sort_order: number | null;
};

type SectionDbRow = {
  id: string;
  panel_id: string;
  audience_type_id: string;
  capacity: number;
};

type IndividualChoiceDbRow = {
  registration_id: string;
  moment_id: string;
  seat_section_id: string | null;
  choice: string;
  registrations:
    | {
        status: string;
        registration_children: Array<{ id: string }> | null;
      }
    | Array<{
        status: string;
        registration_children: Array<{ id: string }> | null;
      }>
    | null;
};

type SchoolReservationDbRow = {
  booking_id: string;
  panel_id: string;
  seat_section_id: string;
  student_count: number;
  companion_count: number;
  status: string;
  school_bookings:
    | { status: string }
    | Array<{ status: string }>
    | null;
};

const PAGE_SIZE = 1000;

export function emptyPanelStatisticsSnapshot(): PanelStatisticsSnapshot {
  return {
    panels: [],
    audienceTypes: [],
    locations: [],
    days: [],
    summary: emptyPanelStatisticsSummary(),
    actualAttendanceAvailable: false,
  };
}

export async function getPanelStatisticsSnapshot(
  supabase: SupabaseClient,
  eventId: string
): Promise<PanelStatisticsSnapshot> {
  const [panelsResult, locationsResult, audiencesResult, sectionsResult] =
    await Promise.all([
      supabase
        .from("event_moments")
        .select("id,title,starts_at,ends_at,location_id,publication_status")
        .eq("event_id", eventId)
        .eq("moment_type", "panel")
        .order("starts_at", { ascending: true }),
      supabase
        .from("event_locations")
        .select("id,name,max_capacity")
        .eq("event_id", eventId),
      supabase
        .from("panel_audience_types")
        .select("id,name,booking_channel,sort_order")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("panel_seat_sections")
        .select("id,panel_id,audience_type_id,capacity")
        .eq("event_id", eventId),
    ]);

  for (const result of [
    panelsResult,
    locationsResult,
    audiencesResult,
    sectionsResult,
  ]) {
    if (result.error) {
      throw result.error;
    }
  }

  const panels = (panelsResult.data ?? []) as PanelDbRow[];
  const panelIds = panels.map((panel) => panel.id);
  const [individualChoices, schoolReservations] = await Promise.all([
    getAllIndividualChoices(supabase, panelIds),
    getAllSchoolReservations(supabase, eventId),
  ]);

  return buildPanelStatisticsSnapshot({
    panels: panels.map((panel) => ({
      id: panel.id,
      title: panel.title,
      startsAt: panel.starts_at,
      endsAt: panel.ends_at,
      locationId: panel.location_id,
      publicationStatus:
        panel.publication_status === "published" ? "published" : "draft",
    })),
    locations: ((locationsResult.data ?? []) as LocationDbRow[]).map(
      (location) => ({
        id: location.id,
        name: location.name,
        maxCapacity: location.max_capacity,
      })
    ),
    audiences: ((audiencesResult.data ?? []) as AudienceDbRow[]).map(
      (audience) => ({
        id: audience.id,
        name: audience.name,
        bookingChannel: normalizeBookingChannel(audience.booking_channel),
      })
    ),
    sections: ((sectionsResult.data ?? []) as SectionDbRow[]).map((section) => ({
      id: section.id,
      panelId: section.panel_id,
      audienceTypeId: section.audience_type_id,
      capacity: section.capacity,
    })),
    individualChoices,
    schoolReservations,
  });
}

export function buildPanelStatisticsSnapshot({
  panels,
  locations,
  audiences,
  sections,
  individualChoices,
  schoolReservations,
}: {
  panels: PanelStatisticsPanelInput[];
  locations: PanelStatisticsLocationInput[];
  audiences: PanelStatisticsAudienceInput[];
  sections: PanelStatisticsSectionInput[];
  individualChoices: PanelStatisticsIndividualChoiceInput[];
  schoolReservations: PanelStatisticsSchoolReservationInput[];
}): PanelStatisticsSnapshot {
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const audienceById = new Map(audiences.map((audience) => [audience.id, audience]));
  const panelById = new Map(panels.map((panel) => [panel.id, panel]));
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const sectionsByPanel = new Map<string, PanelStatisticsSectionInput[]>();

  for (const section of sections) {
    const current = sectionsByPanel.get(section.panelId) ?? [];
    current.push(section);
    sectionsByPanel.set(section.panelId, current);
  }

  const individualBySection = new Map<
    string,
    Map<string, PanelStatisticsIndividualChoiceInput>
  >();
  const orphanIndividualPanelIds = new Set<string>();

  for (const choice of individualChoices) {
    if (choice.choice !== "yes" || choice.registrationStatus === "cancelled") {
      continue;
    }

    if (
      !choice.sectionId ||
      !panelById.has(choice.panelId) ||
      sectionById.get(choice.sectionId)?.panelId !== choice.panelId
    ) {
      orphanIndividualPanelIds.add(choice.panelId);
      continue;
    }

    const current = individualBySection.get(choice.sectionId) ?? new Map();
    const existing = current.get(choice.registrationId);

    if (!existing || choice.childrenCount > existing.childrenCount) {
      current.set(choice.registrationId, choice);
    }

    individualBySection.set(choice.sectionId, current);
  }

  const schoolsBySection = new Map<
    string,
    Map<string, PanelStatisticsSchoolReservationInput>
  >();
  const orphanSchoolPanelIds = new Set<string>();

  for (const reservation of schoolReservations) {
    if (
      reservation.reservationStatus !== "reserved" ||
      reservation.bookingStatus === "cancelled"
    ) {
      continue;
    }

    if (
      !panelById.has(reservation.panelId) ||
      sectionById.get(reservation.sectionId)?.panelId !== reservation.panelId
    ) {
      orphanSchoolPanelIds.add(reservation.panelId);
      continue;
    }

    const current = schoolsBySection.get(reservation.sectionId) ?? new Map();
    current.set(reservation.bookingId, reservation);
    schoolsBySection.set(reservation.sectionId, current);
  }

  const rows = panels
    .map((panel) => {
      const location = panel.locationId
        ? locationById.get(panel.locationId) ?? null
        : null;
      const panelSections = (sectionsByPanel.get(panel.id) ?? []).map(
        (section): PanelStatisticsSectionRow => {
          const audience = audienceById.get(section.audienceTypeId);
          const individualRows = [
            ...(individualBySection.get(section.id)?.values() ?? []),
          ];
          const schoolRows = [
            ...(schoolsBySection.get(section.id)?.values() ?? []),
          ];
          const inheritedChildren = individualRows.reduce(
            (total, choice) => total + Math.max(0, choice.childrenCount),
            0
          );
          const schoolPeople = schoolRows.reduce(
            (total, reservation) =>
              total +
              Math.max(0, reservation.studentCount) +
              Math.max(0, reservation.companionCount),
            0
          );
          const individualPeople = individualRows.length;
          const bookedPeople = individualPeople + inheritedChildren + schoolPeople;
          const bookingChannel = audience?.bookingChannel ?? "unknown";
          const channelMismatch =
            (individualRows.length > 0 && bookingChannel !== "individual") ||
            (schoolRows.length > 0 && bookingChannel !== "school_booking");
          const validCapacity =
            Number.isSafeInteger(section.capacity) && section.capacity >= 0;

          return {
            id: section.id,
            audienceTypeId: section.audienceTypeId,
            audienceName: audience?.name ?? "Pubblico non riconosciuto",
            bookingChannel,
            capacity: validCapacity ? section.capacity : 0,
            individualBookings: individualRows.length,
            individualPeople,
            inheritedChildren,
            schoolBookings: schoolRows.length,
            schoolPeople,
            bookedPeople,
            remainingSeats: (validCapacity ? section.capacity : 0) - bookedPeople,
            isInconsistent:
              !audience || !validCapacity || channelMismatch || bookedPeople > section.capacity,
          };
        }
      );
      const totals = sumPanelSections(panelSections);
      const issues: string[] = [];

      if (!panel.startsAt || !panel.endsAt) {
        issues.push("Data o orario da configurare");
      }

      if (!location) {
        issues.push("Location da configurare");
      } else if (!location.maxCapacity || location.maxCapacity <= 0) {
        issues.push("Capienza location da configurare");
      }

      if (panelSections.length === 0 || totals.capacity === 0) {
        issues.push("Sezioni di capienza da configurare");
      }

      const hasCapacityMismatch = Boolean(
        location?.maxCapacity &&
          panelSections.length > 0 &&
          totals.capacity > 0 &&
          totals.capacity !== location.maxCapacity
      );
      const hasInconsistentSection = panelSections.some(
        (section) => section.isInconsistent
      );

      if (hasCapacityMismatch) {
        issues.push("Totale sezioni diverso dalla capienza della location");
      }

      if (hasInconsistentSection) {
        issues.push("Una sezione contiene prenotazioni o dati incoerenti");
      }

      const hasOrphanBookings =
        orphanIndividualPanelIds.has(panel.id) || orphanSchoolPanelIds.has(panel.id);

      if (hasOrphanBookings) {
        issues.push("Prenotazioni non riconciliate con una sezione del panel");
      }

      const isNotConfigured =
        !panel.startsAt ||
        !panel.endsAt ||
        !location ||
        !location.maxCapacity ||
        panelSections.length === 0 ||
        totals.capacity === 0;
      const state = resolvePanelStatisticsState({
        isInconsistent:
          hasCapacityMismatch || hasInconsistentSection || hasOrphanBookings,
        isNotConfigured,
        capacity: totals.capacity,
        bookedPeople: totals.bookedPeople,
      });

      return {
        id: panel.id,
        title: panel.title,
        startsAt: panel.startsAt,
        endsAt: panel.endsAt,
        day: panel.startsAt ? panelDayKey(panel.startsAt) : null,
        locationId: panel.locationId,
        locationName: location?.name ?? "Location da definire",
        locationCapacity: location?.maxCapacity ?? null,
        publicationStatus: panel.publicationStatus,
        state,
        issues,
        sections: panelSections.sort((first, second) =>
          first.audienceName.localeCompare(second.audienceName, "it", {
            sensitivity: "base",
          })
        ),
        ...totals,
        utilizationPercent:
          totals.capacity > 0
            ? Math.round((totals.bookedPeople / totals.capacity) * 100)
            : null,
        actualPeople: null,
        noShowPeople: null,
      } satisfies PanelStatisticsRow;
    })
    .sort(
      (first, second) =>
        (first.startsAt ?? "9999").localeCompare(second.startsAt ?? "9999") ||
        first.title.localeCompare(second.title, "it", { sensitivity: "base" })
    );

  const summary = summarizePanelStatistics(rows);

  return {
    panels: rows,
    audienceTypes: audiences
      .map((audience) => ({ id: audience.id, name: audience.name }))
      .sort((first, second) =>
        first.name.localeCompare(second.name, "it", { sensitivity: "base" })
      ),
    locations: locations
      .map((location) => ({ id: location.id, name: location.name }))
      .sort((first, second) =>
        first.name.localeCompare(second.name, "it", { sensitivity: "base" })
      ),
    days: [
      ...new Set(
        rows.map((panel) => panel.day).filter((day): day is string => Boolean(day))
      ),
    ].sort(),
    summary,
    actualAttendanceAvailable: false,
  };
}

export function summarizePanelStatistics(
  panels: PanelStatisticsRow[]
): PanelStatisticsSummary {
  const summary = emptyPanelStatisticsSummary();

  for (const panel of panels) {
    summary.panelCount += 1;
    summary.totalCapacity += panel.capacity;
    summary.bookedPeople += panel.bookedPeople;
    summary.remainingSeats += Math.max(0, panel.remainingSeats);
    summary.overCapacitySeats += Math.max(0, -panel.remainingSeats);
    summary.individualPeople += panel.individualPeople;
    summary.inheritedChildren += panel.inheritedChildren;
    summary.schoolBookings += panel.schoolBookings;
    summary.schoolPeople += panel.schoolPeople;
    summary.stateCounts[panel.state] += 1;
  }

  return summary;
}

function sumPanelSections(sections: PanelStatisticsSectionRow[]) {
  return sections.reduce(
    (totals, section) => ({
      capacity: totals.capacity + section.capacity,
      individualBookings:
        totals.individualBookings + section.individualBookings,
      individualPeople: totals.individualPeople + section.individualPeople,
      inheritedChildren: totals.inheritedChildren + section.inheritedChildren,
      schoolBookings: totals.schoolBookings + section.schoolBookings,
      schoolPeople: totals.schoolPeople + section.schoolPeople,
      bookedPeople: totals.bookedPeople + section.bookedPeople,
      remainingSeats: totals.remainingSeats + section.remainingSeats,
    }),
    {
      capacity: 0,
      individualBookings: 0,
      individualPeople: 0,
      inheritedChildren: 0,
      schoolBookings: 0,
      schoolPeople: 0,
      bookedPeople: 0,
      remainingSeats: 0,
    }
  );
}

function resolvePanelStatisticsState({
  isInconsistent,
  isNotConfigured,
  capacity,
  bookedPeople,
}: {
  isInconsistent: boolean;
  isNotConfigured: boolean;
  capacity: number;
  bookedPeople: number;
}): PanelStatisticsState {
  if (isInconsistent) {
    return "inconsistent";
  }

  if (isNotConfigured || capacity <= 0) {
    return "not_configured";
  }

  if (bookedPeople >= capacity) {
    return "full";
  }

  if (bookedPeople * 10 >= capacity * 9) {
    return "nearly_full";
  }

  return "available";
}

function emptyPanelStatisticsSummary(): PanelStatisticsSummary {
  return {
    panelCount: 0,
    totalCapacity: 0,
    bookedPeople: 0,
    remainingSeats: 0,
    overCapacitySeats: 0,
    individualPeople: 0,
    inheritedChildren: 0,
    schoolBookings: 0,
    schoolPeople: 0,
    stateCounts: {
      available: 0,
      nearly_full: 0,
      full: 0,
      not_configured: 0,
      inconsistent: 0,
    },
  };
}

async function getAllIndividualChoices(
  supabase: SupabaseClient,
  panelIds: string[]
): Promise<PanelStatisticsIndividualChoiceInput[]> {
  if (panelIds.length === 0) {
    return [];
  }

  const rows: IndividualChoiceDbRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabase
      .from("moment_attendance_choices")
      .select(
        "registration_id,moment_id,seat_section_id,choice,registrations!inner(status,registration_children(id))"
      )
      .in("moment_id", panelIds)
      .eq("choice", "yes")
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (result.error) {
      throw result.error;
    }

    const page = (result.data ?? []) as IndividualChoiceDbRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows.map((row) => {
    const registration = relatedOne(row.registrations);

    return {
      registrationId: row.registration_id,
      panelId: row.moment_id,
      sectionId: row.seat_section_id,
      choice: row.choice,
      registrationStatus: registration?.status ?? "cancelled",
      childrenCount: registration?.registration_children?.length ?? 0,
    };
  });
}

async function getAllSchoolReservations(
  supabase: SupabaseClient,
  eventId: string
): Promise<PanelStatisticsSchoolReservationInput[]> {
  const rows: SchoolReservationDbRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const result = await supabase
      .from("school_panel_reservations")
      .select(
        "booking_id,panel_id,seat_section_id,student_count,companion_count,status,school_bookings!inner(status)"
      )
      .eq("event_id", eventId)
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (result.error) {
      throw result.error;
    }

    const page = (result.data ?? []) as SchoolReservationDbRow[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows.map((row) => ({
    bookingId: row.booking_id,
    panelId: row.panel_id,
    sectionId: row.seat_section_id,
    reservationStatus: row.status,
    bookingStatus: relatedOne(row.school_bookings)?.status ?? "cancelled",
    studentCount: row.student_count,
    companionCount: row.companion_count,
  }));
}

function panelDayKey(value: string): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PANEL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : null;
}

function normalizeBookingChannel(value: string): PanelStatisticsBookingChannel {
  return value === "individual" ||
    value === "school_booking" ||
    value === "internal_assignment"
    ? value
    : "unknown";
}

function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
