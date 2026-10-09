import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPanelReleaseMode } from "./release";

export async function requirePublicPanelBookings() {
  if (await getPanelReleaseMode(await createSupabaseServerClient()) !== "open") redirect("/");
}

export async function requirePanelAdministrator() {
  const { getCurrentAuthContext } = await import("@/lib/auth/session");
  const { canAccessPanelManagement } = await import("./management-access");
  const auth = await getCurrentAuthContext(await createSupabaseServerClient(), "admin");
  if (!auth) redirect("/login");
  if (!canAccessPanelManagement(auth.eventRoles)) redirect(auth.dashboardPath);
}
