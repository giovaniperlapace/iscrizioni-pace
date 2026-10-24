import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmailConfig } from "../email/config.ts";
import {
  sendTransactionalEmail,
  EmailDeliveryError,
  type SendEmailInput,
} from "../email/smtp.ts";
import type { PublicationNotice } from "./publication-email.ts";
export async function processCeremonyPublicationEmails(
  db: SupabaseClient,
  prepare: (notice: PublicationNotice) => Promise<SendEmailInput | null>,
  options: {
    send?: typeof sendTransactionalEmail;
    mode?: "log" | "postmark";
  } = {},
) {
  const counts = { accepted: 0, failed: 0, uncertain: 0, skipped: 0 };
  if ((options.mode ?? getEmailConfig().deliveryMode) === "log") return counts;
  const stop = Date.now() + 45_000;
  for (let i = 0; i < 20 && Date.now() < stop; i++) {
    const { data, error } = await db.rpc("claim_ceremony_publication_email");
    if (error) throw Error("ceremony_email_claim_failed");
    if (!data) break;
    const notice = data as PublicationNotice;
    let state: keyof typeof counts = "failed",
      recipient: string | null = null,
      messageId: string | null = null,
      errorCode: string | null = null,
      started = false;
    try {
      const email = notice.payload.lines.length ? await prepare(notice) : null;
      if (!email) {
        state = "skipped";
        errorCode = notice.payload.lines.length
          ? "recipient_unavailable"
          : "assignment_no_longer_active";
      } else {
        recipient = email.to;
        const saved = await db
          .from("ceremony_publication_emails")
          .update({
            recipient,
            subject_snapshot: email.subject,
            text_snapshot: email.text,
          })
          .eq("id", notice.id)
          .eq("claim", notice.claim)
          .eq("state", "sending")
          .select("id")
          .maybeSingle();
        if (saved.error || !saved.data) throw Error("recipient_save_failed");
        started = true;
        const sent = await (options.send ?? sendTransactionalEmail)(email);
        messageId = sent.messageId;
        state = "accepted";
      }
    } catch (error) {
      state =
        started &&
        (!(error instanceof EmailDeliveryError) ||
          error.code.endsWith("_unknown"))
          ? "uncertain"
          : "failed";
      errorCode =
        error instanceof EmailDeliveryError ? error.code : "preparation_failed";
    }
    const finished = await db
      .from("ceremony_publication_emails")
      .update({
        state,
        recipient,
        message_id: messageId,
        error_code: errorCode,
        accepted_at: state === "accepted" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", notice.id)
      .eq("claim", notice.claim)
      .eq("state", "sending")
      .select("id")
      .maybeSingle();
    if (finished.error || !finished.data)
      throw Error("ceremony_email_result_unknown");
    counts[state]++;
  }
  return counts;
}
