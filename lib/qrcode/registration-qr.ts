import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptQrToken } from "./secure-token.ts";
import { renderParticipantQrDataUrl, type QrParticipantIdentity } from "./participant-card.ts";

export type RegistrationQrRecord = {
  status: string;
  expires_at: string | null;
  revoked_at?: string | null;
  token_encrypted: string | null;
};
export type RegistrationQrState =
  "active" | "revoked" | "expired" | "unavailable";
export type RegistrationQrPreview = {
  state: RegistrationQrState;
  dataUrl: string | null;
  expiresAt: string | null;
};

export function registrationQrState(
  record: RegistrationQrRecord | null,
  now = Date.now(),
): RegistrationQrState {
  if (!record) return "unavailable";
  if (record.status === "revoked" || record.revoked_at) return "revoked";
  if (record.status === "expired") return "expired";
  if (record.expires_at) {
    const expires = Date.parse(record.expires_at);
    if (!Number.isFinite(expires)) return "unavailable";
    if (expires <= now) return "expired";
  }
  return record.status === "active" ? "active" : "unavailable";
}
// Read only after the caller has established access to this registration.
// The newest token is authoritative; never fall back to an older active token.
export async function loadRegistrationQr(
  db: SupabaseClient,
  registrationId: string,
): Promise<RegistrationQrRecord | null> {
  const { data, error } = await db
    .from("qr_tokens")
    .select("status,expires_at,revoked_at,token_encrypted")
    .eq("registration_id", registrationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("QR read failed");
  return data as RegistrationQrRecord | null;
}
export async function registrationQrPreview(
  record: RegistrationQrRecord | null,
  participant: QrParticipantIdentity,
  now = Date.now(),
): Promise<RegistrationQrPreview> {
  const state = registrationQrState(record, now);
  const expiresAt = record?.expires_at ?? null;
  if (state !== "active") return { state, dataUrl: null, expiresAt };
  const token = decryptQrToken(record?.token_encrypted);
  if (!token) return { state: "unavailable", dataUrl: null, expiresAt };
  try {
    return { state, dataUrl: await renderParticipantQrDataUrl(token, participant), expiresAt };
  } catch {
    return { state: "unavailable", dataUrl: null, expiresAt };
  }
}
