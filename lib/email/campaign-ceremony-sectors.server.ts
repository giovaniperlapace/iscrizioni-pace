import type { SupabaseClient } from "@supabase/supabase-js";

// Service-only read, after campaign event authorization and recipient eligibility.
// The nominee ledger includes both direct assignments and named group tickets.
export async function loadCampaignCeremonySectors(
  service: SupabaseClient,
  eventId: string,
  participantId: string,
  registrationId?: string,
): Promise<{ openingSector: string | null; closingSector: string | null }> {
  const empty = { openingSector: null, closingSector: null };
  let registration = service.from("registrations").select("id")
    .eq("event_id", eventId).eq("participant_id", participantId)
    .is("deleted_at", null).in("status", ["submitted", "confirmed"]);
  if (registrationId) registration = registration.eq("id", registrationId);
  const { data: current, error: registrationError } = await registration.maybeSingle();
  if (registrationError) throw new Error("Impossibile leggere l’iscrizione per i settori delle cerimonie.");
  if (!current) return empty;

  const { data, error } = await service.from("ceremony_nominees")
    .select("ceremony_plans!inner(kind,event_id,state),ceremony_allocations!inner(revoked_at,ceremony_quotas!inner(ceremony_sectors!inner(name)))")
    .eq("registration_id", current.id).is("child_id", null).is("revoked_at", null)
    .eq("ceremony_plans.event_id", eventId).eq("ceremony_plans.state", "validated")
    .is("ceremony_allocations.revoked_at", null);
  if (error || !data) throw new Error("Impossibile leggere i settori assegnati alle cerimonie.");
  const sectors = { opening: new Set<string>(), closing: new Set<string>() };
  for (const row of data) {
    const plan = one(row.ceremony_plans);
    const allocation = one(row.ceremony_allocations);
    const quota = one(allocation?.ceremony_quotas);
    const sector = one(quota?.ceremony_sectors);
    if (!plan || !sector?.name || !["opening", "closing"].includes(plan.kind)) {
      throw new Error("Settore della cerimonia non disponibile.");
    }
    sectors[plan.kind as "opening" | "closing"].add(sector.name);
  }
  return {
    openingSector: [...sectors.opening].sort().join(", ") || null,
    closingSector: [...sectors.closing].sort().join(", ") || null,
  };
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
