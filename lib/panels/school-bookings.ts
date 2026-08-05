import type { SupabaseClient } from "@supabase/supabase-js";

export const SCHOOL_BOOKING_SEARCH_MAX_LENGTH = 80;
export const SCHOOL_BOOKING_NOTES_MAX_LENGTH = 2000;
export const SCHOOL_BOOKING_PRIVACY_VERSION = "school-booking-v1";

export type SchoolBookingStatus =
  | "draft"
  | "submitted"
  | "confirmed"
  | "cancelled";

export type SchoolPanelOption = {
  panelId: string;
  sectionId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  locationName: string;
  audienceName: string;
};

export type SchoolPanelReservation = SchoolPanelOption & {
  studentCount: number;
  companionCount: number;
  status: "reserved" | "cancelled";
};

export type SchoolBookingRow = {
  id: string;
  eventId: string;
  schoolName: string;
  schoolCity: string;
  classDescription: string;
  studentCount: number;
  companionCount: number;
  status: SchoolBookingStatus;
  privacyVersion: string;
  privacyAcceptedAt: string;
  internalNotes: string | null;
  submittedAt: string;
  updatedAt: string;
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  reservations: SchoolPanelReservation[];
  hasActiveQr: boolean;
};

export type SchoolBookingFilters = {
  query: string;
  status: "all" | SchoolBookingStatus;
  panelId: string;
};

type TeacherDbRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
};

type BookingDbRow = {
  id: string;
  event_id: string;
  teacher_id: string;
  school_name: string;
  school_city: string;
  class_description: string;
  student_count: number;
  companion_count: number;
  status: SchoolBookingStatus;
  privacy_version: string;
  privacy_accepted_at: string;
  internal_notes: string | null;
  submitted_at: string;
  updated_at: string;
};

type ReservationDbRow = {
  booking_id: string;
  panel_id: string;
  seat_section_id: string;
  student_count: number;
  companion_count: number;
  status: "reserved" | "cancelled";
};

