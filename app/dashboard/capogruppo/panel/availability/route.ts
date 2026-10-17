import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { getCurrentOperationalEventId } from "@/lib/events/current";
import { isUuid } from "@/lib/panels/group-bookings";
import { getPanelReleaseMode } from "@/lib/panels/release";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const section = new URL(request.url).searchParams.get("section");
  if (section !== null && !isUuid(section)) return NextResponse.json({ error: "invalid" }, { status: 400, headers });
  try {
    const db = await createSupabaseServerClient();
    const auth = await getCurrentAuthContext(db, "capogruppo");
    if (!auth) return NextResponse.json({ error: "forbidden" }, { status: 401, headers });
    if (auth.dashboardRole !== "capogruppo" || await getPanelReleaseMode(db) !== "open") {
      return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
    }
    const eventId = await getCurrentOperationalEventId(db);
    if (!eventId) return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
    const { data, error } = await db.rpc("get_group_panel_booking_view", { p_event_id: eventId, p_section_id: section });
    if (error?.code === "42501") return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
    // A withdrawn Forum should disappear without making the whole page unusable.
    if (error?.code === "22023") {
      const fallback = await db.rpc("get_group_panel_booking_view", { p_event_id: eventId, p_section_id: null });
      if (fallback.error) throw fallback.error;
      return NextResponse.json({ view: fallback.data }, { headers });
    }
    if (error || !data) throw error ?? new Error("Missing Forum availability");
    return NextResponse.json({ view: data }, { headers });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500, headers });
  }
}
