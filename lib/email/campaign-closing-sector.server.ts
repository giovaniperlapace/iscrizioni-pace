import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows } from "../supabase/all-rows.ts";
import { CLOSING_BADGE_LAYOUT, closingBadgeSector } from "../ceremonies/closing-badges.ts";
import type { CampaignRecipient } from "./campaign-recipients.server.ts";

export function campaignClosingSector(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (!closingBadgeSector(value)) throw new Error("Settore della cerimonia finale non valido.");
  return value as string;
}

/** Published adult nominations only; group quotas and draft selections are not tickets. */
export async function loadCampaignClosingAssignments(service: SupabaseClient, eventId: string, registrationId?: string) {
  const { data } = await loadAllRows((from, to) => {
    let query = service.from("ceremony_nominees")
      .select("id,registration_id,registrations!inner(event_id,status,deleted_at),ceremony_plans!inner(event_id,kind,state,layout_key),ceremony_allocations!inner(revoked_at,ceremony_quotas!inner(ceremony_sectors!inner(layout_code)))")
      .is("child_id", null).is("revoked_at", null)
      .eq("registrations.event_id", eventId).in("registrations.status", ["submitted", "confirmed"]).is("registrations.deleted_at", null)
      .eq("ceremony_plans.event_id", eventId).eq("ceremony_plans.kind", "closing")
      .eq("ceremony_plans.state", "validated").eq("ceremony_plans.layout_key", CLOSING_BADGE_LAYOUT)
      .is("ceremony_allocations.revoked_at", null);
    if (registrationId) query = query.eq("registration_id", registrationId);
    return query.order("id").range(from, to);
  });
  const assignments = new Map<string, string[]>();
  for (const row of data) {
    const allocation = one(row.ceremony_allocations);
    const quota = one(allocation?.ceremony_quotas);
    const sector = closingBadgeSector(one(quota?.ceremony_sectors)?.layout_code);
    if (!sector || !row.registration_id) throw new Error("Impossibile leggere i settori della cerimonia finale.");
    const codes = assignments.get(row.registration_id) ?? [];
    if (!codes.includes(sector.code)) codes.push(sector.code);
    assignments.set(row.registration_id, codes);
  }
  return assignments;
}

export async function filterCampaignClosingRecipients<T extends CampaignRecipient>(service: SupabaseClient, eventId: string, recipients: T[], value: unknown): Promise<T[]> {
  const code = campaignClosingSector(value);
  if (!code) return recipients;
  const assignments = await loadCampaignClosingAssignments(service, eventId);
  return recipients.filter(recipient => recipient.recipientType === "participant" && recipient.registrationId && assignments.get(recipient.registrationId)?.includes(code));
}

export class ClosingSectorChangedError extends Error {
  constructor() { super("Le assegnazioni della cerimonia finale sono cambiate. Aggiorna i destinatari prima di inviare."); }
}

export async function assertCampaignClosingRecipient(service: SupabaseClient, eventId: string, recipient: CampaignRecipient, snapshot: unknown) {
  const value = snapshot && typeof snapshot === "object" ? (snapshot as Record<string, unknown>).closingSector : null;
  const code = campaignClosingSector(value);
  if (!code) return;
  if (recipient.recipientType !== "participant" || !recipient.registrationId) throw new ClosingSectorChangedError();
  const assignments = await loadCampaignClosingAssignments(service, eventId, recipient.registrationId);
  if (!assignments.get(recipient.registrationId)?.includes(code)) throw new ClosingSectorChangedError();
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
