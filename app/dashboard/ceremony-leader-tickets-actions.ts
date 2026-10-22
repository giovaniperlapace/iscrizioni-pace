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
