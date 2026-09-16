import { getEmailConfig } from "@/lib/email/config";
import { isCampaignRecipientOperational, RegistrationNotOperationalError } from "@/lib/email/campaign-eligibility";
import { createHash } from "node:crypto";

import { campaignHtmlToText, renderSafeCampaignHtml } from "@/lib/email/campaign-html.server";
import {
  resolveCurrentParticipantRecipient,
  type CampaignRecipient,
  type CampaignDeliveryKind,
  type CampaignRecipientType,
} from "@/lib/email/campaign-recipients.server";
import {
  getCampaignLocalDate,
} from "@/lib/email/campaign-scheduling";
import { renderCampaignTemplate } from "@/lib/email/campaign-templates";
import { sendBroadcastBatch, EmailDeliveryError, type SendEmailInput } from "@/lib/email/smtp";
import {
  getOperationalUserIdentities,
  splitFullName,
} from "@/lib/operational-users/identity";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const SEND_CONCURRENCY = 3;
const ATTACHMENTS_BUCKET = "email-campaign-attachments";

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

type CampaignAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
  cid?: string;
  inline: boolean;
};

type CampaignRow = {
  id: string;
  event_id: string;
  subject_template: string;
  body_template: string;
  events: { title: string } | Array<{ title: string }> | null;
};

type RecipientDatabaseRow = {
  id: string;
  campaign_id: string;
  recipient_key: string;
  recipient_type: CampaignRecipientType;
  participant_id: string | null;
  registration_id: string | null;
  recipient_user_id: string | null;
  delivery_kind: CampaignDeliveryKind;
  delegate_user_id: string | null;
  status: string;
};

export async function reserveCampaignDeliverySchedule(
  campaignId: string
) {
  const service = createSupabaseServiceClient();
  const { data, error } = await service.rpc(
    "reserve_email_campaign_schedule",
    { p_campaign_id: campaignId }
  );
  if (error) throw new Error(error.message);
  const reservation = (data ?? [])[0] as
    | {
        scheduled_today: number;
        scheduled_later: number;
        last_scheduled_for: string;
      }
    | undefined;
  if (!reservation) {
    throw new Error("Impossibile riservare la coda giornaliera.");
  }

  return {
    scheduledToday: reservation.scheduled_today,
    scheduledLater: reservation.scheduled_later,
    lastScheduledFor: reservation.last_scheduled_for,
  };
}

