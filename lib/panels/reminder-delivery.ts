import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmailConfig } from "../email/config.ts";
import { EmailDeliveryError, sendTransactionalEmail, type SendEmailInput } from "../email/smtp.ts";
import type { ForumReminderNotice } from "./reminder-email.ts";

/** Bounded concurrency drains large Forum audiences without overlapping claims. */
export async function processForumReminders(
  db: SupabaseClient,
  prepare: (notice: ForumReminderNotice) => Promise<SendEmailInput | null>,
  options: { send?: typeof sendTransactionalEmail; mode?: "log" | "postmark" } = {},
) {
  const counts = { accepted: 0, failed: 0, uncertain: 0, skipped: 0, deferred: 0 };
  if ((options.mode ?? getEmailConfig().deliveryMode) === "log") return counts;
  const queued = await db.rpc("enqueue_forum_reminders");
  if (queued.error) throw Error("forum_reminder_enqueue_failed");
  const stopAt = Date.now() + 45_000;
  let claimed = 0;
  async function drain() {
    while (claimed < 1000 && Date.now() < stopAt) {
      claimed++;
      const result = await db.rpc("claim_forum_reminder");
      if (result.error) throw Error("forum_reminder_claim_failed");
      if (!result.data) return;
      const notice = result.data as ForumReminderNotice;
      let state: keyof typeof counts = "failed", started = false;
      let messageId: string | null = null, errorCode: string | null = null;
      try {
        const email = notice.payload.length ? await prepare(notice) : null;
        if (!email || !notice.payload.length || Date.parse(notice.payload[0].startsAt) <= Date.now()) {
          state = "skipped";
          errorCode = "booking_or_recipient_unavailable";
        } else {
          const authorized = await db.rpc("authorize_forum_reminder", {
            p_id: notice.id, p_claim: notice.claim, p_payload: notice.payload,
            p_recipient: email.to, p_subject: email.subject, p_text: email.text,
          });
          if (authorized.error) throw Error("forum_reminder_authorization_failed");
          if (!authorized.data) {
            state = "deferred";
            errorCode = "booking_changed";
          } else {
            started = true;
            const sent = await (options.send ?? sendTransactionalEmail)(email);
            messageId = sent.messageId;
            state = "accepted";
          }
        }
      } catch (error) {
        state = started && (!(error instanceof EmailDeliveryError) || error.code.endsWith("_unknown")) ? "uncertain" : "failed";
        errorCode = error instanceof EmailDeliveryError ? error.code
          : error instanceof Error && error.message === "forum_reminder_address_missing" ? error.message : "preparation_failed";
      }
      const finished = await db.from("forum_reminder_emails").update({
        state: state === "deferred" ? "queued" : state, message_id: messageId, error_code: errorCode,
        ...(state === "deferred" ? { retry_after: new Date(Date.now() + 60_000).toISOString() } : {}),
        accepted_at: state === "accepted" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", notice.id).eq("claim", notice.claim).eq("state", "sending").select("id").maybeSingle();
      if (finished.error || !finished.data) throw Error("forum_reminder_result_unknown");
      counts[state]++;
    }
  }
  // Wait for every in-flight send even if another lane fails.
  const lanes = await Promise.allSettled(Array.from({ length: 10 }, drain));
  if (lanes.some(lane => lane.status === "rejected")) throw Error("forum_reminder_processing_failed");
  return counts;
}
