import { findPeopleWithoutForum } from "./forum-outreach.ts";
import { loadPanelWaitlistData, countWaitlistedWithoutBooking, type PanelWaitlistCount } from "./waitlist-statistics.ts";
import { compareForums } from "./forum-order.ts";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadPanelAttendanceTotals } from "../reception/panel-attendance.server.ts";
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
  selectedChildIds?: string[];
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
  waitingPeople: number;
  offeredPeople: number;
  bookableRemainingSeats: number;
  utilizationPercent: number | null;
  actualPeople: number | null;
  noShowPeople: number | null;
};

export type PanelStatisticsSummary = {
  waitingPeople: number;
  offeredPeople: number;
  bookableRemainingSeats: number;
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
  bookingCoverage: { bookedPeople: number; registeredPeople: number };
  waitlistedWithoutBookingPeople: number;
  withoutForumPeople: number;
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
        deleted_at: string | null;
        registration_children: Array<{ id: string }> | null;
      }
    | Array<{
        status: string;
        deleted_at: string | null;
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
    bookingCoverage: { bookedPeople: 0, registeredPeople: 0 },
    waitlistedWithoutBookingPeople: 0,
    withoutForumPeople: 0,
    actualAttendanceAvailable: false,
  };
}

export async function getPanelStatisticsSnapshot(
  supabase: SupabaseClient,
  eventId: string
): Promise<PanelStatisticsSnapshot> {
  const [panelsResult, locationsResult, audiencesResult, sectionsResult] =
    await Promise.all([
      loadAllRows((from, to) => supabase
        .from("event_moments")
        .select("id,title,starts_at,ends_at,location_id,publication_status")
        .eq("event_id", eventId)
        .eq("moment_type", "panel")
        .order("starts_at", { ascending: true }).order("id").range(from, to)),
      loadAllRows((from, to) => supabase
        .from("event_locations")
        .select("id,name,max_capacity")
        .eq("event_id", eventId).order("id").range(from, to)),
      loadAllRows((from, to) => supabase
        .from("panel_audience_types")
        .select("id,name,booking_channel,sort_order")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }).order("id").range(from, to)),
      loadAllRows((from, to) => supabase
        .from("panel_seat_sections")
        .select("id,panel_id,audience_type_id,capacity")
        .eq("event_id", eventId).order("id").range(from, to)),
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
  const [individualChoices, schoolReservations, actualTotals, registrationsResult, waitlistData] = await Promise.all([
    getAllIndividualChoices(supabase, panelIds),
    getAllSchoolReservations(supabase, eventId),
    loadPanelAttendanceTotals(supabase, eventId),
    loadAllRows((from, to) => supabase.from("registrations")
      .select("id,registration_children(id)").eq("event_id", eventId)
      .is("deleted_at", null).in("status", ["submitted", "confirmed"]).order("id").range(from, to)),
    loadPanelWaitlistData(supabase, eventId),
  ]);

  const snapshot = buildPanelStatisticsSnapshot({
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
    waitlistCounts: waitlistData.counts,
  });
  snapshot.waitlistedWithoutBookingPeople = countWaitlistedWithoutBooking(
    snapshot.panels, individualChoices, waitlistData.rows, waitlistData.selections,
  );
  snapshot.withoutForumPeople = findPeopleWithoutForum(registrationsResult.data, individualChoices).peopleCount;
  snapshot.bookingCoverage = calculatePanelBookingCoverage(
    registrationsResult.data, individualChoices,
  );
  if (actualTotals !== null) {
    snapshot.actualAttendanceAvailable = true;
    snapshot.panels = snapshot.panels.map(panel => ({ ...panel, actualPeople: actualTotals.get(panel.id) ?? 0 }));
  }
  return snapshot;
}

