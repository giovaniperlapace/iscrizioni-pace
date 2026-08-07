import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentAuthContext, type EventUserRole } from "@/lib/auth/session";
import { resolveSelectedCampaignRecipientIds } from "@/lib/email/campaign-selection";
import { renderCampaignTemplate, validateCampaignTemplate } from "@/lib/email/campaign-templates";
import { campaignHtmlToText, renderSafeCampaignHtml } from "@/lib/email/campaign-html.server";
import {
  appendInlineImages,
  campaignRecipientFromDatabaseRow,
  emailAttachmentInput,
  loadCampaignAttachments,
  loadCampaignDeliveryData,
  processDueCampaignDeliveries,
  reserveCampaignDeliverySchedule,
} from "@/lib/email/campaign-delivery.server";
import {
  loadCampaignRecipientPreviews,
  resolveCampaignRecipients,
  type CampaignRecipient as Recipient,
  type CampaignRecipientPreview as RecipientPreview,
} from "@/lib/email/campaign-recipients.server";
import { sendTransactionalEmail } from "@/lib/email/smtp";
import { getCurrentOperationalEvent } from "@/lib/events/current";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const ATTACHMENTS_BUCKET = "email-campaign-attachments";
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_TOTAL_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const INLINE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

type CampaignAction = "recipients" | "preview" | "update_recipients" | "test" | "send";
type IncomingAttachment = { file: File; inline: boolean };

export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireCampaignManager();
  if (auth.response) return auth.response;
  let body: Record<string, unknown>;
  let attachments: IncomingAttachment[] = [];
  try {
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const formData = await request.formData();
      body = Object.fromEntries(
        [...formData.entries()].filter(([, value]) => typeof value === "string")
      );
      attachments = parseIncomingAttachments(formData);
    } else {
      body = await request.json();
    }
  } catch {
    return error("Richiesta non valida.", 400);
  }
  const action = (
    body.action === "recipients" ||
    body.action === "test" ||
    body.action === "send" ||
    body.action === "update_recipients"
      ? body.action
      : "preview"
  ) as CampaignAction;
  try {
    if (action === "recipients") return await previewRecipients(auth.eventRoles!, body);
    if (action === "preview") {
      return await previewCampaign(auth.userId!, auth.userEmail!, auth.eventRoles!, body, attachments);
    }
    if (action === "update_recipients") {
      return await updateCampaignRecipients(
        auth.userId!,
        auth.userEmail!,
        auth.eventRoles!,
        String(body.campaignId ?? ""),
        body.selectedRecipientKeys ?? body.selectedParticipantIds
      );
    }
    return await deliverCampaign(auth.userId!, auth.userEmail!, auth.eventRoles!, String(body.campaignId ?? ""), action);
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Operazione email non riuscita.", 400);
  }
}

async function requireCampaignManager() {
  const supabase = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(supabase, "manager");
  if (!auth?.user.email) return { response: error("Accesso non autorizzato.", 401) };
  const canSend = auth.eventRoles.some((role) => role.role === "admin" || role.role === "manager");
  if (!canSend) return { response: error("Il ruolo manager viewer non può inviare comunicazioni.", 403) };
  return {
    response: null,
    userId: auth.user.id,
    userEmail: auth.user.email,
    eventRoles: auth.eventRoles,
  };
}

async function previewRecipients(eventRoles: EventUserRole[], body: Record<string, unknown>) {
  const service = createSupabaseServiceClient();
  const event = await getCurrentOperationalEvent(service, "id");
  if (!event) throw new Error("Nessun evento corrente configurato.");
  assertCanManageCampaignEvent(eventRoles, event.id);
  const filters = campaignFilters(body);
  const recipients = await resolveCampaignRecipients(event.id, filters);
  if (!recipients.length) throw new Error("I filtri non individuano destinatari raggiungibili.");
  const selectedIds = new Set<string>();
  const recipientPreviews = await loadCampaignRecipientPreviews(
    recipients,
    selectedIds,
    event.id
  );
  return NextResponse.json({
    ...recipientSelectionSummary(recipientPreviews),
    recipients: recipientPreviews,
  });
}

