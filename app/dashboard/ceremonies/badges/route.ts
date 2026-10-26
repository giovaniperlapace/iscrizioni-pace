import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadLeaderTickets } from "@/lib/ceremonies/leader-tickets.server";
import { closingLeaderDownloadTickets } from "@/lib/ceremonies/closing-leader-download";
import { streamClosingLeaderPdf } from "@/lib/ceremonies/closing-leader-download.server";

export const runtime = "nodejs";
export const maxDuration = 300;
const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };

export async function GET() {
  try {
    const db = await createSupabaseServerClient();
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) return new Response(null, { status: 401, headers });
    // No actor, group, nominee or identity supplied by the browser is trusted.
    const tickets = closingLeaderDownloadTickets(await loadLeaderTickets(db, createSupabaseServiceClient));
    if (!tickets.length) return new Response(null, { status: 404, headers });
    return new Response(streamClosingLeaderPdf(tickets), { headers: { ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="cerimonia-finale-tutti-i-biglietti.pdf"' } });
  } catch (error) {
    return new Response(null, { status: error instanceof Error && error.message === "forbidden" ? 403 : 503, headers });
  }
}
