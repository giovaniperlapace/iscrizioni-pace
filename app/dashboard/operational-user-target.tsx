import { getCurrentOperationalEventId } from "@/lib/events/current";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadRoleCandidates } from "@/lib/operational-users/role-candidates";
import { OperationalUserTargetFields } from "@/app/dashboard/operational-user-target-fields";

export async function OperationalUserTarget() {
  const auth = await getCurrentAuthContext(await createSupabaseServerClient());
  if (!auth?.eventRoles.some(({ role }) => role === "admin" || role === "manager")) return null;
  const db = createSupabaseServiceClient();
  const eventId = await getCurrentOperationalEventId(db);
  const allowed = eventId && auth.eventRoles.some(role => role.role === "admin" || (role.role === "manager" && role.eventId === eventId));
  const candidates = await loadRoleCandidates(db, allowed ? [eventId] : []);
  return <OperationalUserTargetFields candidates={candidates} />;
}
