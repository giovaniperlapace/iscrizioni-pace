import type { SupabaseClient } from "@supabase/supabase-js";

export type RoleCandidate = { id: string; name: string; email: string; searchText?: string };

// Call only after verifying an effective admin/manager role. No operational
// membership is required for the target: this directory includes first roles.
export async function loadRoleCandidates(supabase: SupabaseClient, eventIds: string[] = []): Promise<RoleCandidate[]> {
  const candidates: RoleCandidate[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("profiles")
      .select("id,full_name,email").order("id").range(offset, offset + pageSize - 1);
    if (error) throw new Error("Impossibile caricare gli utenti esistenti.");
    for (const row of data ?? []) {
      if (row.email) candidates.push({ id: row.id, name: row.full_name || row.email, email: row.email });
    }
    if ((data ?? []).length < pageSize) break;
  }
  // Assisted registrations may not have an Auth/profile yet. Include them only
  // from authorized events and resolve their identity again at submission.
  const byUser = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const seen = new Set<string>();
  for (const eventId of eventIds) for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("registrations")
      .select("id,participants!inner(id,auth_user_id,first_name,last_name,public_code,participant_contacts(email,is_primary))")
      .eq("event_id", eventId).is("deleted_at", null).order("id").range(offset, offset + pageSize - 1);
    if (error) throw new Error("Impossibile caricare i partecipanti esistenti.");
    for (const row of data ?? []) {
      const participant = Array.isArray(row.participants) ? row.participants[0] : row.participants;
      if (!participant || seen.has(participant.id)) continue;
      seen.add(participant.id);
      const name = [participant.first_name, participant.last_name].filter(Boolean).join(" ");
      const account = byUser.get(participant.auth_user_id);
      if (account) {
        account.searchText = [account.searchText, name, participant.public_code].filter(Boolean).join(" ");
        continue;
      }
      const email = participant.participant_contacts.find(contact => contact.is_primary)?.email;
      if (email) candidates.push({ id: `participant:${participant.id}`, name: name || email, email, searchText: participant.public_code ?? "" });
    }
    if ((data ?? []).length < pageSize) break;
  }
  return candidates.sort((a, b) => a.name.localeCompare(b.name, "it"));
}
