import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadOperationsAttendance } from "@/lib/registrations/operations-attendance.server";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  try {
    const auth = await getCurrentAuthContext(await createSupabaseServerClient());
    if (!auth) return NextResponse.json({}, { status: 401, headers });
    const registrationId = request.nextUrl.searchParams.get("registrationId") ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(registrationId)) {
      return NextResponse.json({}, { status: 400, headers });
    }
    const canManageEvent = (eventId: string) => auth.eventRoles.some((role) =>
      (role.role === "admin" && role.eventId === null) ||
      (role.role === "manager" && role.eventId === eventId));
    if (!auth.eventRoles.some((role) =>
      (role.role === "admin" && role.eventId === null) || role.role === "manager")) {
      return NextResponse.json({}, { status: 403, headers });
    }
    const attendance = await loadOperationsAttendance(createSupabaseServiceClient(), registrationId, canManageEvent);
    if (!attendance) return NextResponse.json({}, { status: 404, headers });
    return NextResponse.json({ attendance }, { headers });
  } catch {
    return NextResponse.json({}, { status: 500, headers });
  }
}
