import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_EMAIL_FROM, getEmailConfig } from "../email/config.ts";
import { EmailDeliveryError, sendTransactionalEmail } from "../email/smtp.ts";
import { postmarkRead } from "../email/postmark-reporting.ts";
import { publicationDeliveryEvidence } from "../ceremonies/publication-report.ts";

export type ForumReminderReport = {
  id: string; claim: string;
  payload: {
    title: string; startsAt: string; location: string; address: string | null; checkedAt: string;
    total: number; accepted: number; delivered: number; bounced: number; pending: number; unverified: number;
    failed: number; uncertain: number; skipped: number; personal: number; digests: number; missingAddress: number;
  };
};
const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
export function renderForumReminderReport(report: ForumReminderReport) {
  const p = report.payload;
  const format = new Intl.DateTimeFormat("it", {dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Rome"});
  const lines = [p.title, `Forum: ${format.format(new Date(p.startsAt))} (Europe/Rome)`,
    `Sede: ${p.location} — ${p.address || "Indirizzo mancante"}`,
    `Verifica: ${format.format(new Date(p.checkedAt))} (Europe/Rome)`,
    `Email previste: ${p.total}`,
    `Accettate da Postmark: ${p.accepted} (${p.personal} personali, ${p.digests} riepiloghi ai capigruppo)`,
    `Consegnate al server destinatario: ${p.delivered}`,
    `Non recapitate (bounce): ${p.bounced}`,
    `Accettate, consegna ancora in attesa: ${p.pending}`,
    `Accettate, verifica della consegna non disponibile: ${p.unverified}`,
    `Invio fallito: ${p.failed} (di cui ${p.missingAddress} per indirizzo della sede mancante)`,
    `Esito di invio incerto: ${p.uncertain}`,
    `Non inviate (prenotazione o destinatario non disponibile): ${p.skipped}`,
    "I conteggi riguardano le email: un riepilogo al capogruppo può includere più persone. La consegna al server non conferma la lettura.",
    "Il report fotografa gli esiti all’ora indicata. Eventuali nuove prenotazioni successive e consegne aggiornate in seguito non sono incluse. Gli invii incerti non vengono ripetuti automaticamente."];
  return {
    to: DEFAULT_EMAIL_FROM,
    subject: `Report promemoria Forum — ${p.title.replace(/[\r\n]+/g, " ")}`,
    text: lines.join("\n\n"),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h1>Report promemoria Forum</h1>${lines.map(line=>`<p>${escape(line)}</p>`).join("")}</div>`,
    metadata: { forum_report_id: report.id },
  };
}

export async function processForumReminderReports(db: SupabaseClient, options: {
  mode?: "log" | "postmark"; stream?: string;
  read?: typeof postmarkRead; send?: typeof sendTransactionalEmail;
} = {}) {
  const counts = { checked: 0, accepted: 0, failed: 0, uncertain: 0 };
  if ((options.mode ?? getEmailConfig().deliveryMode) === "log") return counts;
  const stream = options.stream ?? getEmailConfig().transactionalStream;
  const stopAt = Date.now() + 45_000;
  let checked = 0;
  async function verify() {
    while (checked < 300 && Date.now() < stopAt) {
      checked++;
      const claim = await db.rpc("claim_forum_reminder_delivery_check");
      if (claim.error) throw Error("forum_reminder_check_claim_failed");
      if (!claim.data) return;
      const row = claim.data as {id:string;claim:string;messageId:string;recipient:string};
      let state = "unverified", at: string | null = null;
      try {
        if (!row.messageId || !row.recipient) throw Error("missing_delivery_identity");
        const details = await (options.read ?? postmarkRead)(`/messages/outbound/${encodeURIComponent(row.messageId)}/details`);
        const evidence = publicationDeliveryEvidence(details,row.messageId,row.recipient,stream);
        state = evidence?.state ?? "pending"; at = evidence?.at ?? null;
      } catch { /* An unavailable provider never counts as delivered. */ }
      const saved = await db.from("forum_reminder_emails").update({delivery_state:state,delivery_at:at,delivery_checked_at:new Date().toISOString()})
        .eq("id",row.id).eq("delivery_check_claim",row.claim).eq("state","accepted").select("id").maybeSingle();
      if (saved.error || !saved.data) throw Error("forum_reminder_check_save_failed");
      counts.checked++;
    }
  }
  const checks = await Promise.allSettled(Array.from({length:5},verify));
  if (checks.some(result=>result.status==="rejected")) throw Error("forum_reminder_check_failed");
  for (let i=0;i<10 && Date.now()<stopAt;i++) {
    const claim = await db.rpc("claim_forum_reminder_report");
    if (claim.error) throw Error("forum_reminder_report_claim_failed");
    if (!claim.data) break;
    const report = claim.data as ForumReminderReport;
    let state: "accepted" | "failed" | "uncertain" = "failed", started = false;
    let messageId: string | null = null, errorCode: string | null = null;
    try {
      const email = renderForumReminderReport(report);
      const snapshot = await db.from("forum_reminder_reports").update({subject_snapshot:email.subject,text_snapshot:email.text})
        .eq("id",report.id).eq("claim",report.claim).eq("state","sending").select("id").maybeSingle();
      if (snapshot.error || !snapshot.data) throw Error("report_snapshot_failed");
      started = true;
      messageId = (await (options.send ?? sendTransactionalEmail)(email)).messageId;
      state = "accepted";
    } catch (error) {
      state = started && (!(error instanceof EmailDeliveryError) || error.code.endsWith("_unknown")) ? "uncertain" : "failed";
      errorCode = error instanceof EmailDeliveryError ? error.code : "report_preparation_failed";
    }
    const saved = await db.from("forum_reminder_reports").update({state,message_id:messageId,error_code:errorCode,
      accepted_at:state==="accepted"?new Date().toISOString():null,updated_at:new Date().toISOString()})
      .eq("id",report.id).eq("claim",report.claim).eq("state","sending").select("id").maybeSingle();
    if (saved.error || !saved.data) throw Error("forum_reminder_report_result_unknown");
    counts[state]++;
  }
  return counts;
}
