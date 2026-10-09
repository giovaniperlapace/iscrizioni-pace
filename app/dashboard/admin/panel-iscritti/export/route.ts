import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { canAccessPanelManagement } from "@/lib/panels/management-access";
import { isPanelRosterId, loadPanelRoster } from "@/lib/panels/panel-roster.server";
import { writePanelRosterWorkbook } from "@/lib/panels/panel-roster-workbook";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    const auth = await getCurrentAuthContext(await createSupabaseServerClient());
    if (!auth) return new Response("Accesso richiesto.", { status: 401, headers });
    if (!canAccessPanelManagement(auth.eventRoles)) return new Response("Accesso non consentito.", { status: 403, headers });
    const panelId = new URL(request.url).searchParams.get("panelId") ?? "";
    if (!isPanelRosterId(panelId)) return new Response("Panel non valido.", { status: 400, headers });
    const roster = await loadPanelRoster(createSupabaseServiceClient(), panelId, auth.eventRoles);
    if (!roster) return new Response("Panel non disponibile.", { status: 404, headers });
    const buffer = await writePanelRosterWorkbook(roster);
    return new Response(new Uint8Array(buffer), { headers: {
      ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="iscritti-panel-${panelId}.xlsx"`,
    } });
  } catch (cause) {
    if (cause instanceof Error && cause.message === "Panel roster forbidden") return new Response("Accesso non consentito.", { status: 403, headers });
    return new Response("Impossibile esportare l’elenco. Riprova.", { status: 500, headers });
  }
}
