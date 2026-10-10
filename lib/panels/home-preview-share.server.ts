import "server-only";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function requirePreviewShareAdmin() {
  const auth = await getCurrentAuthContext(await createSupabaseServerClient());
  if (!auth) redirect("/login");
  if (!auth.eventRoles.some(role => role.role === "admin" && role.eventId === null)) redirect(auth.dashboardPath);
  const db = createSupabaseServiceClient();
  const { data: event, error } = await db.from("events").select("id").eq("is_current", true).maybeSingle();
  if (error || !event) throw new Error("Evento corrente non disponibile.");
  return { db, eventId: event.id as string };
}

