import type { SupabaseClient } from '@supabase/supabase-js';
import { AttendanceReadError } from './attendance.server.ts';
import { parseReportFilter, projectReceptionReport } from './report.ts';

export async function loadReceptionReport(db: SupabaseClient, params: URLSearchParams) {
  const filter = parseReportFilter(params);
  if (!filter) throw new AttendanceReadError(400);
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) throw new AttendanceReadError(401);
  // Authenticated RPC checks auth.uid() and the actual event role itself.
  const { data, error } = await db.rpc('reception_operational_report', {
    p_event_id:filter.eventId, p_day:filter.day, p_part:filter.part,
  });
  if (error) throw new AttendanceReadError(error.code === '42501' ? 403 : error.code === '22023' ? 400 : 503);
  const result = projectReceptionReport(data);
  if (!result || result.eventId !== filter.eventId || result.day !== filter.day || result.part !== filter.part) throw new AttendanceReadError(503);
  return result;
}
