import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAllRows, loadRowsForIds } from "../supabase/all-rows.ts";

type Registration = { id: string; participant_id: string; source: string; created_by: string | null; deleted_at: string | null; status: string };
type Contact = { participant_id: string; email: string | null };
type Snapshot = { registration_id: string; answers: unknown };
type Profile = { id: string; email: string | null };

/** Read-only preflight. Missing provenance and ambiguous addresses require review. */
export function selectAccountAccessCandidates(input: {
  registrations: Registration[];
  contacts: Contact[];
  snapshots: Snapshot[];
  creators: Profile[];
  sentRegistrationIds: string[];
}) {
  const email = (value: string | null) => value?.trim().toLowerCase() ?? "";
  const contacts = new Map<string, Set<string>>();
  const owners = new Map<string, Set<string>>();
  for (const row of input.contacts) {
    const address = email(row.email);
    if (!address) continue;
    contacts.set(row.participant_id, (contacts.get(row.participant_id) ?? new Set()).add(address));
    owners.set(address, (owners.get(address) ?? new Set()).add(row.participant_id));
  }
  const creators = new Map(input.creators.map(row => [row.id, email(row.email)]));
  const snapshots = new Map<string, unknown[]>();
  for (const row of input.snapshots) snapshots.set(row.registration_id, [...(snapshots.get(row.registration_id) ?? []), row.answers]);
  const sent = new Set(input.sentRegistrationIds);
  const candidates: Array<{ registrationId: string; participantId: string; email: string }> = [];
  const excluded: Record<string, number> = {};
  for (const row of input.registrations.filter(row => row.source === "capogruppo")) {
    let reason: string | null = null;
    const answers = snapshots.get(row.id);
    const snapshot = answers?.length === 1 ? answers[0] : null;
    const contact = snapshot && typeof snapshot === "object" && "contact" in snapshot ? snapshot.contact : null;
    const addresses = [...(contacts.get(row.participant_id) ?? [])];
    const address = addresses[0] ?? "";
    if (row.deleted_at || row.status === "cancelled") reason = "inactive";
    else if (contact && typeof contact === "object" && "useLeaderEmail" in contact && contact.useLeaderEmail === true) reason = "delegated";
    else if (!contact || typeof contact !== "object" || !("hasEmail" in contact) || contact.hasEmail !== true) reason = "provenance_to_review";
    else if (addresses.length !== 1 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) reason = "missing_or_ambiguous_email";
    else if (!row.created_by || !creators.get(row.created_by)) reason = "creator_to_review";
    else if (address === creators.get(row.created_by)) reason = "leader_email";
    else if ((owners.get(address)?.size ?? 0) > 1) reason = "shared_email";
    else if (sent.has(row.id)) reason = "already_notified";
    if (reason) excluded[reason] = (excluded[reason] ?? 0) + 1;
    else candidates.push({ registrationId: row.id, participantId: row.participant_id, email: address });
  }
  return { candidates, excluded };
}

export async function loadAccountAccessCandidates(db: SupabaseClient, eventId: string) {
  const { data: registrations } = await loadAllRows<Registration>((from, to) => db.from("registrations")
    .select("id,participant_id,source,created_by,deleted_at,status").eq("event_id", eventId).order("id").range(from, to));
  const manual = registrations.filter(row => row.source === "capogruppo");
  const results = await Promise.all([
    // Include archived registrations in the address ambiguity check.
    loadRowsForIds<Contact>(registrations.map(row => row.participant_id), (ids, from, to) => db.from("participant_contacts")
      .select("participant_id,email").in("participant_id", ids).order("id").range(from, to)),
    loadRowsForIds<Snapshot>(manual.map(row => row.id), (ids, from, to) => db.from("registration_questionnaire_answers")
      .select("registration_id,answers").eq("event_id", eventId).in("registration_id", ids).order("id").range(from, to)),
    loadRowsForIds<Profile>(manual.flatMap(row => row.created_by ? [row.created_by] : []), (ids, from, to) => db.from("profiles")
      .select("id,email").in("id", ids).order("id").range(from, to)),
    loadAllRows<{ entity_id: string }>((from, to) => db.from("audit_logs").select("entity_id")
      .eq("event_id", eventId).eq("entity_table", "registrations").eq("action", "email.account_access_sent").order("id").range(from, to)),
  ]);
  return selectAccountAccessCandidates({ registrations, contacts: results[0].data, snapshots: results[1].data,
    creators: results[2].data, sentRegistrationIds: results[3].data.map(row => row.entity_id) });
}
