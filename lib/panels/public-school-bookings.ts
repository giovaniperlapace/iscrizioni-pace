import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeEmail } from "../registrations/validation.ts";

export const PUBLIC_SCHOOL_BOOKING_PRIVACY_VERSION = "school-booking-v1";

export type PublicSchoolPanelOption = {
  panelId: string;
  sectionId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  locationName: string;
};

export type PublicSchoolBookingOptions = {
  event: { id: string; title: string } | null;
  panels: PublicSchoolPanelOption[];
};

export type PublicSchoolBookingInput = {
  teacherEmail: string;
  teacherFirstName: string;
  teacherLastName: string;
  teacherPhone: string;
  schoolName: string;
  schoolCity: string;
  classDescription: string;
  studentCount: number;
  companionCount: number;
  reservations: Array<{
    panelId: string;
    sectionId: string;
    studentCount: number;
    companionCount: number;
  }>;
};

export function parsePublicSchoolBookingForm(
  formData: FormData
): { ok: true; value: PublicSchoolBookingInput } | { ok: false } {
  const teacherEmail = normalizeEmail(String(formData.get("teacherEmail") ?? ""));
  const teacherFirstName = clean(formData.get("teacherFirstName"), 120);
  const teacherLastName = clean(formData.get("teacherLastName"), 120);
  const teacherPhone = clean(formData.get("teacherPhone"), 40);
  const schoolName = clean(formData.get("schoolName"), 180);
  const schoolCity = clean(formData.get("schoolCity"), 120);
  const classDescription = clean(formData.get("classDescription"), 180);
  const studentCount = positiveInteger(formData.get("studentCount"), 1000);
  const companionCount = positiveInteger(formData.get("companionCount"), 100);
  const sectionIds = [...new Set(formData.getAll("sectionIds").map(String))];

  if (
    !teacherEmail || !teacherEmail.includes("@") || !teacherFirstName ||
    !teacherLastName || !teacherPhone || !schoolName || !schoolCity ||
    !classDescription || studentCount === null || companionCount === null ||
    sectionIds.length < 1 || sectionIds.length > 50 ||
    formData.get("privacyAccepted") !== "yes"
  ) return { ok: false };

  const reservations = sectionIds.map((sectionId) => ({
    sectionId,
    panelId: clean(formData.get(`panelId:${sectionId}`), 80) ?? "",
    studentCount: positiveInteger(formData.get(`students:${sectionId}`), studentCount),
    companionCount: positiveInteger(formData.get(`companions:${sectionId}`), companionCount),
  }));
  if (reservations.some((row) => !row.panelId || row.studentCount === null || row.companionCount === null)) {
    return { ok: false };
  }

  return {
    ok: true,
    value: {
      teacherEmail,
      teacherFirstName,
      teacherLastName,
      teacherPhone,
      schoolName,
      schoolCity,
      classDescription,
      studentCount,
      companionCount,
      reservations: reservations as PublicSchoolBookingInput["reservations"],
    },
  };
}

export async function getPublicSchoolBookingOptions(
  supabase: SupabaseClient
): Promise<PublicSchoolBookingOptions> {
  const now = new Date().toISOString();
  const { data: event } = await supabase
    .from("events")
    .select("id,title")
    .eq("is_current", true)
    .eq("status", "published")
    .or(`registration_opens_at.is.null,registration_opens_at.lte.${now}`)
    .or(`registration_closes_at.is.null,registration_closes_at.gte.${now}`)
    .limit(1)
    .maybeSingle();
  if (!event) return { event: null, panels: [] };

  const [panelsResult, sectionsResult, audiencesResult, locationsResult] = await Promise.all([
    supabase.from("event_moments").select("id,title,description,starts_at,ends_at,location_id").eq("event_id", event.id).eq("moment_type", "panel").eq("publication_status", "published").eq("is_public", true).order("starts_at"),
    supabase.from("panel_seat_sections").select("id,panel_id,audience_type_id").eq("event_id", event.id),
    supabase.from("panel_audience_types").select("id").eq("event_id", event.id).eq("booking_channel", "school_booking").eq("is_active", true),
    supabase.from("event_locations").select("id,name").eq("event_id", event.id),
  ]);
  for (const result of [panelsResult, sectionsResult, audiencesResult, locationsResult]) {
    if (result.error) throw result.error;
  }
  const audienceIds = new Set((audiencesResult.data ?? []).map((row) => row.id));
  const sections = new Map(
    (sectionsResult.data ?? [])
      .filter((row) => audienceIds.has(row.audience_type_id))
      .map((row) => [row.panel_id, row.id])
  );
  const locations = new Map((locationsResult.data ?? []).map((row) => [row.id, row.name]));
  const panels = (panelsResult.data ?? []).flatMap((panel): PublicSchoolPanelOption[] => {
    const sectionId = sections.get(panel.id);
    if (!sectionId || !panel.starts_at || !panel.ends_at) return [];
    return [{
      panelId: panel.id,
      sectionId,
      title: panel.title,
      description: panel.description,
      startsAt: panel.starts_at,
      endsAt: panel.ends_at,
      locationName: panel.location_id ? locations.get(panel.location_id) ?? "" : "",
    }];
  });
  return { event, panels };
}

function clean(value: FormDataEntryValue | null, maxLength: number) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function positiveInteger(value: FormDataEntryValue | null, max: number) {
  const parsed = Number(String(value ?? ""));
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}
