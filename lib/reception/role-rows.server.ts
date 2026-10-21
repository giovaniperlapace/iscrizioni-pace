import type { SupabaseClient } from "@supabase/supabase-js";
import { dutySummary, type DutyOption } from "./event-duties.ts";
// Called only by the already-authorized Admin/Manager role loaders.
export async function receptionRoleRows(db: SupabaseClient, scope: Set<string> | null) {
  const { data: event, error: eventError } = await db.from("events").select("id,title").eq("is_current", true).maybeSingle();
  if (eventError) throw new Error("Impossibile caricare gli incarichi.");
  if (!event || scope && !scope.has(event.id)) return [];
  const rows: { user_id: string; key: string }[] = [];
  for (const table of ["panel_reception_assignments", "ceremony_reception_assignments"]) {
    for (let from = 0; ; from += 500) {
      let query = db.from(table).select(table === "panel_reception_assignments" ? "user_id,panel_id" : "user_id,kind").eq("event_id", event.id).order("user_id");
      if (table === "panel_reception_assignments") query = query.eq("duty", "panel_entry").order("panel_id");
      else query = query.order("kind");
      const { data, error } = await query.range(from, from + 499);
      if (error) throw new Error("Impossibile caricare gli incarichi.");
      for (const row of data ?? []) { const value = row as unknown as {user_id: string; panel_id?: string; kind?: string}; rows.push({ user_id: value.user_id, key: value.panel_id ?? value.kind! }); }
      if (!data || data.length < 500) break;
    }
  }
  const choices: DutyOption[] = [{key:"opening",title:"Cerimonia d’apertura",room:null,kind:"ceremony"},{key:"closing",title:"Cerimonia finale",room:null,kind:"ceremony"}];
  for (let from = 0; ; from += 500) {
    const {data,error} = await db.from("event_moments").select("id,title").eq("event_id",event.id).eq("moment_type","panel").order("id").range(from,from+499);
    if(error) throw new Error("Impossibile caricare i Forum.");
    choices.push(...(data ?? []).map(row => ({key:row.id,title:row.title,room:null,kind:"panel" as const})));
    if(!data || data.length<500) break;
  }
  const users = [...new Set(rows.map(row => row.user_id))];
  return users.map(user_id => { const dutyKeys=rows.filter(row => row.user_id===user_id).map(row => row.key); return {
    user_id,role:"accoglienza_forum_eventi",event_id:event.id,events:{title: dutySummary(dutyKeys,choices)},dutyKeys,
  }; });
}