async function previewCampaign(
  userId: string,
  testEmail: string,
  eventRoles: EventUserRole[],
  body: Record<string, unknown>,
  attachments: IncomingAttachment[]
) {
  const service = createSupabaseServiceClient();
  const event = await getCurrentOperationalEvent(service, "id,title");
  if (!event) throw new Error("Nessun evento corrente configurato.");
  assertCanManageCampaignEvent(eventRoles, event.id);
  const name = clean(body.name, 120);
  const subject = clean(body.subject, 180);
  const message = clean(body.message, 20000);
  if (!name || !subject || !message) throw new Error("Nome, oggetto e messaggio sono obbligatori.");
  const invalidTokens = validateCampaignTemplate(subject, message);
  if (invalidTokens.length) throw new Error(`Variabili non supportate: ${invalidTokens.join(", ")}.`);
  validateIncomingAttachments(attachments);
  const filters = campaignFilters(body);
  const recipients = await resolveCampaignRecipients(event.id, filters);
  if (!recipients.length) throw new Error("I filtri non individuano destinatari raggiungibili.");
  const selectedValue = parseJsonStringArray(
    body.selectedRecipientKeys ?? body.selectedParticipantIds
  );
  const selectedIds = resolveSelectedCampaignRecipientIds(
    recipients.map((recipient) => recipient.recipientKey),
    selectedValue
  );
  const selectionOrder = new Map(
    [...selectedIds].map((recipientKey, index) => [recipientKey, index + 1])
  );
  const templateId = clean(body.templateId, 80) || null;
  let templateVersion: number | null = null;
  if (templateId) {
    const { data } = await service.from("email_templates").select("current_version,event_id").eq("id", templateId).eq("event_id", event.id).maybeSingle();
    templateVersion = data?.current_version ?? null;
  }
  const { data: campaign, error: campaignError } = await service.from("email_campaigns").insert({
    event_id: event.id, template_id: templateId, template_version: templateVersion, name,
    subject_template: subject, body_template: message, filters_snapshot: filters,
    recipient_count: selectedIds.size, status: "draft", created_by: userId,
  }).select("id").single();
  if (campaignError || !campaign) throw new Error(campaignError?.message ?? "Impossibile creare l'anteprima.");
  const { error: recipientsError } = await service
    .from("email_campaign_recipients")
    .insert(
      recipients.map((recipient) => ({
        campaign_id: campaign.id,
        recipient_key: recipient.recipientKey,
        recipient_type: recipient.recipientType,
        participant_id: recipient.participantId,
        registration_id: recipient.registrationId,
        recipient_user_id: recipient.recipientUserId,
        delivery_kind: recipient.deliveryKind,
        delivery_order: selectionOrder.get(recipient.recipientKey) ?? null,
        delegate_user_id: recipient.delegateUserId,
        school_teacher_id: recipient.schoolTeacherId,
        status: selectedIds.has(recipient.recipientKey) ? "pending" : "skipped",
      }))
    );
  if (recipientsError) { await service.from("email_campaigns").delete().eq("id", campaign.id); throw new Error(recipientsError.message); }
  try {
    await persistCampaignAttachments(service, event.id, campaign.id, attachments);
  } catch (cause) {
    await service.from("email_campaigns").delete().eq("id", campaign.id);
    throw cause;
  }
  const selectedSample = recipients.find((recipient) =>
    selectedIds.has(recipient.recipientKey)
  );
  if (!selectedSample) throw new Error("Seleziona almeno un destinatario.");
  const sample = await loadCampaignDeliveryData(
    service,
    event.id,
    event.title,
    selectedSample
  );
  const recipientPreviews = await loadCampaignRecipientPreviews(
    recipients,
    selectedIds,
    event.id
  );
  await service.from("audit_logs").insert({ event_id: event.id, actor_user_id: userId, action: "email_campaign.preview_created", entity_table: "email_campaigns", entity_id: campaign.id, metadata: { recipient_count: selectedIds.size, filters, attachment_count: attachments.length } });
  return NextResponse.json({
    campaignId: campaign.id,
    ...recipientSelectionSummary(recipientPreviews),
    testRecipientEmail: testEmail,
    sampleRecipientName: `${sample.templateData.firstName} ${sample.templateData.lastName}`.trim(),
    previewSubject: renderCampaignTemplate(subject, sample.templateData),
    previewHtml: renderSafeCampaignHtml(message, sample.templateData),
    recipients: recipientPreviews,
    attachments: attachments.map((attachment) => ({
      fileName: attachment.file.name,
      contentType: attachment.file.type,
      sizeBytes: attachment.file.size,
      inline: attachment.inline,
    })),
  });
}

