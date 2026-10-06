"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { executeSeatMap, loadSeatMap } from "@/lib/ceremonies/seat-map.server";
async function save(mode: "manager" | "leader", input: unknown) {
  const result = await executeSeatMap(
    await createSupabaseServerClient(),
    createSupabaseServiceClient,
    mode,
    input,
  );
  if (result.status === "saved")
    for (const path of [
      "/dashboard/manager/cerimonie",
      "/dashboard/manager/cerimonie/mappa",
      "/dashboard/manager/cerimonie/distribuzione",
      "/dashboard/capogruppo/cerimonie",
      "/dashboard/capogruppo/cerimonie/mappa",
      "/dashboard/partecipante/cerimonie",
    ])
      revalidatePath(path);
  return result;
}
export async function saveManagerMap(input: unknown) {
  return save("manager", input);
}
export async function saveLeaderMap(input: unknown) {
  return save("leader", input);
}
export async function refreshManagerMap(planId: string) {
  return loadSeatMap(
    await createSupabaseServerClient(),
    createSupabaseServiceClient,
    "manager",
    planId,
  );
}
export async function refreshLeaderMap(planId: string) {
  return loadSeatMap(
    await createSupabaseServerClient(),
    createSupabaseServiceClient,
    "leader",
    planId,
  );
}
