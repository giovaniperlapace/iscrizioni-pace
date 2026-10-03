// Only imported by the temporary local test route. Never use a remote database.
import { execFileSync } from "node:child_process";
import { headers } from "next/headers";
const args = ["-h", "127.0.0.1", "-p", "55447", "-d", "service_import_test", "-X", "-v", "ON_ERROR_STOP=1", "-Atc"];
function sql(query: string) {
  return execFileSync("/opt/homebrew/bin/psql", [...args, query], { encoding: "utf8", timeout: 15000 }).trim();
}
function literal(value: unknown) { return `'${String(value).replaceAll("'", "''")}'`; }
export async function qualityAccess(write: boolean) {
  if (!write) throw new Error("Write access required for fixture");
  const referer = (await headers()).get("referer") ?? "";
  if (new URL(referer || "http://localhost").searchParams.get("role") === "viewer") throw new Error("Non hai i permessi per questa operazione.");
  const eventId = sql("select f(1)");
  const query = {
    select: (columns: string) => { void columns; return query; },
    eq: (column: string, value: unknown) => { void column; void value; return query; },
    order: (column: string) => { void column; return query; },
    range: async (from: number, to: number) => ({ data: JSON.parse(sql(`select coalesce(json_agg(t),'[]') from (select id,label from event_services where event_id=f(1) and is_active order by id offset ${from} limit ${to-from+1}) t`)) as { id: string; label: string }[], error: null }),
  };
  return { auth: { user: { id: sql(referer.includes("dashboard=admin") ? "select f(33)" : "select f(31)") } }, event: { id: eventId }, db: { from: (table: string) => { void table; return query; } } };
}
export function createSupabaseServiceClient() {
  return { rpc: async (name: string, values: Record<string, unknown>) => {
    if (name !== "import_participant_services") throw new Error("Unexpected fixture RPC");
    try {
      const result = sql(`select import_participant_services(${literal(values.p_import_id)}::uuid,${literal(values.p_event_id)}::uuid,${literal(values.p_actor_user_id)}::uuid,${literal(JSON.stringify(values.p_rows))}::jsonb)`);
      return { data: JSON.parse(result), error: null };
    } catch { return { data: null, error: { code: "fixture-failure" } }; }
  } };
}
