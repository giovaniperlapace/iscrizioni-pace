"use server";
import { revalidatePath } from "next/cache";
import { createAdminPilotClient } from "@/lib/reception/admin-pilot.server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  executeLeaderPair,
  loadLeaderTickets,
} from "@/lib/ceremonies/leader-tickets.server";
export async function saveLeaderPair(input: unknown) {
  const result = await executeLeaderPair(
    await createAdminPilotClient(),
    createSupabaseServiceClient,
    input,
  );
  if (result.status === "saved")
    for (const path of [
      "/dashboard/capogruppo/cerimonie",
      "/dashboard/manager",
      "/dashboard/admin",
      "/dashboard/partecipante/cerimonie",
    ])
      revalidatePath(path);
  return result;
}
export async function refreshLeaderTickets() {
  return loadLeaderTickets(
    await createAdminPilotClient(),
    createSupabaseServiceClient,
  );
}

export async function saveLeaderSectorBatch(input: unknown) {
  const { parseLeaderBatch } = await import("@/lib/ceremonies/sector-desk");
  const { distributionContext } = await import(
    "@/lib/ceremonies/distribution.server"
  );
  const command = parseLeaderBatch(input);
  if (!command) return { status: "invalid" };
  const context = await distributionContext(
    await createAdminPilotClient(),
    "leader",
  );
  if (!context) return { status: "forbidden" };
  const { data, error } = await createSupabaseServiceClient().rpc(
    "assign_ceremony_group_members",
    {
      p_event: context.event.id,
      p_actor: context.userId,
      p_allocation: command.allocationId,
      p_revision: command.revision,
      p_request: command.requestId,
      p_subjects: command.subjects,
    },
  );
  if (error)
    return {
      status:
        error.code === "42501"
          ? "forbidden"
          : error.code === "23505"
            ? "duplicate"
            : ["22023", "22P02", "23514"].includes(error.code)
              ? "invalid"
              : "unavailable",
    };
  if (data?.status === "saved")
    for (const path of [
      "/dashboard/capogruppo/cerimonie",
      "/dashboard/manager",
      "/dashboard/admin",
      "/dashboard/partecipante/cerimonie",
    ])
      revalidatePath(path);
  return {
    status: typeof data?.status === "string" ? data.status : "unavailable",
  };
}
