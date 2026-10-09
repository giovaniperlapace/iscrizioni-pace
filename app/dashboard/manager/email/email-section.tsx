import { isPanelCampaign } from "@/lib/panels/management-access";
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
  initialPanelId,
  allowPanelManagement = false,
}: {
  eventId: string | null;
  canManage: boolean;
  initialPanelId?: string | null;
  allowPanelManagement?: boolean;
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
    { data: panels },
    { data: locations },
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
    allowPanelManagement ? loadAllRows((from, to) => service
      .from("event_moments")
      .select("id,title,starts_at,location_id")
      .eq("event_id", eventId)
      .eq("moment_type", "panel")
      .eq("publication_status", "published")
      .order("starts_at").order("id").range(from, to)) : Promise.resolve({ data: [] }),
    allowPanelManagement ? loadAllRows((from, to) => service
      .from("event_locations")
      .select("id,name")
      .eq("event_id", eventId).order("id").range(from, to)) : Promise.resolve({ data: [] }),
    loadAllRows((from, to) => service
      .from("email_templates")
      .select("id,name,subject,body_text,current_version")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }).order("id").range(from, to)),
    service
      .from("email_campaigns")
      .select("id,name,status,recipient_count,sent_at,created_at,filters_snapshot,subject_template,body_template")
      .eq("event_id", eventId)
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(8),
    loadDeliveryControl(service),
  ]);
  const [participantCandidates, groupLeaderCandidates, teacherCandidates] = await Promise.all([
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
    allowPanelManagement ? resolveCampaignRecipients(eventId, {
      audience: "teachers",
      groupId: null,
      tagId: null,
      serviceId: null,
      status: "active",
    }) : Promise.resolve([]),
  ]);
  const initialRecipients = await loadCampaignRecipientPreviews(
    [...participantCandidates, ...groupLeaderCandidates, ...teacherCandidates],
    new Set(),
    eventId,
    allowPanelManagement
  );
  const locationNameById = new Map(
    (locations ?? []).map((location) => [location.id, location.name])
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
      allowPanelManagement={allowPanelManagement}
      groups={(groups ?? []).map((row) => ({ id: row.id, label: row.name }))}
      tags={(tags ?? []).map((row) => ({ id: row.id, label: row.label }))}
      services={(eventServices ?? []).map((row) => ({ id: row.id, label: row.label }))}
      panels={(panels ?? []).map((row) => ({
        id: row.id,
        label: [
          row.title,
          formatPanelSchedule(row.starts_at),
          row.location_id ? locationNameById.get(row.location_id) : null,
        ].filter(Boolean).join(" · "),
      }))}
      initialPanelId={allowPanelManagement ? initialPanelId : null}
      initialRecipients={initialRecipients}
      templates={(templates ?? []).filter(row => allowPanelManagement || !isPanelCampaign({ subject: row.subject, message: row.body_text })).map((row) => ({
        id: row.id,
        name: row.name,
        subject: row.subject,
        bodyText: row.body_text,
        version: row.current_version,
      }))}
      campaigns={(campaigns ?? []).filter(row => allowPanelManagement || !isPanelCampaign({ ...row.filters_snapshot, subject_template: row.subject_template, body_template: row.body_template })).map((row) => ({
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

function formatPanelSchedule(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function loadDeliveryControl(service: ReturnType<typeof createSupabaseServiceClient>) {
  const result = await service.from("email_campaign_delivery_control")
    .select("blocked,paused_until").eq("id", true).single();
  return { ...result, paused: Boolean(result.data && Date.parse(result.data.paused_until) > Date.now()) };
}