async function processCampaignBlock(options: {
  campaignId?: string;
  actorUserId?: string | null;
}) {
  // Fail before claiming recipients when the provider is not configured.
  getEmailConfig();
  const service = createSupabaseServiceClient();
  const today = getCampaignLocalDate();
  const { data: dueRows, error: dueError } = await service.rpc(
    "claim_due_email_campaign_recipients",
    { p_campaign_id: options.campaignId ?? null }
  );
  if (dueError) throw new Error(dueError.message);
  const recipients = (dueRows ?? []) as RecipientDatabaseRow[];
  if (!recipients.length) {
    return { ...await summarizeDeliveryResult(service, options.campaignId, 0, 0), claimed: 0, paused: false };
  }

  const campaignIds = [...new Set(recipients.map((row) => row.campaign_id))];
  const { data: campaignRows, error: campaignsError } = await service
    .from("email_campaigns")
    .select("id,event_id,subject_template,body_template,events(title)")
    .in("id", campaignIds);
  if (campaignsError) throw new Error(campaignsError.message);
  const campaigns = new Map(
    ((campaignRows ?? []) as CampaignRow[]).map((campaign) => [campaign.id, campaign])
  );
  const attachments = new Map<string, Promise<CampaignAttachment[]>>();
  const sentByCampaign = new Map<string, number>();
  const failedByCampaign = new Map<string, number>();
  let sent = 0;
  let failed = 0;

  const prepared: Array<{ row: RecipientDatabaseRow; recipient: CampaignRecipient; input: SendEmailInput }> = [];
  await runWithConcurrency(recipients, SEND_CONCURRENCY, async (row) => {
    const campaign = campaigns.get(row.campaign_id);
    if (!campaign) {
      await markDeliveryFailed(service, row.id, "campaign_missing");
      incrementCount(failedByCampaign, row.campaign_id);
      failed++;
      return;
    }

    try {
      const recipient = campaignRecipientFromDatabaseRow(row);
      const eventTitle = relatedOne(campaign.events)?.title ?? "Evento";
      const delivery = await loadCampaignDeliveryData(
        service,
        campaign.event_id,
        eventTitle,
        recipient
      );
      let attachmentLoad = attachments.get(campaign.id);
      if (!attachmentLoad) {
        attachmentLoad = loadCampaignAttachments(service, campaign.id);
        attachments.set(campaign.id, attachmentLoad);
      }
      const campaignAttachments = await attachmentLoad;
      const html = appendInlineImages(
        renderSafeCampaignHtml(campaign.body_template, delivery.templateData),
        campaignAttachments
      );
      if (!await isCampaignRecipientOperational(service, campaign.event_id, delivery.recipient)) throw new RegistrationNotOperationalError();
      prepared.push({ row, recipient: delivery.recipient, input: {
        to: delivery.email,
        subject: renderCampaignTemplate(
          campaign.subject_template,
          delivery.templateData
        ),
        text: campaignHtmlToText(html),
        html,
        attachments: campaignAttachments.map(emailAttachmentInput),
      } });
    } catch (error) {
      if (error instanceof RegistrationNotOperationalError) {
        await service.from("email_campaign_recipients").update({ status: "skipped", error_code: "registration_deleted", processing_started_at: null }).eq("id", row.id);
        return;
      }
      await markDeliveryFailed(service, row.id, error instanceof EmailDeliveryError ? error.code : "delivery_failed");
      incrementCount(failedByCampaign, row.campaign_id);
      failed++;
    }
  });

  const results = await sendBroadcastBatch(prepared.map(item => item.input));
  const interrupted = results.filter(result => result.disposition);
  let pauseError: unknown;
  if (interrupted.length) {
    // Pause globally before releasing safe-to-retry rows. Other cron instances
    // use the same durable gate; requests already in flight still save results.
    const cause = interrupted.find(result => result.disposition === "blocked")
      ?? interrupted.find(result => result.disposition === "unknown") ?? interrupted[0];
    try {
      const { error } = await service.rpc("pause_email_campaign_delivery", {
        p_error_code: cause.errorCode,
        p_blocked: interrupted.some(result => result.disposition === "blocked"),
        p_retry_after_seconds: Math.max(
          cause.disposition === "unknown" ? 300 : 60,
          ...interrupted.map(result => result.retryAfterSeconds ?? 0)
        ),
      });
      if (error) throw new Error(error.message);
    } catch (error) { pauseError = error; }
  }
  const persisted = await Promise.allSettled(prepared.map(async ({ row, recipient }, index) => {
    const result = results[index];
    if (result.errorCode) {
      if (result.disposition) {
        // No retry of unknown acceptance, even after the shared pause expires.
        // If the pause could not be persisted, keep retryable rows locked.
        if (pauseError && result.disposition !== "unknown") return;
        const { error } = await service.from("email_campaign_recipients").update({
          status: result.disposition === "unknown" ? "unknown" : "scheduled",
          error_code: result.errorCode,
          processing_started_at: null,
        }).eq("id", row.id).eq("status", "sending");
        if (error) throw new Error(error.message);
        return;
      }
      await markDeliveryFailed(service, row.id, result.errorCode);
      incrementCount(failedByCampaign, row.campaign_id); failed++;
      return;
    }
      const { error: updateError } = await service
        .from("email_campaign_recipients")
        .update({
          status: "sent",
          delivery_kind: recipient.deliveryKind,
          delegate_user_id: recipient.delegateUserId,
          provider_message_id: hashMessageId(result.messageId!),
          error_code: null,
          sent_at: new Date().toISOString(),
          processing_started_at: null,
        })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
      incrementCount(sentByCampaign, row.campaign_id);
      sent++;
  }));
  // Preserve successful writes even if another row cannot be saved. Uncertain
  // rows remain sending, so a later invocation cannot send them again.
  const persistenceFailure = persisted.find(result => result.status === "rejected");
  if (persistenceFailure?.status === "rejected") throw persistenceFailure.reason;
  if (pauseError) throw pauseError;

  await Promise.all(
    campaignIds.map(async (campaignId) => {
      const status = await refreshCampaignStatus(service, campaignId);
      const campaign = campaigns.get(campaignId);
      if (!campaign) return;
      await service.from("audit_logs").insert({
        event_id: campaign.event_id,
        actor_user_id: options.actorUserId ?? null,
        action: "email_campaign.batch_processed",
        entity_table: "email_campaigns",
        entity_id: campaignId,
        metadata: {
          sent: sentByCampaign.get(campaignId) ?? 0,
          failed: failedByCampaign.get(campaignId) ?? 0,
          status,
          scheduled_for: today,
        },
      });
    })
  );

  return { ...await summarizeDeliveryResult(service, options.campaignId, sent, failed), claimed: recipients.length, paused: interrupted.length > 0 };
}

