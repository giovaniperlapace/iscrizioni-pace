import { loadAllRows } from "@/lib/supabase/all-rows";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  loadCampaignRecipientPreviews,
  resolveCampaignRecipients,
} from "@/lib/email/campaign-recipients.server";
import { EmailCampaignComposer } from "./email-campaign-composer";

export async function ManagerEmailSection({
  eventId,
  canManage,
}: {
  eventId: string | null;
  canManage: boolean;
}) {
  if (!eventId) {
    return <section className="surface-card p-5">Nessun evento corrente.</section>;
  }

  if (!canManage) {
    return (
      <section className="surface-card p-5">
        <h2 className="text-xl font-bold">Comunicazioni</h2>
        <p className="mt-2 text-sm text-[var(--peace-muted)]">
          Questa sezione è disponibile in sola consultazione, ma l’invio di
          campagne richiede il ruolo manager.
        </p>
      </section>
    );
  }

  const service = createSupabaseServiceClient();
  const [
    { data: groups },
    { data: tags },
    { data: eventServices },
    { data: templates },
    { data: campaigns },
    deliveryControl,
  ] = await Promise.all([
    loadAllRows((from, to) => service
      .from("groups")
      .select("id,name")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("name").order("id").range(from, to)),
    loadAllRows((from, to) => service
      .from("operational_tags")
      .select("id,label")
      .eq("event_id", eventId)
      .order("label").order("id").range(from, to)),
    loadAllRows((from, to) => service
      .from("event_services")
      .select("id,label")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("public_order")
      .order("label").order("id").range(from, to)),
    loadAllRows((from, to) => service
      .from("email_templates")
      .select("id,name,subject,body_text,current_version")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }).order("id").range(from, to)),
    service
      .from("email_campaigns")
      .select("id,name,status,recipient_count,sent_at,created_at")
      .eq("event_id", eventId)
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(8),
    loadDeliveryControl(service),
  ]);
  const [participantCandidates, groupLeaderCandidates] = await Promise.all([
    resolveCampaignRecipients(eventId, {
      audience: "participants",
      groupId: null,
      tagId: null,
      serviceId: null,
      status: "active",
    }),
    resolveCampaignRecipients(eventId, {
      audience: "group_leaders",
      groupId: null,
      tagId: null,
      serviceId: null,
      status: "active",
    }),
  ]);
  const initialRecipients = await loadCampaignRecipientPreviews(
    [...participantCandidates, ...groupLeaderCandidates],
    new Set(),
    eventId
  );

  return (
    <>
    {deliveryControl.error ? (
      <p role="alert" className="status-error mb-4 rounded-lg p-4">Non è possibile verificare lo stato della coda email. Riprova tra poco.</p>
    ) : deliveryControl.data?.blocked ? (
      <p role="alert" className="status-error mb-4 rounded-lg p-4">L’invio delle campagne è sospeso. Contatta l’amministratore per verificare il servizio email e riattivare la coda. I messaggi in attesa sono conservati.</p>
    ) : deliveryControl.paused ? (
      <p role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">Il servizio email è temporaneamente in pausa. L’invio dei messaggi in attesa riprenderà automaticamente. Gli esiti da verificare non saranno reinviati.</p>
    ) : null}
    <EmailCampaignComposer
      groups={(groups ?? []).map((row) => ({ id: row.id, label: row.name }))}
      tags={(tags ?? []).map((row) => ({ id: row.id, label: row.label }))}
      services={(eventServices ?? []).map((row) => ({ id: row.id, label: row.label }))}
      initialRecipients={initialRecipients}
      templates={(templates ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        bodyText: row.body_text,
        version: row.current_version,
      }))}
      campaigns={(campaigns ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        status: row.status,
        recipientCount: row.recipient_count,
        date: row.sent_at ?? row.created_at,
      }))}
    />
    </>
  );
}

async function loadDeliveryControl(service: ReturnType<typeof createSupabaseServiceClient>) {
  const result = await service.from("email_campaign_delivery_control")
    .select("blocked,paused_until").eq("id", true).single();
  return { ...result, paused: Boolean(result.data && Date.parse(result.data.paused_until) > Date.now()) };
}