export function buildPanelStatisticsSnapshot({
  panels,
  locations,
  audiences,
  sections,
  individualChoices,
  schoolReservations,
  waitlistCounts = new Map(),
}: {
  panels: PanelStatisticsPanelInput[];
  locations: PanelStatisticsLocationInput[];
  audiences: PanelStatisticsAudienceInput[];
  sections: PanelStatisticsSectionInput[];
  individualChoices: PanelStatisticsIndividualChoiceInput[];
  schoolReservations: PanelStatisticsSchoolReservationInput[];
  waitlistCounts?: Map<string, PanelWaitlistCount>;
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

      const exceedsLocationCapacity = Boolean(
        location?.maxCapacity &&
          panelSections.length > 0 &&
          totals.capacity > 0 &&
          totals.capacity > location.maxCapacity
      );
      const hasInconsistentSection = panelSections.some(
        (section) => section.isInconsistent
      );

      if (exceedsLocationCapacity) {
        issues.push("Totale sezioni superiore alla capienza della location");
      }

      if (hasInconsistentSection) {
        issues.push("Una sezione contiene prenotazioni o dati incoerenti");
      }

      const hasOrphanBookings =
        orphanIndividualPanelIds.has(panel.id) || orphanSchoolPanelIds.has(panel.id);

      if (hasOrphanBookings) {
        issues.push("Prenotazioni non riconciliate con una sezione del forum");
      }

      const isNotConfigured =
        !panel.startsAt ||
        !panel.endsAt ||
        !location ||
        !location.maxCapacity ||
        panelSections.length === 0 ||
        totals.capacity === 0;
      const queue = waitlistCounts.get(panel.id) ?? { waitingPeople: 0, offeredPeople: 0 };
      const bookable = sumPanelSections(panelSections.filter(section =>
        section.bookingChannel === "individual" || section.bookingChannel === "school_booking"));
      const bookableOccupied = bookable.bookedPeople + queue.offeredPeople;
      const state = resolvePanelStatisticsState({
        isInconsistent:
          exceedsLocationCapacity || hasInconsistentSection || hasOrphanBookings,
        isNotConfigured,
        capacity: bookable.capacity,
        bookedPeople: bookableOccupied,
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
        ...queue,
        bookableRemainingSeats: Math.max(0, bookable.capacity - bookableOccupied),
        utilizationPercent:
          bookable.capacity > 0
            ? Math.round((bookableOccupied / bookable.capacity) * 100)
            : null,
        actualPeople: null,
        noShowPeople: null,
      } satisfies PanelStatisticsRow;
    })
    .sort(compareForums);

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
    bookingCoverage: { bookedPeople: 0, registeredPeople: 0 },
    waitlistedWithoutBookingPeople: 0,
    withoutForumPeople: 0,
    actualAttendanceAvailable: false,
  };
}

/** Event-wide unique nominal people; school quantities cannot be deduplicated. */
export function calculatePanelBookingCoverage(
  registrations: Array<{ id: string; registration_children: Array<{ id: string }> | null }>,
  choices: PanelStatisticsIndividualChoiceInput[],
): { bookedPeople: number; registeredPeople: number } {
  const registered = new Set<string>();
  for (const registration of registrations) {
    registered.add(`adult:${registration.id}`);
    for (const child of registration.registration_children ?? []) {
      registered.add(`child:${registration.id}:${child.id}`);
    }
  }
  const booked = new Set<string>();
  for (const choice of choices) {
    if (choice.choice !== "yes" || choice.registrationStatus === "cancelled" || !choice.sectionId) continue;
    const adult = `adult:${choice.registrationId}`;
    if (!registered.has(adult)) continue;
    booked.add(adult);
    for (const id of choice.selectedChildIds ?? []) {
      const child = `child:${choice.registrationId}:${id}`;
      if (registered.has(child)) booked.add(child);
    }
  }
  return { bookedPeople: booked.size, registeredPeople: registered.size };
}

export function summarizePanelStatistics(
  panels: PanelStatisticsRow[]
): PanelStatisticsSummary {
  const summary = emptyPanelStatisticsSummary();

  for (const panel of panels) {
    summary.waitingPeople += panel.waitingPeople;
    summary.offeredPeople += panel.offeredPeople;
    summary.bookableRemainingSeats += panel.bookableRemainingSeats;
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

  if (isNotConfigured) {
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
    waitingPeople: 0,
    offeredPeople: 0,
    bookableRemainingSeats: 0,
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

export async function getAllIndividualChoices(
  supabase: SupabaseClient,
  panelIds: string[]
): Promise<PanelStatisticsIndividualChoiceInput[]> {
  if (panelIds.length === 0) {
    return [];
  }

  const { data: rows } = await loadRowsForIds<IndividualChoiceDbRow>(panelIds, (ids, from, to) => supabase
      .from("moment_attendance_choices")
      .select("registration_id,moment_id,seat_section_id,choice,registrations!inner(status,deleted_at,registration_children(id))")
      .in("moment_id", ids).eq("choice", "yes").not("seat_section_id", "is", null)
      .order("id").range(from, to));

  const { data: selections } = await loadRowsForIds<{registration_id: string; panel_id: string; child_ids: string[]}>(panelIds, (ids, from, to) => supabase
    .from("panel_child_selections").select("registration_id,panel_id,child_ids").in("panel_id", ids).order("registration_id").order("panel_id").range(from, to));
  const selectedChildren = new Map(selections.map(row => [`${row.registration_id}:${row.panel_id}`, new Set(row.child_ids)]));
  return rows.map((row) => {
    const registration = relatedOne(row.registrations);

    return {
      registrationId: row.registration_id,
      panelId: row.moment_id,
      sectionId: row.seat_section_id,
      choice: row.choice,
      registrationStatus: registration?.deleted_at ? "cancelled" : registration?.status ?? "cancelled",
      selectedChildIds: registration?.registration_children?.filter(child => selectedChildren.get(`${row.registration_id}:${row.moment_id}`)?.has(child.id)).map(child => child.id) ?? [],
      childrenCount: registration?.registration_children?.filter(child => selectedChildren.get(`${row.registration_id}:${row.moment_id}`)?.has(child.id)).length ?? 0,
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
