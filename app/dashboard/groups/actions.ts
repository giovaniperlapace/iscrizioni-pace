"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { GroupDeletionResult } from "@/lib/groups/deletion";

export async function manageGroupDeletion(
  groupId: string, expected?: string,
): Promise<GroupDeletionResult> {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(groupId) ||
      (expected !== undefined && !/^[0-9a-f]{32}$/.test(expected))) return { error: "failed" };
  try {
    const auth = await getCurrentAuthContext(await createSupabaseServerClient());
    if (!auth || !auth.eventRoles.some(role =>
      (role.role === "admin" && role.eventId === null) || role.role === "manager")) return { error: "forbidden" };
    const { data, error } = await createSupabaseServiceClient().rpc("manage_group_deletion", {
      p_group_id: groupId, p_actor_user_id: auth.user.id,
      p_delete: expected !== undefined, p_expected: expected ?? null,
    });
    if (error) {
      return { error: error.code === "42501" ? "forbidden" : error.code === "PT409" ? "conflict" :
        error.code === "P0002" ? "missing" : error.code === "P0003" ? "children" :
          "failed" };
    }
    if (expected !== undefined) {
      if (data?.deleted !== true) return { error: "failed" };
      for (const path of ["/dashboard/admin", "/dashboard/manager", "/dashboard/capogruppo", "/dashboard/partecipante", "/registrazione", "/"]) revalidatePath(path);
      return { deleted: true };
    }
    if (!data || typeof data.name !== "string" || typeof data.expected !== "string" ||
        ![data.children, data.assignments, data.currentAssignments, data.memberships, data.links, data.rules].every(value => Number.isSafeInteger(value) && value >= 0)) {
      return { error: "failed" };
    }
    return { preview: data };
  } catch {
    return { error: "failed" };
  }
}
