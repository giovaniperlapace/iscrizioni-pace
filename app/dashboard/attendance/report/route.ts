import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AttendanceReadError } from '@/lib/reception/attendance.server';
import { loadReceptionReport } from '@/lib/reception/report.server';
export async function GET(request: Request) {
  const headers = { 'Cache-Control':'private, no-store' };
  try {
    return Response.json(await loadReceptionReport(await createSupabaseServerClient(), new URL(request.url).searchParams), { headers });
  } catch (error) {
    return Response.json({ error:'Report non disponibile. Riprova.' }, { headers, status:error instanceof AttendanceReadError ? error.status : 503 });
  }
}