async function updateCampaignRecipients(
  userId: string,
  testEmail: string,
  eventRoles: EventUserRole[],
  campaignId: string,
  selectedValue: unknown
) {
  const selectedRecipientKeys = Array.isArray(selectedValue)
    ? [...new Set(selectedValue.filter((value): value is string => typeof value === "string" && value.length > 0))]
    : [];
  if (!selectedRecipientKeys.length) throw new Error("Seleziona almeno un destinatario.");

  const service = createSupabaseServiceClient();
  const event = await getCurrentOperationalEvent(service, "id,title");
  if (!event) throw new Error("Nessun evento corrente configurato.");
  assertCanManageCampaignEvent(eventRoles, event.id);
  const { data: campaign } = await service
    .from("email_campaigns")
    .select("id,event_id,status,subject_template,body_template")
    .eq("id", campaignId)
    .eq("event_id", event.id)
    .maybeSingle();
  if (!campaign || !["draft", "ready"].includes(campaign.status)) {
    throw new Error("La lista destinatari non è più modificabile.");
  }

  const { data: rows, error: rowsError } = await service
    .from("email_campaign_recipients")
    .select("recipient_key,recipient_type,participant_id,registration_id,recipient_user_id,delivery_kind,delegate_user_id,school_teacher_id")
    .eq("campaign_id", campaignId);
  if (rowsError) throw new Error(rowsError.message);

  const recipients = (rows ?? []).map<Recipient>((row) => ({
    recipientKey: row.recipient_key,
    recipientType: row.recipient_type,
    participantId: row.participant_id,
    registrationId: row.registration_id,
    recipientUserId: row.recipient_user_id,
    deliveryKind: row.delivery_kind as Recipient["deliveryKind"],
    delegateUserId: row.delegate_user_id,
    schoolTeacherId: row.school_teacher_id,
  }));
  const availableIds = new Set(recipients.map((recipient) => recipient.recipientKey));
  const selectedIds = new Set(selectedRecipientKeys.filter((id) => availableIds.has(id)));
  if (!selectedIds.size) throw new Error("Seleziona almeno un destinatario valido.");

  const includedIds = [...selectedIds];
  const excludedIds = [...availableIds].filter((id) => !selectedIds.has(id));
  const { error: includedError } = await service
    .from("email_campaign_recipients")
    .update({ status: "pending", error_code: null })
    .eq("campaign_id", campaignId)
    .in("recipient_key", includedIds);
  if (includedError) throw new Error(includedError.message);
  if (excludedIds.length) {
    const { error: excludedError } = await service
      .from("email_campaign_recipients")
      .update({ status: "skipped", error_code: null })
      .eq("campaign_id", campaignId)
      .in("recipient_key", excludedIds);
    if (excludedError) throw new Error(excludedError.message);
  }

  const { error: campaignError } = await service
    .from("email_campaigns")
    .update({
      recipient_count: selectedIds.size,
      status: "draft",
      test_sent_at: null,
      test_sent_to_user_id: null,
    })
    .eq("id", campaignId);
  if (campaignError) throw new Error(campaignError.message);

  const recipientPreviews = await loadCampaignRecipientPreviews(
    recipients,
    selectedIds,
    event.id
  );
  const selectedSample = recipients.find((recipient) =>
    selectedIds.has(recipient.recipientKey)
  );
  if (!selectedSample) throw new Error("Seleziona almeno un destinatario valido.");
  const sample = await loadCampaignDeliveryData(
    service,
    event.id,
    event.title,
    selectedSample
  );
  await audit(service, event.id, userId, campaignId, "email_campaign.recipients_updated", {
    recipient_count: selectedIds.size,
    excluded_count: excludedIds.length,
  });
  return NextResponse.json({
    campaignId,
    ...recipientSelectionSummary(recipientPreviews),
    testRecipientEmail: testEmail,
    sampleRecipientName: `${sample.templateData.firstName} ${sample.templateData.lastName}`.trim(),
    previewSubject: renderCampaignTemplate(campaign.subject_template, sample.templateData),
    previewHtml: renderSafeCampaignHtml(campaign.body_template, sample.templateData),
    recipients: recipientPreviews,
  });
}