export async function loadCampaignDeliveryData(
  service: ServiceClient,
  eventId: string,
  eventTitle: string,
  recipient: CampaignRecipient
) {
  if (recipient.recipientType === "participant" && recipient.registrationId) {
    const current = await resolveCurrentParticipantRecipient(eventId, recipient.registrationId);
    if (!current || current.participantId !== recipient.participantId) {
      if (!await isCampaignRecipientOperational(service, eventId, { ...recipient, delegateUserId: null })) {
        throw new RegistrationNotOperationalError();
      }
      throw new Error("Destinatario non più raggiungibile.");
    }
    recipient = current;
  }
  if (!await isCampaignRecipientOperational(service, eventId, recipient)) throw new RegistrationNotOperationalError();
  if (recipient.recipientType === "group_leader" && recipient.recipientUserId) {
    const identities = await getOperationalUserIdentities(service, [
      recipient.recipientUserId,
    ]);
    const identity = identities.get(recipient.recipientUserId);
    if (!identity?.email?.trim()) {
      throw new Error("Capogruppo non più raggiungibile.");
    }
    const { data: memberships } = await service
      .from("group_memberships")
      .select("groups!inner(name,event_id)")
      .eq("user_id", recipient.recipientUserId)
      .eq("role", "capogruppo")
      .eq("groups.event_id", eventId);
    const groupNames = (memberships ?? []).flatMap((membership) => {
      const group = relatedOne(membership.groups);
      return group?.name ? [group.name] : [];
    });
    let name = splitFullName(identity.fullName);
    let participantCode: string | null = null;
    if (identity.participantId) {
      const { data: participant, error } = await service
        .from("participants")
        .select("public_code,first_name,last_name")
        .eq("id", identity.participantId)
        .maybeSingle();
      if (error) throw error;
      if (!participant) throw new Error("Dati del capogruppo non disponibili.");
      name = {
        firstName: participant.first_name ?? "",
        lastName: participant.last_name ?? "",
      };
      participantCode = participant.public_code ?? null;
    }
    return {
      recipient,
      email: identity.email.trim(),
      templateData: {
        firstName: name.firstName || identity.fullName || "Capogruppo",
        lastName: name.lastName,
        participantCode,
        groupName: groupNames.join(", ") || null,
        eventTitle,
      },
    };
  }

  if (!recipient.participantId || !recipient.registrationId) {
    throw new Error("Destinatario partecipante non valido.");
  }
  const [{ data: participant }, { data: assignment }, email] = await Promise.all([
    service
      .from("participants")
      .select("id,first_name,last_name,public_code")
      .eq("id", recipient.participantId)
      .single(),
    service
      .from("participant_group_assignments")
      .select("groups(name)")
      .eq("registration_id", recipient.registrationId)
      .eq("is_current", true)
      .maybeSingle(),
    loadDeliveryEmail(service, recipient),
  ]);
  const group = relatedOne(assignment?.groups);
  if (!participant || !email) {
    throw new Error("Destinatario non più raggiungibile.");
  }
  return {
    recipient,
    email,
    templateData: {
      firstName: participant.first_name,
      lastName: participant.last_name,
      participantCode: participant.public_code,
      groupName: group?.name ?? null,
      eventTitle,
    },
  };
}

export async function loadCampaignAttachments(
  service: ServiceClient,
  campaignId: string
) {
  const { data: rows, error: rowsError } = await service
    .from("email_campaign_attachments")
    .select("file_name,content_type,storage_path,is_inline,content_id")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (rowsError) throw new Error(rowsError.message);

  return Promise.all(
    (rows ?? []).map(async (row): Promise<CampaignAttachment> => {
      const { data, error: downloadError } = await service.storage
        .from(ATTACHMENTS_BUCKET)
        .download(row.storage_path);
      if (downloadError || !data) {
        throw new Error(`Impossibile recuperare l'allegato ${row.file_name}.`);
      }
      return {
        filename: row.file_name,
        contentType: row.content_type,
        content: Buffer.from(await data.arrayBuffer()),
        cid: row.content_id ?? undefined,
        inline: row.is_inline,
      };
    })
  );
}

