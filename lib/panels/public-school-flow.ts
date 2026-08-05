import type { SupabaseClient } from "@supabase/supabase-js";

import { sendTransactionalEmail } from "@/lib/email/smtp";
import { renderSchoolBookingConfirmationEmail } from "@/lib/email/templates";
import { renderQrPngBuffer } from "@/lib/qrcode/render";
import { encryptQrToken } from "@/lib/qrcode/secure-token";
import { createOpaqueQrToken } from "@/lib/qrcode/token";
import { buildAppMagicLink } from "@/lib/registrations/magic-link";
import {
  PUBLIC_SCHOOL_BOOKING_PRIVACY_VERSION,
  type PublicSchoolBookingInput,
  type PublicSchoolPanelOption,
} from "@/lib/panels/public-school-bookings";

export async function createPublicSchoolBooking(
  supabase: SupabaseClient,
  input: PublicSchoolBookingInput,
  event: { id: string; title: string },
  panels: PublicSchoolPanelOption[],
  appUrl: string
) {
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
  const callbackUrl = `${appUrl}/auth/callback?redirect_to=${encodeURIComponent("/dashboard/docente")}`;
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: input.teacherEmail,
    options: { redirectTo: callbackUrl },
  });
  const accessLink = buildAppMagicLink(callbackUrl, linkData.properties?.hashed_token ?? null) ?? linkData.properties?.action_link;
  if (linkError || !accessLink) throw linkError ?? new Error("Magic link was not generated");

  const optionById = new Map(panels.map((panel) => [panel.panelId, panel]));
  const panelLines = input.reservations.map((reservation) => {
    const panel = optionById.get(reservation.panelId);
    return panel ? `${panel.title} — ${formatPanelDate(panel.startsAt)}` : reservation.panelId;
  });
  const qrContentId = `school-booking-${bookingId}@iscrizioni-pace`;
  await sendTransactionalEmail({
    to: input.teacherEmail,
    ...renderSchoolBookingConfirmationEmail({
      teacherFirstName: input.teacherFirstName,
      eventTitle: event.title,
      schoolName: input.schoolName,
      classDescription: input.classDescription,
      studentCount: input.studentCount,
      companionCount: input.companionCount,
      panelLines,
      accessLink,
      qrCodeContentId: qrContentId,
    }),
    attachments: [{
      filename: `qr-scuola-${bookingId.slice(0, 8)}.png`,
      content: await renderQrPngBuffer(qrToken.token),
      contentType: "image/png",
      cid: qrContentId,
    }],
  });
  return bookingId;
}

function formatPanelDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(value));
}
