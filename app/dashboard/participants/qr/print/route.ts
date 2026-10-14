import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadOperationsQrLabel } from "@/lib/registrations/operations-qr.server";
import { QR_LABEL_CSP } from "@/lib/qrcode/print-label";

const headers = {
  "Cache-Control": "private, no-store",
  "Content-Security-Policy": QR_LABEL_CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
function unavailable(status: number) {
  return new NextResponse("Etichetta non disponibile. Chiudi questa finestra e riprova dalla scheda del partecipante. Il nominativo deve entrare per intero nel formato e il QR deve essere attivo.", { status, headers });
}
export async function GET(request: NextRequest) {
  try {
    const auth = await getCurrentAuthContext(await createSupabaseServerClient());
    if (!auth) return unavailable(401);
    const id = request.nextUrl.searchParams.get("registrationId") ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return unavailable(400);
    if (!auth.eventRoles.some(role => (role.role === "admin" && role.eventId === null) || role.role === "manager")) return unavailable(403);
    const html = await loadOperationsQrLabel(createSupabaseServiceClient(), id, eventId => auth.eventRoles.some(role =>
      (role.role === "admin" && role.eventId === null) || (role.role === "manager" && role.eventId === eventId)));
    if (!html) return unavailable(404);
    return new NextResponse(html, { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } });
  } catch {
    return unavailable(500);
  }
}
