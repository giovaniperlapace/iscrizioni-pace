import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getCurrentOperationalEvent } from "@/lib/events/current";
import {
  canAccessPanelManagement,
  isPanelCampaign,
} from "@/lib/panels/management-access";
import { loadAllRows, loadRowsForIds } from "@/lib/supabase/all-rows";
import {
  campaignRecipientFromDatabaseRow,
  loadCampaignDeliveryData,
} from "@/lib/email/campaign-delivery.server";
import { loadCampaignRecipientPreviews } from "@/lib/email/campaign-recipients.server";
import {
  emailHash,
  reportOutcome,
  type DeliveryEvent,
} from "./campaign-report";
import { readSuppressedAddresses } from "./postmark-reporting";
export async function reportAccess() {
  const auth = await getCurrentAuthContext(
    await createSupabaseServerClient(),
    "manager",
  );
  if (!auth) throw new Error("Accesso non autorizzato.");
  const service = createSupabaseServiceClient();
  const event = await getCurrentOperationalEvent(service, "id,title");
  if (
    !event ||
    !auth.eventRoles.some(
      (r) =>
        r.role === "admin" || (r.role === "manager" && r.eventId === event.id),
    )
  )
    throw new Error("Accesso non consentito.");
  return {
    service,
    event,
    auth,
    panels: canAccessPanelManagement(auth.eventRoles, event.id),
  };
}
export async function reportCampaign(
  ctx: Awaited<ReturnType<typeof reportAccess>>,
  id: string,
) {
  const { data: c, error } = await ctx.service
    .from("email_campaigns")
    .select("*")
    .eq("id", id)
    .eq("event_id", ctx.event.id)
    .maybeSingle();
  if (
    error ||
    !c ||
    (!ctx.panels &&
      isPanelCampaign({
        ...c.filters_snapshot,
        subject_template: c.subject_template,
        body_template: c.body_template,
      }))
  )
    throw new Error("Campagna non disponibile.");
  return c;
}
export async function campaignReport(
  ctx: Awaited<ReturnType<typeof reportAccess>>,
  id: string,
) {
  const campaign = await reportCampaign(ctx, id);
  const { data: rows, error } = await loadAllRows((from, to) =>
    ctx.service
      .from("email_campaign_recipients")
      .select("*")
      .eq("campaign_id", id)
      .order("delivery_order")
      .order("id")
      .range(from, to),
  );
  if (error) throw new Error("Report non disponibile.");
  if (!ctx.panels && rows.some((r) => r.recipient_type === "teacher"))
    throw new Error("Accesso forum non consentito.");
  const missing = rows.filter(
    (r) => !r.recipient_name_snapshot || !r.delivery_email_snapshot,
  );
  const previews = missing.length
    ? await loadCampaignRecipientPreviews(
        missing.map(campaignRecipientFromDatabaseRow),
        new Set(),
        ctx.event.id,
        ctx.panels,
      )
    : [];
  const byKey = new Map(previews.map((r) => [r.recipientKey, r]));
  const hashes = [
    ...new Set(
      rows.flatMap((r) =>
        r.provider_message_id ? [r.provider_message_id] : [],
      ),
    ),
  ];
  const [events, suppressions, links] = await Promise.all([
    loadRowsForIds(hashes, (ids, from, to) =>
      ctx.service
        .from("email_delivery_events")
        .select("message_hash,kind,occurred_at,detail,retryable")
        .in("message_hash", ids)
        .order("event_key")
        .range(from, to),
    ),
    loadRowsForIds(
      [
        ...new Set(
          rows.map((r) =>
            emailHash(
              r.delivery_email_snapshot ||
                byKey.get(r.recipient_key)?.destinationEmail ||
                "",
            ),
          ),
        ),
      ],
      (ids, from, to) =>
        ctx.service
          .from("email_delivery_suppressions")
          .select("email_hash,suppressed,reason,origin")
          .in("email_hash", ids)
          .order("email_hash")
          .range(from, to),
    ),
    loadRowsForIds(
      rows.map((r) => r.id),
      (ids, from, to) =>
        ctx.service
          .from("email_campaign_retry_links")
          .select("source_recipient_id,retry_campaign_id")
          .in("source_recipient_id", ids)
          .order("source_recipient_id")
          .range(from, to),
    ),
  ]);
  const grouped = new Map<string, DeliveryEvent[]>();
  for (const e of events.data) {
    const list = grouped.get(e.message_hash) || [];
    list.push(e as DeliveryEvent);
    grouped.set(e.message_hash, list);
  }
  const suppressed = new Map(
    suppressions.data.filter((s) => s.suppressed).map((s) => [s.email_hash, s]),
  );
  const retried = new Map(
    links.data.map((l) => [l.source_recipient_id, l.retry_campaign_id]),
  );
  const recipients = rows.map((r) => {
    const ev = (grouped.get(r.provider_message_id) || []).sort((a, b) =>
      b.occurred_at.localeCompare(a.occurred_at),
    );
    const outcome = reportOutcome(r, ev);
    const email =
      r.delivery_email_snapshot ||
      byKey.get(r.recipient_key)?.destinationEmail ||
      "";
    const block = suppressed.get(emailHash(email));
    const retryable = Boolean(
      r.delivery_email_snapshot &&
      !block &&
      !retried.has(r.id) &&
      !ev.some((e) => ["Delivery", "SpamComplaint"].includes(e.kind)) &&
      ((r.status === "failed" &&
        r.error_code === "delivery_failed") ||
        (r.status === "sent" &&
          ev.some((e) => e.kind === "Bounce" && e.retryable) &&
          !ev.some((e) => e.kind === "Bounce" && !e.retryable))),
    );
    return {
      id: r.id,
      name:
        r.recipient_name_snapshot ||
        byKey.get(r.recipient_key)?.fullName ||
        "Destinatario non più disponibile",
      email,
      snapshot: Boolean(r.delivery_email_snapshot),
      ...outcome,
      reason:
        outcome.code === "blocked" && block
          ? block.reason === "ManualSuppression" && block.origin === "Recipient"
            ? "Disiscrizione del destinatario"
            : block.reason
          : outcome.reason,
      sentAt: r.sent_at,
      deliveredAt: ev.find((e) => e.kind === "Delivery")?.occurred_at || null,
      retryable,
      retryCampaignId: retried.get(r.id) || null,
    };
  });
  const counts: Record<string, number> = {};
  for (const r of recipients) counts[r.code] = (counts[r.code] || 0) + 1;
  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      date: campaign.sent_at,
      status: campaign.status,
      parent: campaign.retry_of_campaign_id,
    },
    counts,
    recipients,
  };
}
export async function retryCampaign(
  ctx: Awaited<ReturnType<typeof reportAccess>>,
  id: string,
  ids: string[],
) {
  if (!ids.length || ids.length > 500 || new Set(ids).size !== ids.length)
    throw new Error("Selezione non valida.");
  const report = await campaignReport(ctx, id);
  const selected = report.recipients.filter((r) => ids.includes(r.id));
  if (selected.length !== ids.length) throw new Error("Selezione non valida.");
  // Idempotent retries of the identical confirmation return the existing recovery.
  if (
    selected.every((r) => r.retryCampaignId) &&
    new Set(selected.map((r) => r.retryCampaignId)).size === 1
  ) {
    const { data, error } = await ctx.service.rpc(
      "retry_email_campaign_recipients",
      { p_campaign_id: id, p_recipient_ids: ids, p_actor_id: ctx.auth.user.id },
    );
    if (error) throw new Error("Reinvio già avviato: aggiorna il report.");
    return data;
  }
  if (selected.some((r) => !r.retryable))
    throw new Error(
      "La selezione contiene esiti non reinviabili. Aggiorna il report.",
    );
  const suppressed = await readSuppressedAddresses(); // Fail closed when current provider status is unavailable.
  if (selected.some((r) => suppressed.has(emailHash(r.email))))
    throw new Error(
      "Un indirizzo è bloccato o disiscritto: non è stato avviato alcun reinvio.",
    );
  const { data: rows, error } = await loadAllRows((from, to) =>
    ctx.service
      .from("email_campaign_recipients")
      .select("*")
      .eq("campaign_id", id)
      .order("id")
      .range(from, to),
  );
  if (error) throw error;
  for (const row of rows.filter((r) => ids.includes(r.id))) {
    const current = await loadCampaignDeliveryData(
      ctx.service,
      ctx.event.id,
      ctx.event.title,
      campaignRecipientFromDatabaseRow(row),
      ctx.panels,
    );
    if (
      current.email.trim().toLowerCase() !==
      row.delivery_email_snapshot?.trim().toLowerCase()
    )
      throw new Error("Un indirizzo è cambiato: prepara una nuova campagna.");
  }
  const { data, error: retryError } = await ctx.service.rpc(
    "retry_email_campaign_recipients",
    { p_campaign_id: id, p_recipient_ids: ids, p_actor_id: ctx.auth.user.id },
  );
  if (retryError)
    throw new Error(
      "Reinvio non avviato: aggiorna il report e controlla la selezione.",
    );
  return data;
}
