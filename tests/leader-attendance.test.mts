import assert from "node:assert/strict";
import test from "node:test";
import { leaderAttendanceDefaults, parseLeaderAttendance } from "../lib/groups/leader-attendance.ts";

test("attendance reads legacy full days, half days and unknown without inventing dates", () => {
  assert.deepEqual(leaderAttendanceDefaults([{day:"2026-10-25",day_part:null,choice:"yes"}]), {unknown:false,slots:["2026-10-25__morning","2026-10-25__afternoon"]});
  assert.deepEqual(leaderAttendanceDefaults([{day:"2026-10-25",day_part:"morning",choice:"yes"},{day:"2026-10-26",day_part:null,choice:"no"}]), {unknown:false,slots:["2026-10-25__morning"]});
  assert.deepEqual(leaderAttendanceDefaults([]), {unknown:true,slots:[]});
  assert.deepEqual(leaderAttendanceDefaults([{day:null,day_part:null,choice:"unknown"}]), {unknown:true,slots:[]});
});
test("save requires valid event slots; arrival afternoon is supported; unknown clears stale selections", () => {
  const form = new FormData();
  const parse = () => parseLeaderAttendance(form,"2026-10-25","2026-10-27");
  assert.equal(parse(),null);
  for (const invalid of ["2026-10-24__morning","2026-10-28__afternoon","2026-10-25__morning__extra","2026-02-30__morning"]) {
    form.set("availabilitySlots",invalid); assert.equal(parse(),null);
  }
  form.set("availabilitySlots","2026-10-24__afternoon");
  form.append("availabilitySlots","2026-10-24__afternoon");
  assert.deepEqual(parse(),{unknown:false,slots:[{day:"2026-10-24",part:"afternoon"}]});
  assert.equal(parseLeaderAttendance(form,null,null),null);
  form.set("availabilityUnknown","on"); form.set("availabilitySlots","invalid");
  assert.deepEqual(parse(),{unknown:true,slots:[]});
});

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadLeaderAttendance } from "../lib/groups/leader-attendance.server.ts";
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
test("loader derives registration from scoped assignment and loads only its attendance", async () => {
  const {db}=databaseFixture();
  assert.deepEqual(await loadLeaderAttendance(db,"leader","event","assignment"),{unknown:false,slots:["2026-10-25__morning"],startsOn:"2026-10-25",endsOn:"2026-10-27"});
});
test("loader prevents attendance reads for unrelated operators and invalid assignments", async () => {
  for (const [user,event,id] of [["other","event","assignment"],["leader","other","assignment"],["leader","event","other"]]) {
    const {db,reads}=databaseFixture();
    assert.equal(await loadLeaderAttendance(db,user,event,id),null);
    assert.ok(!reads.includes("event_attendance_choices"));
  }
  for (const patch of [{is_current:false},{group_id:"foreign"},{registrations:{event_id:"event",deleted_at:"2026-09-10"}}]) {
    const {db,reads}=databaseFixture({participant_group_assignments:[{id:"assignment",group_id:"child",registration_id:"registration",is_current:true,registrations:{event_id:"event",deleted_at:null},...patch}]});
    assert.equal(await loadLeaderAttendance(db,"leader","event","assignment"),null);
    assert.ok(!reads.includes("event_attendance_choices"));
  }
});
test("read errors never become empty editable attendance", async () => {
  for (const failure of ["group_memberships","groups","participant_group_assignments","events","event_attendance_choices"]) {
    const {db}=databaseFixture({},failure);
    await assert.rejects(loadLeaderAttendance(db,"leader","event","assignment"));
  }
});

test("inactive membership roots do not expose descendant attendance", async () => {
  const {db,reads}=databaseFixture({groups:[{id:"root",event_id:"event",parent_group_id:null,is_active:false},{id:"child",event_id:"event",parent_group_id:"root",is_active:true}]});
  assert.equal(await loadLeaderAttendance(db,"leader","event","assignment"),null);
  assert.ok(!reads.includes("event_attendance_choices"));
});
