import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadOperationsAttendance } from "../lib/registrations/operations-attendance.server.ts";
type Row = Record<string, unknown>;
function databaseFixture(overrides: Record<string, Row[]> = {}, failure = "") {
  const tables: Record<string, Row[]> = {
    groups: [{id:"root",event_id:"event",parent_group_id:null,is_active:true},{id:"child",event_id:"event",parent_group_id:"root",is_active:true}],
    group_memberships: [{id:"membership",group_id:"root",user_id:"leader",role:"capogruppo"}],
    participant_group_assignments: [{id:"assignment",group_id:"child",registration_id:"registration",is_current:true,registrations:{event_id:"event",deleted_at:null}}],
    events: [{id:"event",is_current:true,starts_on:"2026-10-25",ends_on:"2026-10-27"}],
    event_attendance_choices: [{registration_id:"registration",day:"2026-10-25",day_part:"morning",choice:"yes"},{registration_id:"other",day:"2026-10-26",day_part:"afternoon",choice:"yes"}],
    ...overrides,
  };
  const reads: string[] = [];
  const db = {from(table:string) {
    reads.push(table);
    let rows = tables[table] ?? [];
    const result = (data:unknown) => ({data,error:failure === table ? {message:"Synthetic read failure"} : null});
    const query = {
      select(){return query;}, order(){return query;},
      eq(key:string,value:unknown){rows=rows.filter(row => key.split(".").reduce<unknown>((v,k)=>(v as Row)?.[k],row) === value);return query;},
      is(key:string,value:unknown){return query.eq(key,value);},
      range(from:number,to:number){return Promise.resolve(result(rows.slice(from,to+1)));},
      maybeSingle(){return Promise.resolve(result(rows[0] ?? null));},
      single(){return query.maybeSingle();},
      then(resolve:(value:unknown)=>unknown){return Promise.resolve(result(rows)).then(resolve);},
    };
    return query;
  }} as unknown as SupabaseClient;
  return {db,reads};
}

test("operator loads communicated attendance without requiring a group", async () => {
 const {db} = databaseFixture({registrations:[{id:"registration",event_id:"event",deleted_at:null}]});
 assert.deepEqual(await loadOperationsAttendance(db,"registration",id=>id==="event"), {unknown:false,slots:["2026-10-25__morning"],startsOn:"2026-10-25",endsOn:"2026-10-27"});
});
test("operator loader rejects foreign, deleted and missing registrations before reading attendance", async () => {
 for (const [deleted,allowed,id] of [[null,false,"registration"],["now",true,"registration"],[null,true,"missing"]] as const) {
  const {db,reads}=databaseFixture({registrations:[{id:"registration",event_id:"event",deleted_at:deleted}]});
  assert.equal(await loadOperationsAttendance(db,id,()=>allowed),null);
  assert.ok(!reads.includes("event_attendance_choices"));
 }
});
test("operator loader propagates read errors instead of showing an empty presence", async () => {
 for(const table of ["registrations","events","event_attendance_choices"]) {
  const {db}=databaseFixture({registrations:[{id:"registration",event_id:"event",deleted_at:null}]},table);
  await assert.rejects(loadOperationsAttendance(db,"registration",()=>true));
 }
});
