import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRegistrationQr, registrationQrPreview, registrationQrState } from "../qrcode/registration-qr.ts";
import { decryptQrToken } from "../qrcode/secure-token.ts";
import { renderQrLabelHtml } from "../qrcode/print-label.ts";

// Called only for authenticated operators; check scope before reading credentials.
async function loadOperationsQrIdentity(
  db: SupabaseClient,
  registrationId: string,
  canManageEvent: (eventId: string) => boolean,
) {
  const event = await db.from("events").select("id").eq("is_current", true).maybeSingle();
  if (event.error) throw new Error("QR event read failed");
  if (!event.data || !canManageEvent(event.data.id)) return null;
  const registration = await db.from("registrations")
    .select("id,status,participants!inner(first_name,last_name,public_code)")
    .eq("id", registrationId).eq("event_id", event.data.id)
    .is("deleted_at", null).maybeSingle();
  if (registration.error) throw new Error("QR registration read failed");
  if (!registration.data) return null;
  const participant = Array.isArray(registration.data.participants)
    ? registration.data.participants[0] : registration.data.participants;
  if (!participant) return null;
  return { participant, registration: registration.data };
}

export async function loadOperationsQr(db: SupabaseClient, registrationId: string, canManageEvent: (eventId: string) => boolean) {
  const identity = await loadOperationsQrIdentity(db, registrationId, canManageEvent);
  if (!identity) return null;
  return registrationQrPreview(await loadRegistrationQr(db, identity.registration.id), identity.participant);
}

export async function loadOperationsQrLabel(db: SupabaseClient, registrationId: string, canManageEvent: (eventId: string) => boolean) {
  const identity = await loadOperationsQrIdentity(db, registrationId, canManageEvent);
  if (!identity || identity.registration.status === "cancelled") return null;
  const record = await loadRegistrationQr(db, identity.registration.id);
  if (registrationQrState(record) !== "active") return null;
  const token = decryptQrToken(record?.token_encrypted);
  if (!token) return null;
  return renderQrLabelHtml(token, identity.participant);
}
