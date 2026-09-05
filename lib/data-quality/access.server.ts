import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentOperationalEvent } from "@/lib/events/current";

export async function qualityAccess(write = false) {
  const db = await createSupabaseServerClient();
  const auth = await getCurrentAuthContext(db);
  if (!auth) throw new Error("Accedi per continuare.");
  const event = await getCurrentOperationalEvent(
    db,
    "id,title,starts_on,ends_on",
  );
  if (!event) throw new Error("Nessun evento corrente disponibile.");
  const isAdmin = auth.eventRoles.some(
    (role) => role.role === "admin" && role.eventId === null,
  );
  const canWrite =
    isAdmin ||
    auth.eventRoles.some(
      (role) => role.role === "manager" && role.eventId === event.id,
    );
  const canRead =
    canWrite ||
    auth.eventRoles.some(
      (role) => role.role === "manager_viewer" && role.eventId === event.id,
    );
  if (!canRead || (write && !canWrite))
    throw new Error("Non hai i permessi per questa operazione.");
  return { db, auth, event, isAdmin, canWrite };
}
