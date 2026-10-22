import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { parseCeremonyForm } from "../lib/ceremonies/contracts.ts";
import { isCeremonyManager } from "../lib/ceremonies/access.server.ts";
import { executeCeremony } from "../lib/ceremonies/service.ts";
const id = "11111111-1111-4111-8111-111111111111";
const session = (role: string, event = "event") => ({
 auth:{getUser:async()=>({data:{user:{id:"actor"}},error:null})},
 from(){const c={select:()=>c,eq:()=>c,maybeSingle:async()=>({data:{id:"event",title:"Synthetic"},error:null}),then:(resolve:(v:unknown)=>unknown)=>resolve({data:[{role,event_id:role==="admin"?null:event}],error:null})};return c;},
});
test("ceremony rollout admits current Manager and global Admin, excludes Viewer and foreign Manager", async()=>{
 for(const [role,event,expected] of [["admin","foreign",true],["manager","event",true],["manager","foreign",false],["manager_viewer","event",false],["capogruppo","event",false]] as const)
 assert.equal(await isCeremonyManager(session(role,event) as never),expected);
});
test("direct child selection remains explicit and cannot target a group or malformed identity",()=>{
 const f=new FormData();Object.entries({kind:"opening",operation:"allocate",revision:"1",id,quotaId:id,registrationId:id,quantity:"1"}).forEach(([k,v])=>f.set(k,v));
 assert.equal(parseCeremonyForm(f)?.data.childId,"");
 f.set("childId",id);assert.equal(parseCeremonyForm(f)?.data.childId,id);
 f.set("childId","choose");assert.equal(parseCeremonyForm(f),null);
 f.set("childId",id);f.delete("registrationId");f.set("groupId",id);assert.equal(parseCeremonyForm(f),null);
});
test("only Admin may initialize opening layout; closing and Manager cannot reach service",async()=>{
 const f=new FormData();Object.entries({kind:"opening",operation:"opening_layout",revision:"-1"}).forEach(([k,v])=>f.set(k,v));
 assert.equal((await executeCeremony(session("manager") as never,()=>{throw Error("service bypass");},f)).status,"forbidden");
 let called="";
 assert.equal((await executeCeremony(session("admin") as never,()=>({rpc:async(name:string,args:Record<string,unknown>)=>{called=name;assert.equal(args.p_actor,"actor");assert.equal(args.p_event,"event");return {data:{status:"saved"},error:null};}}) as never,f)).status,"saved");
 assert.equal(called,"prepare_opening_ceremony_layout");f.set("kind","closing");assert.equal(parseCeremonyForm(f),null);
});
test("actual shared actions retain the leader pilot and use current-event Manager gate for management",async()=>{
 for(const [file,managerSave,leaderSave,managerRead,leaderRead] of [
  ["ceremony-map-actions.ts","saveManagerMap","saveLeaderMap","refreshManagerMap","refreshLeaderMap"],
  ["ceremony-distribution-actions.ts","saveManagerNominee","saveLeaderNominee","refreshManagerDistribution","refreshLeaderDistribution"],
 ]) {
  const source=ts.transpileModule(readFileSync(new URL(`../app/dashboard/${file}`,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const gates:string[]=[];let mode="";
  const pass=async(_db:unknown,_service:unknown,m:string)=>{mode=m;return {status:"saved"};};
  const deps:Record<string,unknown>={
   "next/cache":{revalidatePath:()=>{}},
   "@/lib/ceremonies/access.server":{createCeremonyManagerClient:async()=>{gates.push("manager");return {};}},
   "@/lib/reception/admin-pilot.server":{createAdminPilotClient:async()=>{gates.push("pilot");return {};}},
   "@/lib/supabase/service":{createSupabaseServiceClient:()=>({})},
   "@/lib/ceremonies/seat-map.server":{executeSeatMap:pass,loadSeatMap:pass},
   "@/lib/ceremonies/distribution.server":{executeNominee:pass,loadDistribution:pass},
  };
  const exported:Record<string,(input:unknown)=>Promise<unknown>>={};new Function("require","exports",source)((name:string)=>{assert.ok(name in deps,name);return deps[name];},exported);
  for(const [name,gate,expectedMode] of [[managerSave,"manager","manager"],[leaderSave,"pilot","leader"],[managerRead,"manager","manager"],[leaderRead,"pilot","leader"]]) {
   await exported[name]({});assert.equal(gates.at(-1),gate);assert.equal(mode,expectedMode);
  }
 }
});


// All user-facing seat references share this parser, including QR summaries.
import { openingSeatAddress, ceremonySeatLabel } from "../lib/ceremonies/seat-label.ts";
import { ceremonySeatRanges } from "../lib/ceremonies/group-seat-summary.ts";
test("E rear blocks have distinct addresses and QR ranges without changing row/chair numbers",()=>{
 for (const block of [7,8]) {
  assert.deepEqual(openingSeatAddress(`E-b${block}-r07`),{block,row:7,key:`E-b${block}`});
  assert.equal(ceremonySeatLabel('E',{row:`E-b${block}-r07`,number:'10'}),`Settore E · Blocco ${block} · Fila 7 · Sedia 10`);
 }
 assert.equal(openingSeatAddress('A-b7-r01'),null);
 assert.deepEqual(ceremonySeatRanges('E',[{row:'E-b7-r01',number:'1'},{row:'E-b7-r01',number:'2'},{row:'E-b8-r01',number:'1'}]),[
  'Settore E · Blocco 7 · Fila 1 · Sedie 1–2','Settore E · Blocco 8 · Fila 1 · Sedia 1']);
});
