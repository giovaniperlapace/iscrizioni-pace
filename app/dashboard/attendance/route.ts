import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AttendanceReadError, loadEventAttendance } from "@/lib/reception/attendance.server";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const params = new URL(request.url).searchParams;
    const result = await loadEventAttendance(await createSupabaseServerClient(), params.get("eventId") ?? "", params.get("summary") === "1");
    return Response.json(result, { headers });
  } catch (error) {
    return Response.json({ error: "Presenze non disponibili. Riprova." }, {
      status: error instanceof AttendanceReadError ? error.status : 503, headers,
    });
  }
}
