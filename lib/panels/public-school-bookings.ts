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

type PublicSchoolBookingOptionRow = {
  event_id: string;
  event_title: string;
  panel_id: string;
  section_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location_name: string;
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
  const { data, error } = await supabase.rpc("get_public_school_booking_options");
  if (error) throw error;
  const rows = (data ?? []) as PublicSchoolBookingOptionRow[];
  const first = rows[0];
  if (!first) return { event: null, panels: [] };

  return {
    event: { id: first.event_id, title: first.event_title },
    panels: rows.map((row) => ({
      panelId: row.panel_id,
      sectionId: row.section_id,
      title: row.title,
      description: row.description,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      locationName: row.location_name,
    })),
  };
}

function clean(value: FormDataEntryValue | null, maxLength: number) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function positiveInteger(value: FormDataEntryValue | null, max: number) {
  const parsed = Number(String(value ?? ""));
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
}
