import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getCurrentOperationalEvent } from "@/lib/events/current";
import { canViewPanelData } from "@/lib/panels/management-access";
import { loadAllRows } from "@/lib/supabase/all-rows";
import { loadPanelRoster } from "@/lib/panels/panel-roster.server";
import { sortForums } from "@/lib/panels/forum-order";
import { FORUM_EXPORT_SESSIONS, forumExportSession } from "@/lib/panels/roster-export-sessions";
import { writePanelRosterZip } from "@/lib/panels/panel-roster-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
export async function GET(request: Request) {
  try {
    const db = await createSupabaseServerClient();
    const auth = await getCurrentAuthContext(db);
    if (!auth) return new Response("Accesso richiesto.", { status: 401, headers });
    const event = await getCurrentOperationalEvent(db, "id,title");
    if (!event) return new Response("Evento non disponibile.", { status: 404, headers });
    if (!canViewPanelData(auth.eventRoles, event.id)) return new Response("Accesso non consentito.", { status: 403, headers });
    const params = new URL(request.url).searchParams;
    if (params.get("event") !== event.id) return new Response("L’evento corrente è cambiato. Ricarica la pagina.", { status: 409, headers });
    const session = FORUM_EXPORT_SESSIONS.find(s => s.key === params.get("session"));
    if (!session) return new Response("Sessione non valida.", { status: 400, headers });
    const service = createSupabaseServiceClient();
    const panels = await loadAllRows<{ id: string; title: string; starts_at: string | null }>((from, to) => service.from("event_moments").select("id,title,starts_at").eq("event_id", event.id).eq("moment_type", "panel").order("id").range(from, to));
    const selected = sortForums(panels.data.filter(p => forumExportSession(p.starts_at) === session.key));
    if (!selected.length) return new Response("Nessun Forum in questa sessione.", { status: 404, headers });
    const rosters = [];
    for (const panel of selected) {
      const roster = await loadPanelRoster(service, panel.id, auth.eventRoles);
      if (!roster) throw new Error("Forum unavailable");
      rosters.push(roster);
    }
    const buffer = await writePanelRosterZip(rosters, `${event.title} - ${session.label}`);
    return new Response(new Uint8Array(buffer), { headers: { ...headers, "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="forum-${session.key}.zip"` } });
  } catch {
    return new Response("Impossibile generare i PDF. Riprova.", { status: 500, headers });
  }
}