export function appendInlineImages(
  html: string,
  attachments: CampaignAttachment[]
) {
  const images = attachments.filter(
    (attachment) => attachment.inline && attachment.cid
  );
  if (!images.length) return html;
  return `${html}<div style="margin-top:24px">${images
    .map(
      (image) =>
        `<p style="margin:16px 0"><img src="cid:${image.cid}" alt="${escapeHtmlAttribute(image.filename)}" style="display:block;max-width:100%;height:auto" /></p>`
    )
    .join("")}</div>`;
}

export function emailAttachmentInput(attachment: CampaignAttachment) {
  return {
    filename: attachment.filename,
    content: attachment.content,
    contentType: attachment.contentType,
    cid: attachment.cid,
  };
}

export function campaignRecipientFromDatabaseRow(
  row: RecipientDatabaseRow
): CampaignRecipient {
  return {
    recipientKey: row.recipient_key,
    recipientType: row.recipient_type,
    participantId: row.participant_id,
    registrationId: row.registration_id,
    recipientUserId: row.recipient_user_id,
    deliveryKind: row.delivery_kind,
    delegateUserId: row.delegate_user_id,
  };
}

async function summarizeDeliveryResult(
  service: ServiceClient,
  campaignId: string | undefined,
  sent: number,
  failed: number
) {
  let scheduled = 0;
  let status = "scheduled";
  if (campaignId) {
    const [{ count }, { data: campaign }] = await Promise.all([
      service
        .from("email_campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .eq("status", "scheduled"),
      service
        .from("email_campaigns")
        .select("status")
        .eq("id", campaignId)
        .maybeSingle(),
    ]);
    scheduled = count ?? 0;
    status = campaign?.status ?? status;
  }
  return { ok: true, sent, failed, scheduled, status };
}

async function refreshCampaignStatus(service: ServiceClient, campaignId: string) {
  const counts = await Promise.all(["pending", "scheduled", "sending", "sent", "failed", "unknown"].map(async status => {
    const { count, error } = await service.from("email_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId).eq("status", status);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }));
  const [pending, scheduled, sending, sent, failed, unknown] = counts;
  const status = unknown > 0 ? "attention" : pending + scheduled + sending > 0
    ? "scheduled"
    : failed === 0 ? "completed" : sent === 0 ? "failed" : "partial";
  const { error: updateError } = await service
    .from("email_campaigns")
    .update({ status })
    .eq("id", campaignId);
  if (updateError) throw new Error(updateError.message);
  return status;
}

async function loadDeliveryEmail(
  service: ServiceClient,
  recipient: CampaignRecipient
): Promise<string | null> {
  if (recipient.deliveryKind === "direct" && recipient.participantId) {
    const { data } = await service
      .from("participant_contacts")
      .select("email")
      .eq("participant_id", recipient.participantId)
      .not("email", "is", null)
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.email ?? null;
  }
  if (!recipient.delegateUserId) return null;
  const { data } = await service
    .from("profiles")
    .select("email")
    .eq("id", recipient.delegateUserId)
    .maybeSingle();
  return data?.email ?? null;
}

async function markDeliveryFailed(
  service: ServiceClient,
  recipientRowId: string,
  errorCode: string
) {
  const { error } = await service
    .from("email_campaign_recipients")
    .update({
      status: "failed",
      error_code: errorCode,
      processing_started_at: null,
    })
    .eq("id", recipientRowId);
  if (error) throw new Error(error.message);
}

function relatedOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (index < items.length) {
        const item = items[index++];
        await worker(item);
      }
    })
  );
}

function hashMessageId(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function incrementCount(counts: Map<string, number>, key: string) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

// Multiple small claims bound preparation memory and keep eligibility checks fresh.
// A new cron invocation picks up the remainder; sending/failed rows are never reclaimed.
export async function processDueCampaignDeliveries(options: { campaignId?: string; actorUserId?: string | null }) {
  const deadline = Date.now() + 180_000;
  let sent = 0, failed = 0;
  let result;
  do {
    result = await processCampaignBlock(options);
    sent += result.sent; failed += result.failed;
  } while (result.claimed > 0 && !result.paused && Date.now() < deadline);
  return { ...result, sent, failed };
}
