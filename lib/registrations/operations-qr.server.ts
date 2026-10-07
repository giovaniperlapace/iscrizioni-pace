import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRegistrationQr, registrationQrPreview } from "../qrcode/registration-qr.ts";

// Called only for authenticated operators; check scope before reading credentials.
export async function loadOperationsQr(
  db: SupabaseClient,
  registrationId: string,
  canManageEvent: (eventId: string) => boolean,
) {
  const event = await db.from("events").select("id").eq("is_current", true).maybeSingle();
  if (event.error) throw new Error("QR event read failed");
  if (!event.data || !canManageEvent(event.data.id)) return null;
  const registration = await db.from("registrations")
    .select("id,participants!inner(first_name,last_name,public_code)")
    .eq("id", registrationId).eq("event_id", event.data.id)
    .is("deleted_at", null).maybeSingle();
  if (registration.error) throw new Error("QR registration read failed");
  if (!registration.data) return null;
  const participant = Array.isArray(registration.data.participants)
    ? registration.data.participants[0] : registration.data.participants;
  if (!participant) return null;
  return registrationQrPreview(await loadRegistrationQr(db, registration.data.id), participant);
}
