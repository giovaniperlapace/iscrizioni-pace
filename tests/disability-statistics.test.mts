import { countDeclaredDifficulties, disabilityGroupOptions, filterAndSortDisabilityPeople } from "../lib/registrations/disability-statistics.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadDisabilityStatistics, withStatisticsDifficulties } from "../lib/registrations/disability-statistics.server.ts";
import { buildAssignedGroupTree, filterStatisticsPeople, buildEventStatisticsSnapshot, serializeStatisticsDrilldown, parseStatisticsDrilldown, describeStatisticsDrilldown } from "../lib/registrations/event-statistics.ts";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const event = id(9000);
function fixture(options: { fail?: string; empty?: boolean; broken?: boolean; removed?: boolean } = {}) {
  const calls: URL[] = [];
  const db = createClient("https://synthetic.example.test", "test", { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(String(input)); calls.push(url);
    const table = url.pathname.split("/").at(-1)!;
    const start = Number(url.searchParams.get("offset") ?? 0);
    const size = Number(url.searchParams.get("limit") ?? 500);
    if (table === options.fail && (table !== "registrations" || start > 0)) return Response.json({ message: "synthetic failure" }, { status: 400 });
    const ids = (url.searchParams.get(table === "registrations" ? "id" : "registration_id")?.slice(4,-1).split(",") ?? []);
    let rows: unknown[] = [];
    if (table === "registrations") {
      assert.equal(url.searchParams.get("event_id"), `eq.${event}`);
      assert.equal(url.searchParams.get("deleted_at"), "is.null");
      rows = url.searchParams.get("select") === "id" ? Array.from({length:502}, (_,i) => ({id:id(i)}))
        : ids.filter(value => !options.removed || value !== id(501)).map(value => ({id:value,event_id:event,participants:{first_name:"Persona",last_name:value.slice(-3)}}));
    } else if (table === "accessibility_needs") {
      rows = ids.map(value => ({registration_id:value,washington_group_answers: options.empty ? {} : value === id(0) ? {hearing:true,walkingOrSteps:true} : value === id(1) ? {wheelchairOrMobilityAid:true} : [id(500),id(501)].includes(value) ? {walkingOrSteps:true} : {hearing:"true",walkingOrSteps:false,seeing:true}}));
    } else if (table === "groups") {
      assert.equal(url.searchParams.get("event_id"), `eq.${event}`);
      rows = [
        {id:id(1000),name:"Italia",node_type:"country",parent_group_id:null},
        {id:id(1001),name:"Roma",node_type:"city",parent_group_id:id(1000)},
        {id:id(1002),name:"Gruppo omonimo",node_type:"group",parent_group_id:options.broken ? id(9999) : id(1001)},
        {id:id(1003),name:"Gruppo omonimo",node_type:"group",parent_group_id:id(1001)},
      ].map(g=>({...g,event_id:event,is_assignable:true}));
    } else if (table === "participant_group_assignments") {
      assert.equal(url.searchParams.get("is_current"), "eq.true");
      rows = ids.filter(value => value !== id(501)).map(value => ({registration_id:value,group_id:value === id(0) ? id(1001) : value === id(1) ? id(1002) : id(1003)}));
    } else throw Error(`Unexpected source ${table}`);
    return Response.json(rows.slice(start,start+size));
  } } });
  return {db,calls};
}

test("declared difficulties only, no inherited children, hierarchy and person lists agree", async () => {
  const {db,calls}=fixture();
  const result=await loadDisabilityStatistics(db,event);
  assert.equal(result.people.length,4);
  assert.deepEqual(countDeclaredDifficulties(result.people).map(({key,count})=>[key,count]), [["hearing",1],["walkingOrSteps",3],["wheelchairOrMobilityAid",1]]);
  assert.deepEqual(countDeclaredDifficulties([]).map(row=>row.count), [0,0,0]);
  assert.ok(result.people.every(p=>p.kind==="participant"));
  assert.match(result.people.find(p=>p.registrationId===id(0))!.declaredDifficulties,/Sentire.*; Camminare/);
  assert.equal(calls.filter(u=>u.pathname.endsWith("/registrations") && u.searchParams.get("select")==="id").length,2);
  assert.ok(calls.every(u=>u.searchParams.get("order")==="id.asc"));
  assert.ok(calls.filter(u=>u.pathname.endsWith("/registrations") && u.searchParams.get("id")).every(u=>u.searchParams.get("id")?.slice(4,-1).split(",").length===4));
  assert.ok(calls.every(u=>!u.search.includes("registration_children") && !u.pathname.includes("attendance")));
  const tree=buildAssignedGroupTree(result.people);
  const italy=tree.find(r=>r.label==="Italia")!;
  assert.equal(italy.people.length,3);
  const city=italy.children[0];
  assert.equal(city.people.length,3);
  assert.equal(city.children.length,3, "direct city assignment plus two distinct same-name groups");
  for (const row of [italy,city,...city.children,...tree.filter(r=>r!==italy)]) {
    assert.equal(filterStatisticsPeople(result.people,row.filter).length,row.people.length);
  }
  assert.equal(filterStatisticsPeople(result.people,{}).length,4,"all includes unassigned people");
});
test("no declared difficulties skips names, assignments and hierarchy", async () => {
  const {db,calls}=fixture({empty:true});
  assert.deepEqual(await loadDisabilityStatistics(db,event),{people:[]});
  assert.ok(calls.every(u=>u.pathname.endsWith("/registrations") || u.pathname.endsWith("/accessibility_needs")));
  assert.ok(calls.filter(u=>u.pathname.endsWith("/registrations")).every(u=>u.searchParams.get("select")==="id"));
});
for(const table of ["registrations","accessibility_needs","groups","participant_group_assignments"]) test(`failed ${table} reads never produce partial counts`,async()=>{
  await assert.rejects(loadDisabilityStatistics(fixture({fail:table}).db,event),/synthetic failure/);
});
test("missing ancestors fail closed and registrations deleted between reads are excluded", async()=>{
  await assert.rejects(loadDisabilityStatistics(fixture({broken:true}).db,event),/Incomplete/);
  assert.equal((await loadDisabilityStatistics(fixture({removed:true}).db,event)).people.length,3);
});


