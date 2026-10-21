import type { SupabaseClient } from "@supabase/supabase-js";
import { ceremonyContext } from "./service.ts";

export async function isCeremonyManager(db: SupabaseClient): Promise<boolean> {
  return !!(await ceremonyContext(db))?.canManage;
}
export async function createCeremonyManagerClient() {
  const { createSupabaseServerClient } = await import("../supabase/server.ts");
  const session = await createSupabaseServerClient();
  if (!await isCeremonyManager(session)) throw Error("Accesso riservato ad Admin e Manager dell’evento corrente.");
  return session;
}
