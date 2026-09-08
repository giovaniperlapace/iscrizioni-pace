import type { SupabaseClient } from "@supabase/supabase-js";

export type RoleCandidate = { id: string; name: string; email: string };

// Call only after verifying an effective admin/manager role. No operational
// membership is required for the target: this directory includes first roles.
export async function loadRoleCandidates(supabase: SupabaseClient): Promise<RoleCandidate[]> {
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
  return candidates.sort((a, b) => a.name.localeCompare(b.name, "it"));
}