export async function getSchoolBookingCatalog(
  supabase: SupabaseClient,
  eventId: string
): Promise<{ bookings: SchoolBookingRow[]; panelOptions: SchoolPanelOption[] }> {
  const [bookingsResult, teachersResult, reservationsResult, panelsResult, sectionsResult, audiencesResult, locationsResult, qrResult] =
    await Promise.all([
      supabase
        .from("school_bookings")
        .select("id,event_id,teacher_id,school_name,school_city,class_description,student_count,companion_count,status,privacy_version,privacy_accepted_at,internal_notes,submitted_at,updated_at")
        .eq("event_id", eventId)
        .order("updated_at", { ascending: false })
        .limit(500),
      supabase
        .from("school_booking_teachers")
        .select("id,first_name,last_name,email,phone")
        .eq("event_id", eventId),
      supabase
        .from("school_panel_reservations")
        .select("booking_id,panel_id,seat_section_id,student_count,companion_count,status")
        .eq("event_id", eventId),
      supabase
        .from("event_moments")
        .select("id,title,starts_at,ends_at,location_id")
        .eq("event_id", eventId)
        .eq("moment_type", "panel")
        .eq("publication_status", "published")
        .order("starts_at", { ascending: true }),
      supabase
        .from("panel_seat_sections")
        .select("id,panel_id,audience_type_id")
        .eq("event_id", eventId),
      supabase
        .from("panel_audience_types")
        .select("id,name,booking_channel,is_active")
        .eq("event_id", eventId)
        .eq("booking_channel", "school_booking"),
      supabase.from("event_locations").select("id,name").eq("event_id", eventId),
      supabase
        .from("school_booking_qr_tokens")
        .select("booking_id")
        .eq("status", "active"),
    ]);

  for (const result of [bookingsResult, teachersResult, reservationsResult, panelsResult, sectionsResult, audiencesResult, locationsResult, qrResult]) {
    if (result.error) throw result.error;
  }

  const teachers = new Map(
    ((teachersResult.data ?? []) as TeacherDbRow[]).map((row) => [row.id, row])
  );
  const panels = new Map(
    ((panelsResult.data ?? []) as Array<{ id: string; title: string; starts_at: string | null; ends_at: string | null; location_id: string | null }>).map((row) => [row.id, row])
  );
  const locations = new Map(
    ((locationsResult.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name])
  );
  const audiences = new Map(
    ((audiencesResult.data ?? []) as Array<{ id: string; name: string; is_active: boolean | null }>).map((row) => [row.id, row])
  );
  const panelOptions = ((sectionsResult.data ?? []) as Array<{ id: string; panel_id: string; audience_type_id: string }>)
    .flatMap((section): SchoolPanelOption[] => {
      const panel = panels.get(section.panel_id);
      const audience = audiences.get(section.audience_type_id);
      if (!panel?.starts_at || !panel.ends_at || !audience) return [];
      return [{
        panelId: panel.id,
        sectionId: section.id,
        title: panel.title,
        startsAt: panel.starts_at,
        endsAt: panel.ends_at,
        locationName: panel.location_id ? locations.get(panel.location_id) ?? "Location da definire" : "Location da definire",
        audienceName: audience.name,
      }];
    })
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.title.localeCompare(right.title, "it"));
  const optionBySection = new Map(panelOptions.map((option) => [option.sectionId, option]));
  const reservationsByBooking = new Map<string, SchoolPanelReservation[]>();
  for (const row of (reservationsResult.data ?? []) as ReservationDbRow[]) {
    const option = optionBySection.get(row.seat_section_id);
    if (!option) continue;
    const list = reservationsByBooking.get(row.booking_id) ?? [];
    list.push({ ...option, studentCount: row.student_count, companionCount: row.companion_count, status: row.status });
    reservationsByBooking.set(row.booking_id, list);
  }
  const activeQr = new Set(
    ((qrResult.data ?? []) as Array<{ booking_id: string }>).map((row) => row.booking_id)
  );

  const bookings = ((bookingsResult.data ?? []) as BookingDbRow[]).flatMap((row): SchoolBookingRow[] => {
    const teacher = teachers.get(row.teacher_id);
    if (!teacher) return [];
    return [{
      id: row.id,
      eventId: row.event_id,
      schoolName: row.school_name,
      schoolCity: row.school_city,
      classDescription: row.class_description,
      studentCount: row.student_count,
      companionCount: row.companion_count,
      status: row.status,
      privacyVersion: row.privacy_version,
      privacyAcceptedAt: row.privacy_accepted_at,
      internalNotes: row.internal_notes,
      submittedAt: row.submitted_at,
      updatedAt: row.updated_at,
      teacher: { id: teacher.id, firstName: teacher.first_name, lastName: teacher.last_name, email: teacher.email, phone: teacher.phone },
      reservations: (reservationsByBooking.get(row.id) ?? []).sort((left, right) => left.startsAt.localeCompare(right.startsAt)),
      hasActiveQr: activeQr.has(row.id),
    }];
  });

  return { bookings, panelOptions };
}

export function parseSchoolBookingFilters(input: {
  schoolQ?: string;
  schoolStatus?: string;
  schoolPanel?: string;
}): SchoolBookingFilters {
  const status = ["draft", "submitted", "confirmed", "cancelled"].includes(input.schoolStatus ?? "")
    ? input.schoolStatus as SchoolBookingStatus
    : "all";
  return {
    query: (input.schoolQ ?? "").replace(/\s+/g, " ").trim().slice(0, SCHOOL_BOOKING_SEARCH_MAX_LENGTH),
    status,
    panelId: input.schoolPanel?.trim() || "all",
  };
}

export function filterSchoolBookings(
  bookings: SchoolBookingRow[],
  filters: SchoolBookingFilters
): SchoolBookingRow[] {
  const query = filters.query.toLocaleLowerCase("it");
  return bookings.filter((booking) => {
    if (filters.status !== "all" && booking.status !== filters.status) return false;
    if (filters.panelId !== "all" && !booking.reservations.some((row) => row.panelId === filters.panelId)) return false;
    if (!query) return true;
    return [booking.schoolName, booking.schoolCity, booking.classDescription, booking.teacher.firstName, booking.teacher.lastName, booking.teacher.email, ...booking.reservations.map((row) => row.title)]
      .join(" ")
      .toLocaleLowerCase("it")
      .includes(query);
  });
}
