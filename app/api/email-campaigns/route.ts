import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { renderCampaignTemplate, validateCampaignTemplate } from "@/lib/email/campaign-templates";
import { campaignHtmlToText, renderSafeCampaignHtml } from "@/lib/email/campaign-html.server";
import { sendTransactionalEmail } from "@/lib/email/smtp";
import { getCurrentOperationalEvent } from "@/lib/events/current";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const MAX_RECIPIENTS = 100;
const SEND_CONCURRENCY = 3;

type CampaignAction = "preview" | "test" | "send";
type Recipient = { participantId: string; registrationId: string; deliveryKind: "direct" | "delegated"; delegateUserId: string | null };
type Person = { id: string; first_name: string; last_name: string; public_code: string | null };

export async function POST(request: Request) {
  const auth = await requireCampaignManager();
  if (auth.response) return auth.response;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return error("Richiesta non valida.", 400); }
  const action = (body.action === "test" || body.action === "send" ? body.action : "preview") as CampaignAction;
  try {
    if (action === "preview") return await previewCampaign(auth.userId!, body);
    return await deliverCampaign(auth.userId!, auth.userEmail!, String(body.campaignId ?? ""), action, String(body.confirmation ?? ""));
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
  return { response: null, userId: auth.user.id, userEmail: auth.user.email };
}

async function previewCampaign(userId: string, body: Record<string, unknown>) {
  const service = createSupabaseServiceClient();
  const event = await getCurrentOperationalEvent(service, "id,title");
  if (!event) throw new Error("Nessun evento corrente configurato.");
  const name = clean(body.name, 120);
  const subject = clean(body.subject, 180);
  const message = clean(body.message, 20000);
  if (!name || !subject || !message) throw new Error("Nome, oggetto e messaggio sono obbligatori.");
  const invalidTokens = validateCampaignTemplate(subject, message);
  if (invalidTokens.length) throw new Error(`Variabili non supportate: ${invalidTokens.join(", ")}.`);
  const filters = {
    groupId: clean(body.groupId, 80) || null,
    tagId: clean(body.tagId, 80) || null,
    status: clean(body.status, 30) || "active",
  };
  const recipients = await resolveRecipients(event.id, filters);
  if (!recipients.length) throw new Error("I filtri non individuano destinatari raggiungibili.");
  if (recipients.length > MAX_RECIPIENTS) throw new Error(`Il segmento contiene ${recipients.length} destinatari: il limite per campagna è ${MAX_RECIPIENTS}. Restringi i filtri.`);
  const templateId = clean(body.templateId, 80) || null;
  let templateVersion: number | null = null;
  if (templateId) {
    const { data } = await service.from("email_templates").select("current_version,event_id").eq("id", templateId).eq("event_id", event.id).maybeSingle();
    templateVersion = data?.current_version ?? null;
  }
  const { data: campaign, error: campaignError } = await service.from("email_campaigns").insert({
    event_id: event.id, template_id: templateId, template_version: templateVersion, name,
    subject_template: subject, body_template: message, filters_snapshot: filters,
    recipient_count: recipients.length, status: "draft", created_by: userId,
  }).select("id").single();
  if (campaignError || !campaign) throw new Error(campaignError?.message ?? "Impossibile creare l'anteprima.");
  const { error: recipientsError } = await service.from("email_campaign_recipients").insert(recipients.map((recipient) => ({
    campaign_id: campaign.id, participant_id: recipient.participantId, registration_id: recipient.registrationId,
    delivery_kind: recipient.deliveryKind, delegate_user_id: recipient.delegateUserId,
  })));
  if (recipientsError) { await service.from("email_campaigns").delete().eq("id", campaign.id); throw new Error(recipientsError.message); }
  const sample = await loadDeliveryData(event.title, recipients[0]);
  await service.from("audit_logs").insert({ event_id: event.id, actor_user_id: userId, action: "email_campaign.preview_created", entity_table: "email_campaigns", entity_id: campaign.id, metadata: { recipient_count: recipients.length, filters } });
  return NextResponse.json({ campaignId: campaign.id, recipientCount: recipients.length, directCount: recipients.filter((r) => r.deliveryKind === "direct").length, delegatedCount: recipients.filter((r) => r.deliveryKind === "delegated").length, confirmation: confirmationPhrase(recipients.length), previewSubject: renderCampaignTemplate(subject, sample.templateData), previewHtml: renderSafeCampaignHtml(message, sample.templateData) });
}

