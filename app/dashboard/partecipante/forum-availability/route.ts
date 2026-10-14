import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { getPanelReleaseMode } from "@/lib/panels/release";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const registrationId = new URL(request.url).searchParams.get("registrationId");
  if (!registrationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(registrationId)) {
    return NextResponse.json({ error: "invalid" }, { status: 400, headers });
  }
  const db = await createSupabaseServerClient();
  if (!await getCurrentAuthContext(db, "partecipante")) {
    return NextResponse.json({ error: "forbidden" }, { status: 401, headers });
  }
  try {
    if (await getPanelReleaseMode(db) !== "open") return NextResponse.json({ error: "forbidden" }, { status: 403, headers });
    // Ownership and event scope are checked independently inside this authenticated RPC.
    const { data, error } = await db.rpc("get_participant_panel_catalog", { p_registration_id: registrationId });
    if (error) throw error;
    return NextResponse.json({ rows: data ?? [] }, { headers });
  } catch {
    return NextResponse.json({ error: "failed" }, { status: 500, headers });
  }
}
