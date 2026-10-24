"use server";
import { revalidatePath } from "next/cache";
import { createCeremonyManagerClient } from "@/lib/ceremonies/access.server";
import { ceremonyContext } from "@/lib/ceremonies/service";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { parseDraftCommand, type DraftResult } from "@/lib/ceremonies/drafts";

export async function manageCeremonyDrafts(
  input: unknown,
): Promise<DraftResult> {
  const c = parseDraftCommand(input);
  if (!c) return { status: "invalid" };
  const context = await ceremonyContext(await createCeremonyManagerClient());
  if (!context?.canManage) return { status: "forbidden" };
  const { data, error } = await createSupabaseServiceClient().rpc(
    "manage_ceremony_drafts",
    {
      p_event: context.event.id,
      p_actor: context.userId,
      p_plan: c.planId,
      p_revision: c.revision,
      p_request: c.requestId,
      p_operation: c.operation,
      p_draft: c.draftId,
      p_data: c.data,
    },
  );
  if (error)
    return {
      status:
        error.code === "42501"
          ? "forbidden"
          : ["22023", "22P02", "23514"].includes(error.code)
            ? "invalid"
            : "unavailable",
    };
  if (data?.status === "saved") {
    for (const path of ["/dashboard/manager", "/dashboard/admin"])
      revalidatePath(path);
    if (c.operation === "publish")
      for (const path of [
        "/dashboard/partecipante",
        "/dashboard/partecipante/cerimonie",
        "/dashboard/capogruppo/cerimonie",
      ])
        revalidatePath(path);
  }
  return {
    status: typeof data?.status === "string" ? data.status : "unavailable",
    seats: data?.seats,
    notifications: data?.notifications,
    missingGroups: data?.missingGroups,
  };
}
