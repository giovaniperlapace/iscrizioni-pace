import { createSupabaseServiceClient } from "@/lib/supabase/service";

// Only called inside the authorized admin/manager roles section. Keep the
// selected profile addressable after its last operational assignment is removed.
export async function loadRolelessPerson(userId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return null;
  const { data, error } = await createSupabaseServiceClient().from("profiles")
    .select("id,full_name,email").eq("id", userId).maybeSingle();
  if (error) throw new Error("Impossibile caricare la persona selezionata.");
  if (!data) return null;
  return { userId: data.id as string, fullName: data.full_name as string | null, email: data.email as string | null,
    assignments: [], eventRoles: [], groupLeaderAssignments: [] };
}
