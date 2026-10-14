import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getEmailConfig } from "@/lib/email/config";
import { EmailDeliveryError, sendTransactionalEmail } from "@/lib/email/smtp";
import { renderForumWaitlistEmail, type ForumWaitlistOffer } from "./waitlist-email";

/** Called by the existing authenticated minute scheduler. No browser polling. */
export async function processForumWaitlistNotifications() {
  // Validate configuration before acquiring an offer; never expose configuration or recipient data.
  getEmailConfig();
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl || !["https:", "http:"].includes(new URL(appUrl).protocol)) throw new Error("Forum notification site URL missing");
  const db = createSupabaseServiceClient();
  const result = { sent: 0, failed: 0, unknown: 0 };
  const stopAt = Date.now() + 45_000;
  // A committed claim prevents overlapping workers from sending the same message.
  for (let count = 0; count < 25 && Date.now() < stopAt; count++) {
    const { data, error } = await db.rpc("claim_panel_waitlist_notification");
    if (error) throw new Error("Forum waiting list claim failed");
    if (!data) break;
    const offer = data as ForumWaitlistOffer;
    let outcome: "sent" | "failed" | "unknown" = "failed";
    let messageId: string | null = null;
    try {
      const rendered = renderForumWaitlistEmail(offer, appUrl);
      // A delayed claim must never send an already expired invitation.
      if (Date.parse(offer.expiresAt) <= Date.now()) throw new Error("Expired Forum notification");
      const delivered = await sendTransactionalEmail({ to: offer.email, ...rendered });
      outcome = "sent";
      messageId = delivered.messageId;
    } catch (cause) {
      outcome = cause instanceof EmailDeliveryError && cause.code.endsWith("_unknown") ? "unknown" : "failed";
    }
    const { error: finishError } = await db.rpc("finish_panel_waitlist_notification", {
      p_id: offer.id, p_claim: offer.claim, p_outcome: outcome, p_message_id: messageId,
    });
    // If acknowledgement fails, the committed sending state prevents a blind resend.
    if (finishError) throw new Error("Forum notification acknowledgement failed");
    result[outcome]++;
  }
  return result;
}
