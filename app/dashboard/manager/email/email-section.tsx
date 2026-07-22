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
  ] = await Promise.all([
    service
      .from("groups")
      .select("id,name")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("name"),
    service
      .from("operational_tags")
      .select("id,label")
      .eq("event_id", eventId)
      .order("label"),
    service
      .from("event_services")
      .select("id,label")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("public_order")
      .order("label"),
    service
      .from("email_templates")
      .select("id,name,subject,body_text,current_version")
      .eq("event_id", eventId)
      .eq("is_active", true)
      .order("updated_at", { ascending: false }),
    service
      .from("email_campaigns")
      .select("id,name,status,recipient_count,sent_at,created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const recipientCandidates = await resolveCampaignRecipients(eventId, {
    groupId: null,
    tagId: null,
    serviceId: null,
    status: "active",
  });
  const initialRecipients = await loadCampaignRecipientPreviews(
    recipientCandidates,
    new Set(recipientCandidates.map((recipient) => recipient.participantId))
  );

  return (
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
  );
}
