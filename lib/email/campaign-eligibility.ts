import type { SupabaseClient } from "@supabase/supabase-js";

export async function isCampaignRecipientOperational(
  service: SupabaseClient,
  eventId: string,
  recipient: {
    recipientType: string;
    registrationId: string | null;
    participantId: string | null;
    recipientUserId: string | null;
    delegateUserId: string | null;
  },
): Promise<boolean> {
  if (recipient.recipientType === "participant") {
    if (!recipient.registrationId || !recipient.participantId) return false;
    const { data, error } = await service
      .from("registrations")
      .select("id")
      .eq("id", recipient.registrationId)
      .eq("participant_id", recipient.participantId)
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error("Cannot verify registration eligibility");
    if (!data) return false;
  }
  const userId = recipient.recipientUserId ?? recipient.delegateUserId;
  if (userId) {
    const { data, error } = await service
      .from("registrations")
      .select("id,participants!inner(auth_user_id)")
      .eq("event_id", eventId)
      .eq("participants.auth_user_id", userId)
      .not("deleted_at", "is", null)
      .limit(1);
    if (error) throw new Error("Cannot verify recipient eligibility");
    if (data?.length) return false;
  }
  return true;
}

export class RegistrationNotOperationalError extends Error {}
