import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPanelReleaseMode } from "./release";

export async function requirePublicPanelBookings() {
  if (await getPanelReleaseMode(await createSupabaseServerClient()) !== "open") redirect("/");
}

export async function requirePanelManager() {
  const { getCurrentAuthContext } = await import("@/lib/auth/session");
  const { canAccessPanelManagement } = await import("./management-access");
  const auth = await getCurrentAuthContext(await createSupabaseServerClient());
  if (!auth) redirect("/login");
  if (!canAccessPanelManagement(auth.eventRoles)) redirect(auth.dashboardPath);
  const { createSupabaseServiceClient } = await import("@/lib/supabase/service");
  const { getCurrentOperationalEvent } = await import("@/lib/events/current");
  const event = await getCurrentOperationalEvent(createSupabaseServiceClient(), "id");
  if (!canAccessPanelManagement(auth.eventRoles, event?.id ?? null)) redirect(auth.dashboardPath);
}