async function deliverCampaign(userId: string, testEmail: string, eventRoles: EventUserRole[], campaignId: string, action: "test" | "send") {
  const service = createSupabaseServiceClient();
  const { data: campaign } = await service.from("email_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (!campaign || !["draft", "ready", "partial"].includes(campaign.status)) {
    throw new Error("Campagna non disponibile o già inviata.");
  }
  assertCanManageCampaignEvent(eventRoles, campaign.event_id);
  const { data: recipientRows } = await service
    .from("email_campaign_recipients")
    .select(
      "id,campaign_id,recipient_key,recipient_type,participant_id,registration_id,recipient_user_id,delivery_kind,delegate_user_id,school_teacher_id,status"
    )
    .eq("campaign_id", campaignId)
    .eq("status", "pending");
  const recipients = (recipientRows ?? []).map((row) =>
    campaignRecipientFromDatabaseRow({
      ...row,
      recipient_type: row.recipient_type,
      delivery_kind: row.delivery_kind,
    })
  );
  if (!recipients.length) throw new Error("Non ci sono destinatari in attesa.");
  const { data: event } = await service
    .from("events")
    .select("id,title")
    .eq("id", campaign.event_id)
    .single();
  const sample = await loadCampaignDeliveryData(
    service,
    campaign.event_id,
    event?.title ?? "Evento",
    recipients[0]
  );
  const attachments = await loadCampaignAttachments(service, campaignId);
  if (action === "test") {
    const html = appendInlineImages(
      renderSafeCampaignHtml(campaign.body_template, sample.templateData),
      attachments
    );
    const result = await sendTransactionalEmail({
      to: testEmail,
      subject: `[TEST] ${renderCampaignTemplate(campaign.subject_template, sample.templateData)}`,
      text: campaignHtmlToText(html),
      html,
      attachments: attachments.map(emailAttachmentInput),
    });
    await service.from("email_campaigns").update({ test_sent_at: new Date().toISOString(), test_sent_to_user_id: userId, status: "ready" }).eq("id", campaignId);
    await audit(service, campaign.event_id, userId, campaignId, "email_campaign.test_sent", { delivery_mode: process.env.EMAIL_DELIVERY_MODE === "log" ? "log" : "smtp" });
    return NextResponse.json({ ok: true, messageId: result.messageId });
  }
  if (!campaign.test_sent_at) throw new Error("Prima dell'invio definitivo è obbligatorio inviare il test.");
  const { data: claimed } = await service
    .from("email_campaigns")
    .update({ status: "sending" })
    .eq("id", campaignId)
    .eq("status", campaign.status)
    .select("id");
  if (!claimed?.length) throw new Error("La campagna è già stata presa in carico da un altro invio.");
  let reservation;
  try {
    reservation = await reserveCampaignDeliverySchedule(campaignId);
  } catch (cause) {
    await service
      .from("email_campaigns")
      .update({ status: campaign.status })
      .eq("id", campaignId)
      .eq("status", "sending");
    throw cause;
  }
  const result = await processDueCampaignDeliveries({
    campaignId,
    actorUserId: userId,
  });
  await audit(service, campaign.event_id, userId, campaignId, "email_campaign.queued", {
    recipient_count: campaign.recipient_count,
    scheduled_today: reservation.scheduledToday,
    scheduled_later: reservation.scheduledLater,
    last_scheduled_for: reservation.lastScheduledFor,
  });
  return NextResponse.json({
    ...result,
    scheduledLater: reservation.scheduledLater,
    lastScheduledFor: reservation.lastScheduledFor,
  });
}

function recipientSelectionSummary(recipients: RecipientPreview[]) {
  const selected = recipients.filter((recipient) => recipient.selected);
  return {
    recipientCount: selected.length,
    directCount: selected.filter((recipient) => recipient.deliveryKind === "direct").length,
    delegatedCount: selected.filter((recipient) => recipient.deliveryKind === "delegated").length,
    leaderCount: selected.filter((recipient) => recipient.deliveryKind === "leader").length,
    teacherCount: selected.filter((recipient) => recipient.deliveryKind === "teacher").length,
  };
}

