import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { ceremonyContext } from "@/lib/ceremonies/service";
import { parseSectorDirectoryQuery } from "@/lib/ceremonies/sector-desk";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const query = parseSectorDirectoryQuery({
    planId: q.get("planId"),
    groupId: q.get("groupId") || null,
    withoutGroup: q.get("withoutGroup") === "true",
    search: q.get("search") ?? "",
    page: Number(q.get("page") ?? 1),
  });
  if (!query)
    return NextResponse.json({ status: "invalid" }, { status: 400, headers });
  try {
    const context = await ceremonyContext(await createSupabaseServerClient());
    if (!context?.canManage)
      return NextResponse.json(
        { status: "forbidden" },
        { status: 403, headers },
      );
    const service = createSupabaseServiceClient();
    const plan = await service
      .from("ceremony_plans")
      .select("kind")
      .eq("id", query.planId)
      .eq("event_id", context.event.id)
      .maybeSingle();
    if (plan.error || !plan.data)
      return NextResponse.json(
        { status: "forbidden" },
        { status: 403, headers },
      );
    // Both RPCs take the event lock. Reject a mixed revision rather than display
    // counters assembled across a concurrent write.
    const directory = await service.rpc("get_ceremony_sector_directory", {
      p_event: context.event.id,
      p_actor: context.userId,
      p_plan: query.planId,
      p_group: query.groupId,
      p_search: query.search,
      p_page: query.page,
      p_without_group: query.withoutGroup,
    });
    const desk = await service.rpc("get_ceremony_seats_desk", {
      p_event: context.event.id,
      p_actor: context.userId,
      p_kind: plan.data.kind,
    });
    if (
      directory.error ||
      desk.error ||
      !desk.data ||
      !directory.data ||
      directory.data.revision !== desk.data.revision
    )
      throw Error("unavailable");
    return NextResponse.json(
      { status: "loaded", desk: desk.data, directory: directory.data },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers },
    );
  }
}
