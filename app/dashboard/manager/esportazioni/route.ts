import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getCurrentOperationalEvent } from "@/lib/events/current";
import { isPresenceVariant } from "@/lib/presence-exports/catalog";
import { presenceConfigForEvent } from "@/lib/presence-exports/config";
import { loadPresenceSource } from "@/lib/presence-exports/data.server";
import { buildPresenceReport } from "@/lib/presence-exports/report";
import { writePresenceWorkbook } from "@/lib/presence-exports/workbook";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  try {
    const db = await createSupabaseServerClient();
    const auth = await getCurrentAuthContext(db);
    if (!auth) return new Response("Accedi per continuare.", { status: 401, headers });
    const event = await getCurrentOperationalEvent(db, "id,title,starts_on,ends_on");
    if (!event) return new Response("Evento corrente non disponibile.", { status: 404, headers });
    const allowed = auth.eventRoles.some(role => role.role === "admin" && role.eventId === null ||
      (role.role === "manager" || role.role === "manager_viewer") && role.eventId === event.id);
    if (!allowed) return new Response("Non hai i permessi per questa esportazione.", { status: 403, headers });
    const params = new URL(request.url).searchParams;
    const variant = params.get("report");
    if (!isPresenceVariant(variant)) return new Response("Report non valido.", { status: 400, headers });
    if (params.get("event") && params.get("event") !== event.id) return new Response("L’evento corrente è cambiato. Ricarica la pagina.", { status: 409, headers });
    const config = presenceConfigForEvent(event.id);
    if (!config) return new Response("Raccordo non configurato per questo evento.", { status: 409, headers });
    const source = await loadPresenceSource(createSupabaseServiceClient(), {
      id: event.id, title: event.title, starts_on: event.starts_on ?? null, ends_on: event.ends_on ?? null,
    }, variant === "b" || variant === "b2");
    const buffer = await writePresenceWorkbook(buildPresenceReport(source, config, variant));
    return new Response(new Uint8Array(buffer), { headers: { ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="presenze_${variant}.xlsx"`,
    } });
  } catch {
    console.error("[presence-export] Export failed");
    return new Response("Esportazione non disponibile. Riprova più tardi.", { status: 500, headers });
  }
}
