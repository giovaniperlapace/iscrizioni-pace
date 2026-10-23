import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmailConfig } from "../email/config.ts";
import { EmailDeliveryError, sendTransactionalEmail } from "../email/smtp.ts";
import { renderSchoolBookingConfirmationEmail } from "../email/templates.ts";
import { renderQrPngBuffer } from "../qrcode/render.ts";
import { decryptQrToken, encryptQrToken } from "../qrcode/secure-token.ts";
import { createOpaqueQrToken, hashQrToken } from "../qrcode/token.ts";

export async function prepareSchoolQrEmail(db: SupabaseClient, bookingId: string, appUrl: string) {
  const { data: booking, error } = await db.from("school_bookings")
    .select("id,event_id,teacher_id,school_name,class_description,student_count,companion_count,status")
    .eq("id", bookingId).single();
  if (error || !booking) throw new Error("booking_read_failed");
  if (!["submitted", "confirmed"].includes(booking.status)) return null;
  const [event, teacher, reservations] = await Promise.all([
    db.from("events").select("id,title,is_current").eq("id", booking.event_id).single(),
    db.from("school_booking_teachers").select("email,first_name").eq("id", booking.teacher_id).eq("event_id", booking.event_id).single(),
    db.from("school_panel_reservations").select("panel_id,student_count,companion_count")
      .eq("booking_id", bookingId).eq("event_id", booking.event_id).eq("status", "reserved"),
  ]);
  if (event.error || teacher.error || reservations.error || !event.data || !teacher.data) throw new Error("booking_read_failed");
  if (!event.data.is_current || !reservations.data?.length) return null;
  const panels = await db.from("event_moments").select("id,title,starts_at,location_id")
    .eq("event_id", booking.event_id).in("id", reservations.data.map(row => row.panel_id)).order("starts_at").order("id");
  if (panels.error || panels.data?.length !== reservations.data.length) throw new Error("forum_read_failed");
  const generated = createOpaqueQrToken();
  const qr = await db.rpc("ensure_school_booking_qr", {p_booking:bookingId,p_hash:generated.tokenHash,p_encrypted:encryptQrToken(generated.token)});
  if (qr.error || typeof qr.data !== "string") throw new Error("qr_unavailable");
  const token = decryptQrToken(qr.data);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("qr_unavailable");
  const stored = await db.from("school_booking_qr_tokens").select("token_hash").eq("booking_id",bookingId).eq("status","active").single();
  if (stored.error || stored.data?.token_hash !== hashQrToken(token)) throw new Error("qr_unavailable");
  const date = new Intl.DateTimeFormat("it-IT", {dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Rome"});
  const cid = `school-booking-${bookingId}@iscrizioni-pace`;
  // A durable sign-in URL is preferable to a one-use link in an event notice.
  const accessLink = new URL("/scuole/accesso", appUrl).href;
  return {to:teacher.data.email as string,
    ...renderSchoolBookingConfirmationEmail({teacherFirstName:teacher.data.first_name,eventTitle:event.data.title,
      schoolName:booking.school_name,classDescription:booking.class_description,studentCount:booking.student_count,
      companionCount:booking.companion_count,accessLink,qrCodeContentId:cid,
      panelLines:panels.data.map(panel => {
        const reservation = reservations.data!.find(row => row.panel_id === panel.id)!;
        return `${panel.title} — ${date.format(new Date(panel.starts_at))} — ${reservation.student_count} studenti, ${reservation.companion_count} accompagnatori`;
      })}),
    metadata:{schoolBookingId:bookingId},
    attachments:[{filename:`qr-scuola-${bookingId.slice(0,8)}.png`,content:await renderQrPngBuffer(token),contentType:"image/png",cid}],
  };
}

export async function processSchoolQrEmails(db: SupabaseClient, appUrl: string, options: {bookingId?: string; limit?: number} = {}) {
  if (!["https:", "http:"].includes(new URL(appUrl).protocol)) throw new Error("school_email_url_invalid");
  const stopAt = Date.now() + 45_000;
  const counts = {accepted:0,failed:0,uncertain:0,skipped:0};
  // Local previews must never consume the real delivery queue.
  if (getEmailConfig().deliveryMode === "log") return counts;
  const limit = options.bookingId ? 1 : Math.min(10, Math.max(1, options.limit ?? 10));
  for (let index=0; index<limit && Date.now()<stopAt; index++) {
    const claim = await db.rpc("claim_school_booking_email", {p_booking:options.bookingId ?? null});
    if (claim.error) throw new Error("school_email_claim_failed");
    if (!claim.data) break;
    const bookingId = String(claim.data);
    let state: keyof typeof counts = "failed";
    let recipient: string | null = null, messageId: string | null = null, errorCode: string | null = null;
    let providerStarted = false;
    try {
      const email = await prepareSchoolQrEmail(db, bookingId, appUrl);
      if (!email) state = "skipped";
      else {
        recipient = email.to;
        // Persist recipient before sending, including when the process dies afterwards.
        const saved = await db.from("school_booking_email_deliveries").update({recipient}).eq("booking_id",bookingId).eq("state","sending");
        if (saved.error) throw new Error("recipient_save_failed");
        providerStarted = true;
        const sent = await sendTransactionalEmail(email);
        messageId = sent.messageId;
        state = "accepted";
      }
    } catch (error) {
      state = providerStarted && (!(error instanceof EmailDeliveryError) || ["postmark_delivery_unknown","postmark_response_unknown"].includes(error.code)) ? "uncertain" : "failed";
      errorCode = error instanceof EmailDeliveryError ? error.code : "preparation_failed";
    }
    const finished = await db.from("school_booking_email_deliveries").update({state,recipient,message_id:messageId,error_code:errorCode,updated_at:new Date().toISOString()})
      .eq("booking_id",bookingId).eq("state","sending");
    if (finished.error) throw new Error("school_email_result_unknown");
    counts[state]++;
  }
  return counts;
}