async function resolveRecipients(eventId: string, filters: { groupId: string | null; tagId: string | null; status: string }) {
  const service = createSupabaseServiceClient();
  let query = service.from("registrations").select("id,participant_id,status").eq("event_id", eventId).limit(1000);
  if (filters.status !== "all") query = filters.status === "active" ? query.neq("status", "cancelled") : query.eq("status", filters.status);
  const { data: registrations, error: registrationError } = await query;
  if (registrationError) throw new Error(registrationError.message);
  let allowed = new Set((registrations ?? []).map((row) => row.id));
  if (filters.groupId && allowed.size) {
    const { data } = await service.from("participant_group_assignments").select("registration_id").eq("group_id", filters.groupId).eq("is_current", true).in("registration_id", [...allowed]);
    allowed = new Set((data ?? []).map((row) => row.registration_id));
  }
  if (filters.tagId && allowed.size) {
    const participantIds = (registrations ?? []).filter((row) => allowed.has(row.id)).map((row) => row.participant_id);
    const { data } = await service.from("participant_operational_tags").select("participant_id").eq("tag_id", filters.tagId).in("participant_id", participantIds);
    const tagged = new Set((data ?? []).map((row) => row.participant_id));
    allowed = new Set((registrations ?? []).filter((row) => tagged.has(row.participant_id)).map((row) => row.id));
  }
  const selected = (registrations ?? []).filter((row) => allowed.has(row.id));
  if (!selected.length) return [];
  const participantIds = selected.map((row) => row.participant_id);
  const { data: contacts } = await service.from("participant_contacts").select("participant_id,email,is_primary").in("participant_id", participantIds).order("is_primary", { ascending: false });
  const direct = new Set((contacts ?? []).filter((row) => Boolean(row.email?.trim())).map((row) => row.participant_id));
  const missingIds = participantIds.filter((id) => !direct.has(id));
  const delegates = new Map<string, string>();
  if (missingIds.length) {
    const missingRegistrations = selected.filter((row) => missingIds.includes(row.participant_id));
    const { data: assignments } = await service.from("participant_group_assignments").select("registration_id,group_id").eq("is_current", true).in("registration_id", missingRegistrations.map((row) => row.id));
    const registrationParticipant = new Map(missingRegistrations.map((row) => [row.id, row.participant_id]));
    const groupParticipant = new Map((assignments ?? []).map((row) => [row.group_id, registrationParticipant.get(row.registration_id)!]));
    if (groupParticipant.size) {
      const { data: memberships } = await service.from("group_memberships").select("group_id,user_id,is_primary").eq("role", "capogruppo").in("group_id", [...groupParticipant.keys()]).order("is_primary", { ascending: false });
      const userIds = [...new Set((memberships ?? []).map((row) => row.user_id))];
      const { data: profiles } = userIds.length ? await service.from("profiles").select("id,email").in("id", userIds) : { data: [] };
      const validUsers = new Set((profiles ?? []).filter((row) => Boolean(row.email?.trim())).map((row) => row.id));
      for (const membership of memberships ?? []) { const participantId = groupParticipant.get(membership.group_id); if (participantId && validUsers.has(membership.user_id) && !delegates.has(participantId)) delegates.set(participantId, membership.user_id); }
    }
  }
  return selected.flatMap<Recipient>((row) => direct.has(row.participant_id) ? [{ participantId: row.participant_id, registrationId: row.id, deliveryKind: "direct", delegateUserId: null }] : delegates.has(row.participant_id) ? [{ participantId: row.participant_id, registrationId: row.id, deliveryKind: "delegated", delegateUserId: delegates.get(row.participant_id)! }] : []);
}

