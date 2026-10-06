"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  executeNominee,
  loadDistribution,
} from "@/lib/ceremonies/distribution.server";
async function run(mode: "leader" | "manager", input: unknown) {
  const result = await executeNominee(
    await createSupabaseServerClient(),
    createSupabaseServiceClient,
    mode,
    input,
  );
  if (result.status === "saved")
    for (const path of [
      "/dashboard/capogruppo/cerimonie",
      "/dashboard/manager/cerimonie",
      "/dashboard/manager/cerimonie/distribuzione",
      "/dashboard/partecipante/cerimonie",
    ])
      revalidatePath(path);
  return result;
}
export async function saveLeaderNominee(input: unknown) {
  return run("leader", input);
}
export async function saveManagerNominee(input: unknown) {
  return run("manager", input);
}
export async function refreshLeaderDistribution() {
  return loadDistribution(
    await createSupabaseServerClient(),
    createSupabaseServiceClient,
    "leader",
  );
}
export async function refreshManagerDistribution() {
  return loadDistribution(
    await createSupabaseServerClient(),
    createSupabaseServiceClient,
    "manager",
  );
}