test("people table combines explicit difficulties with exact group IDs and sorts without mutating its source", async () => {
  const { people } = await loadDisabilityStatistics(fixture().db, event);
  const before = people.map(person => person.registrationId);
  const base = { difficulty: "", group: "", sort: "name", direction: "asc" } as const;
  assert.deepEqual(filterAndSortDisabilityPeople(people, base).map(p=>p.registrationId), [id(0),id(1),id(500),id(501)]);
  assert.deepEqual(filterAndSortDisabilityPeople(people, {...base,direction:"desc"}).map(p=>p.registrationId), [id(501),id(500),id(1),id(0)]);
  assert.deepEqual(filterAndSortDisabilityPeople(people, {...base,difficulty:"hearing"}).map(p=>p.registrationId), [id(0)]);
  assert.equal(filterAndSortDisabilityPeople(people, {...base,difficulty:"walkingOrSteps"}).length, 3);
  const group = people.find(p=>p.registrationId === id(1))!.assignedGroupKey;
  assert.deepEqual(filterAndSortDisabilityPeople(people, {...base,difficulty:"wheelchairOrMobilityAid",group}).map(p=>p.registrationId), [id(1)]);
  assert.equal(filterAndSortDisabilityPeople(people, {...base,difficulty:"hearing",group}).length, 0);
  assert.deepEqual(filterAndSortDisabilityPeople(people, {...base,group:"missing-group"}).map(p=>p.registrationId), [id(501)]);
  const options = disabilityGroupOptions(people);
  const sameName = options.filter(option=>option.label.includes("Gruppo omonimo"));
  assert.equal(sameName.length,2);
  assert.notEqual(sameName[0].key,sameName[1].key);
  assert.notEqual(sameName[0].label,sameName[1].label);
  for (const sort of ["group","difficulty"] as const) {
    assert.deepEqual(filterAndSortDisabilityPeople(people,{...base,sort}).map(p=>p.registrationId).toSorted(), before.toSorted());
  }
  assert.deepEqual(people.map(p=>p.registrationId),before);
});


test("click filters round-trip and count only explicit participant declarations, never children", async () => {
  const {people} = await loadDisabilityStatistics(fixture().db,event);
  const base = {...buildEventStatisticsSnapshot({participants:[],groups:[],attendanceChoices:[]}), people: [
    ...people.map(person => ({ ...person, difficultyKeys: undefined })),
    {...people[0],id:"child",kind:"child" as const},
  ]};
  const {db,calls} = fixture();
  const enriched = await withStatisticsDifficulties(db,base);
  for (const {key,count} of countDeclaredDifficulties(people)) {
    const filter = parseStatisticsDrilldown(serializeStatisticsDrilldown({difficulty:key}))!;
    assert.equal(filterStatisticsPeople(enriched.people,filter).length,count);
    assert.match(describeStatisticsDrilldown(filter,[]), /Difficoltà dichiarata:/);
  }
  assert.ok(calls.every(url=>url.pathname.endsWith("/accessibility_needs")));
  assert.equal(base.people[0].difficultyKeys, undefined, "source remains unchanged");
  assert.equal(filterStatisticsPeople(enriched.people,{difficulty:"hearing",personKind:"child"}).length,0);
  assert.throws(()=>parseStatisticsDrilldown("kind=all&difficulty=bad"),/non valido/);
  assert.throws(()=>parseStatisticsDrilldown("difficulty=hearing&difficulty=walkingOrSteps"),/non valido/);
  await assert.rejects(withStatisticsDifficulties(fixture({fail:"accessibility_needs"}).db,base), /synthetic failure/);
});