async function deliverCampaign(userId: string, testEmail: string, campaignId: string, action: "test" | "send", confirmation: string) {
  const service = createSupabaseServiceClient();
  const { data: campaign } = await service.from("email_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (!campaign || !["draft", "ready", "partial"].includes(campaign.status)) throw new Error("Campagna non disponibile o già inviata.");
  const { data: recipientRows } = await service.from("email_campaign_recipients").select("participant_id,registration_id,delivery_kind,delegate_user_id,status").eq("campaign_id", campaignId).eq("status", "pending");
  const recipients = (recipientRows ?? []).map((row) => ({ participantId: row.participant_id, registrationId: row.registration_id, deliveryKind: row.delivery_kind as "direct" | "delegated", delegateUserId: row.delegate_user_id }));
  if (!recipients.length) throw new Error("Non ci sono destinatari in attesa.");
  const { data: event } = await service.from("events").select("title").eq("id", campaign.event_id).single();
  const sample = await loadDeliveryData(event?.title ?? "Evento", recipients[0]);
  if (action === "test") {
    const html = renderSafeCampaignHtml(campaign.body_template, sample.templateData);
    const result = await sendTransactionalEmail({ to: testEmail, subject: `[TEST] ${renderCampaignTemplate(campaign.subject_template, sample.templateData)}`, text: campaignHtmlToText(html), html });
    await service.from("email_campaigns").update({ test_sent_at: new Date().toISOString(), test_sent_to_user_id: userId, status: "ready" }).eq("id", campaignId);
    await audit(service, campaign.event_id, userId, campaignId, "email_campaign.test_sent", { delivery_mode: process.env.EMAIL_DELIVERY_MODE === "log" ? "log" : "smtp" });
    return NextResponse.json({ ok: true, messageId: result.messageId });
  }
  if (!campaign.test_sent_at) throw new Error("Prima dell'invio definitivo è obbligatorio inviare il test.");
  if (confirmation !== confirmationPhrase(campaign.recipient_count)) throw new Error(`Digita esattamente: ${confirmationPhrase(campaign.recipient_count)}`);
  const { data: claimed } = await service.from("email_campaigns").update({ status: "sending" }).eq("id", campaignId).eq("status", campaign.status).select("id");
  if (!claimed?.length) throw new Error("La campagna è già stata presa in carico da un altro invio.");
  let sent = 0; let failed = 0;
  await runWithConcurrency(recipients, SEND_CONCURRENCY, async (recipient) => {
    try {
      const data = await loadDeliveryData(event?.title ?? "Evento", recipient);
      const html = renderSafeCampaignHtml(campaign.body_template, data.templateData);
      const result = await sendTransactionalEmail({ to: data.email, subject: renderCampaignTemplate(campaign.subject_template, data.templateData), text: campaignHtmlToText(html), html });
      await service.from("email_campaign_recipients").update({ status: "sent", provider_message_id: hashMessageId(result.messageId), sent_at: new Date().toISOString() }).eq("campaign_id", campaignId).eq("participant_id", recipient.participantId);
      sent++;
    } catch {
      await service.from("email_campaign_recipients").update({ status: "failed", error_code: "delivery_failed" }).eq("campaign_id", campaignId).eq("participant_id", recipient.participantId);
      failed++;
    }
  });
  const status = failed === 0 ? "completed" : sent === 0 ? "failed" : "partial";
  await service.from("email_campaigns").update({ status, sent_at: new Date().toISOString() }).eq("id", campaignId);
  await audit(service, campaign.event_id, userId, campaignId, "email_campaign.sent", { sent, failed, recipient_count: campaign.recipient_count });
  return NextResponse.json({ ok: true, sent, failed, status });
}

async function loadDeliveryData(eventTitle: string, recipient: Recipient) {
  const service = createSupabaseServiceClient();
  const { data: participant } = await service.from("participants").select("id,first_name,last_name,public_code").eq("id", recipient.participantId).single();
  const { data: assignment } = await service.from("participant_group_assignments").select("groups(name)").eq("registration_id", recipient.registrationId).eq("is_current", true).maybeSingle();
  const group = Array.isArray(assignment?.groups) ? assignment.groups[0] : assignment?.groups;
  let email: string | null = null;
  if (recipient.deliveryKind === "direct") { const { data } = await service.from("participant_contacts").select("email").eq("participant_id", recipient.participantId).not("email", "is", null).order("is_primary", { ascending: false }).limit(1).maybeSingle(); email = data?.email ?? null; }
  else if (recipient.delegateUserId) { const { data } = await service.from("profiles").select("email").eq("id", recipient.delegateUserId).maybeSingle(); email = data?.email ?? null; }
  if (!participant || !email) throw new Error("Destinatario non più raggiungibile.");
  const person = participant as Person;
  return { email, templateData: { firstName: person.first_name, lastName: person.last_name, participantCode: person.public_code, groupName: group?.name ?? null, eventTitle } };
}

async function audit(service: ReturnType<typeof createSupabaseServiceClient>, eventId: string, userId: string, campaignId: string, action: string, metadata: Record<string, unknown>) { await service.from("audit_logs").insert({ event_id: eventId, actor_user_id: userId, action, entity_table: "email_campaigns", entity_id: campaignId, metadata }); }
async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) { let index = 0; await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => { while (index < items.length) { const item = items[index++]; await worker(item); } })); }
function confirmationPhrase(count: number) { return `INVIA ${count} EMAIL`; }
function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function hashMessageId(value: string) { return createHash("sha256").update(value).digest("hex"); }
function error(message: string, status: number) { return NextResponse.json({ error: message }, { status }); }