function campaignFilters(body: Record<string, unknown>) {
  return {
    groupId: clean(body.groupId, 80) || null,
    tagId: clean(body.tagId, 80) || null,
    serviceId: clean(body.serviceId, 80) || null,
    status: clean(body.status, 30) || "active",
    audience: body.audience === "group_leaders"
      ? "group_leaders" as const
      : body.audience === "teachers"
        ? "teachers" as const
        : "participants" as const,
    panelId: clean(body.panelId, 80) || null,
    schoolName: clean(body.schoolName, 180) || null,
  };
}

function parseJsonStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function assertCanManageCampaignEvent(eventRoles: EventUserRole[], eventId: string) {
  const canManage = eventRoles.some(
    (role) => role.role === "admin" || (role.role === "manager" && role.eventId === eventId)
  );
  if (!canManage) {
    throw new Error("Non puoi gestire le campagne di questo evento.");
  }
}

function parseIncomingAttachments(formData: FormData) {
  const inlineIndexes = new Set(parseJsonStringArray(formData.get("inlineAttachmentIndexes")));
  return formData
    .getAll("attachments")
    .filter((value): value is File => value instanceof File && value.size > 0)
    .map((file, index) => ({ file, inline: inlineIndexes.has(String(index)) }));
}

function validateIncomingAttachments(attachments: IncomingAttachment[]) {
  if (attachments.length > MAX_ATTACHMENTS) {
    throw new Error(`Puoi allegare al massimo ${MAX_ATTACHMENTS} file.`);
  }
  const totalBytes = attachments.reduce((sum, attachment) => sum + attachment.file.size, 0);
  if (totalBytes > MAX_ATTACHMENTS_TOTAL_BYTES) {
    throw new Error("Gli allegati non possono superare complessivamente 10 MB.");
  }
  for (const attachment of attachments) {
    if (attachment.file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Il file ${attachment.file.name} supera il limite di 5 MB.`);
    }
    if (!ALLOWED_ATTACHMENT_TYPES.has(attachment.file.type)) {
      throw new Error(`Il tipo di file di ${attachment.file.name} non è supportato.`);
    }
    if (attachment.inline && !INLINE_IMAGE_TYPES.has(attachment.file.type)) {
      throw new Error(`Solo le immagini possono essere mostrate nel corpo del messaggio.`);
    }
  }
}

async function persistCampaignAttachments(
  service: ReturnType<typeof createSupabaseServiceClient>,
  eventId: string,
  campaignId: string,
  attachments: IncomingAttachment[]
) {
  if (!attachments.length) return;
  const uploadedPaths: string[] = [];
  try {
    const rows = [];
    for (const [index, attachment] of attachments.entries()) {
      const safeName = attachment.file.name
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120) || `allegato-${index + 1}`;
      const storagePath = `${eventId}/${campaignId}/${randomUUID()}-${safeName}`;
      const content = Buffer.from(await attachment.file.arrayBuffer());
      const { error: uploadError } = await service.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(storagePath, content, {
          contentType: attachment.file.type,
          upsert: false,
        });
      if (uploadError) throw new Error(uploadError.message);
      uploadedPaths.push(storagePath);
      rows.push({
        campaign_id: campaignId,
        file_name: attachment.file.name.slice(0, 180),
        content_type: attachment.file.type,
        size_bytes: attachment.file.size,
        storage_path: storagePath,
        is_inline: attachment.inline,
        content_id: attachment.inline ? `campaign-image-${campaignId}-${index}@santegidio.org` : null,
      });
    }
    const { error: insertError } = await service
      .from("email_campaign_attachments")
      .insert(rows);
    if (insertError) throw new Error(insertError.message);
  } catch (cause) {
    if (uploadedPaths.length) {
      await service.storage.from(ATTACHMENTS_BUCKET).remove(uploadedPaths);
    }
    throw cause;
  }
}

async function audit(service: ReturnType<typeof createSupabaseServiceClient>, eventId: string, userId: string, campaignId: string, action: string, metadata: Record<string, unknown>) { await service.from("audit_logs").insert({ event_id: eventId, actor_user_id: userId, action, entity_table: "email_campaigns", entity_id: campaignId, metadata }); }
function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function error(message: string, status: number) { return NextResponse.json({ error: message }, { status }); }
