import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLeaderScope } from "./leader-data.server.ts";
import {
  loadRegistrationQr,
  registrationQrPreview,
  type RegistrationQrPreview,
} from "../qrcode/registration-qr.ts";

// The page authenticates the capogruppo role first. Recheck membership and the
// current assignment before decrypting any credential, using server identities.
export async function loadLeaderAssignmentQr(
  db: SupabaseClient,
  userId: string,
  eventId: string,
  assignmentId: string,
): Promise<RegistrationQrPreview> {
  const unavailable: RegistrationQrPreview = {
    state: "unavailable",
    dataUrl: null,
    expiresAt: null,
  };
  try {
    const { scopedGroupIds } = await loadLeaderScope(db, userId, eventId);
    if (!scopedGroupIds.size) return unavailable;
    const { data, error } = await db
      .from("participant_group_assignments")
      .select(
        "group_id,registration_id,registrations!inner(id,event_id,deleted_at)",
      )
      .eq("id", assignmentId)
      .eq("is_current", true)
      .eq("registrations.event_id", eventId)
      .is("registrations.deleted_at", null)
      .maybeSingle();
    if (error) throw new Error("Assignment read failed");
    if (!data || !scopedGroupIds.has(data.group_id)) return unavailable;
    return await registrationQrPreview(
      await loadRegistrationQr(db, data.registration_id),
    );
  } catch {
    console.error("[capogruppo:qr] QR unavailable");
    return unavailable;
  }
}
