import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadRoleCandidates } from "@/lib/operational-users/role-candidates";
import { OperationalUserTargetFields } from "@/app/dashboard/operational-user-target-fields";

export async function OperationalUserTarget() {
  const auth = await getCurrentAuthContext(await createSupabaseServerClient());
  if (!auth?.eventRoles.some(({ role }) => role === "admin" || role === "manager")) return null;
  const candidates = await loadRoleCandidates(createSupabaseServiceClient());
  return <OperationalUserTargetFields candidates={candidates} />;
}
