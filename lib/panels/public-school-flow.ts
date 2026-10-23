import { processSchoolQrEmails } from "./school-qr-delivery";
import type { SupabaseClient } from "@supabase/supabase-js";

import { encryptQrToken } from "@/lib/qrcode/secure-token";
import { createOpaqueQrToken } from "@/lib/qrcode/token";
import {
  PUBLIC_SCHOOL_BOOKING_PRIVACY_VERSION,
  type PublicSchoolBookingInput,
  type PublicSchoolPanelOption,
} from "@/lib/panels/public-school-bookings";

export async function createPublicSchoolBooking(
  supabase: SupabaseClient,
  input: PublicSchoolBookingInput,
  event: { id: string; title: string },
  _panels: PublicSchoolPanelOption[],
  appUrl: string
): Promise<{ bookingId: string; emailSent: boolean }> {
  const qrToken = createOpaqueQrToken();
  const { data, error } = await supabase.rpc("create_public_school_booking", {
    p_event_id: event.id,
    p_teacher_email: input.teacherEmail,
    p_teacher_first_name: input.teacherFirstName,
    p_teacher_last_name: input.teacherLastName,
    p_teacher_phone: input.teacherPhone,
    p_school_name: input.schoolName,
    p_school_city: input.schoolCity,
    p_class_description: input.classDescription,
    p_student_count: input.studentCount,
    p_companion_count: input.companionCount,
    p_privacy_version: PUBLIC_SCHOOL_BOOKING_PRIVACY_VERSION,
    p_panel_reservations: input.reservations.map((row) => ({
      panel_id: row.panelId,
      seat_section_id: row.sectionId,
      student_count: row.studentCount,
      companion_count: row.companionCount,
    })),
    p_qr_token_hash: qrToken.tokenHash,
    p_qr_token_encrypted: encryptQrToken(qrToken.token),
  });
  if (error || !data) throw error ?? new Error("School booking was not created");

  const bookingId = String(data);
  try {
    const delivery = await processSchoolQrEmails(supabase, appUrl, {bookingId});
    return {bookingId, emailSent:delivery.accepted === 1};
  } catch {
    // The booking and its queued confirmation survive a delivery failure.
    return {bookingId, emailSent:false};
  }
}
