import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { resolveCurrentParticipantRecipients, loadCampaignRecipientPreviews } from "@/lib/email/campaign-recipients.server";
import { loadRowsForIds } from "@/lib/supabase/all-rows";
import { processForumReminders } from "./reminder-delivery";
import { renderForumReminderEmail, renderForumReminderDigest } from "./reminder-email";

export async function processDueForumReminders() {
  const db = createSupabaseServiceClient();
  return processForumReminders(db, async notice => {
    if (!notice.payload.length) return null;
    const delegated = notice.recipientKey.startsWith("delegate:");
    const userId = delegated ? notice.recipientKey.slice("delegate:".length) : null;
    const recipients = await resolveCurrentParticipantRecipients(notice.eventId, notice.payload.map(p => p.registrationId));
    let eligible = recipients.filter(recipient => delegated
      ? recipient.deliveryKind === "delegated" && recipient.delegateUserId === userId
      : recipient.deliveryKind === "direct" && `participant:${recipient.registrationId}` === notice.recipientKey);
    if (delegated) {
      const snapshots = await loadRowsForIds<{ registration_id: string; answers: { contact?: { useLeaderEmail?: boolean; communicationDelegateUserId?: string } } }>(
        eligible.flatMap(r => r.registrationId ? [r.registrationId] : []),
        (ids, from, to) => db.from("registration_questionnaire_answers").select("registration_id,answers")
          .eq("event_id", notice.eventId).in("registration_id", ids).order("id").range(from, to),
      );
      const explicit = new Set(snapshots.data.filter(row => row.answers?.contact?.useLeaderEmail === true
        && row.answers.contact.communicationDelegateUserId === userId).map(row => row.registration_id));
      eligible = eligible.filter(r => r.registrationId && explicit.has(r.registrationId));
    }
    if (!eligible.length) return null;
    const previews = await loadCampaignRecipientPreviews(eligible, new Set(), notice.eventId, false);
    const to = previews[0]?.destinationEmail;
    if (!to || previews.some(p => p.destinationEmail !== to)) return null;
    const allowedIds = new Set(previews.map(p => p.registrationId));
    const payloads = notice.payload.filter(p => allowedIds.has(p.registrationId));
    if (!payloads.length) return null;
    let locale: string | null = null;
    if (userId) {
      const profile = await db.from("profiles").select("preferred_locale").eq("id", userId).maybeSingle();
      if (profile.error) throw Error("forum_reminder_locale_unavailable");
      locale = profile.data?.preferred_locale ?? null;
    }
    return { to, ...(delegated
      ? renderForumReminderDigest(payloads, locale)
      : renderForumReminderEmail(payloads[0])), metadata: { forum_reminder_id: notice.id } };
  });
}
