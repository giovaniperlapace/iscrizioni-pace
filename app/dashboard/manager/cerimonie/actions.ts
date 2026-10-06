"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { executeCeremony } from "@/lib/ceremonies/service";
export async function saveCeremony(form: FormData) {
  const result = await executeCeremony(
    await createSupabaseServerClient(),
    createSupabaseServiceClient,
    form,
  );
  if (result.status === "saved")
    for (const path of [
      "/dashboard/manager/cerimonie",
      "/dashboard/manager/cerimonie/distribuzione",
      "/dashboard/capogruppo/cerimonie",
      "/dashboard/partecipante/cerimonie",
    ])
      revalidatePath(path);
  return result;
}
