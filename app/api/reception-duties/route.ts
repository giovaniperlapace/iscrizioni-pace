import { createSupabaseServerClient } from "@/lib/supabase/server";
export async function GET() {
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return Response.json({ error: "forbidden" }, { status: 403 });
  const { data, error } = await db.rpc("reception_duty_catalog");
  if (error || !data?.canManage) return Response.json({ error: "unavailable" }, { status: 403 });
  return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
