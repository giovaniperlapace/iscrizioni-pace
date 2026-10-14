import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { isAdminReceptionPilot } from "../lib/reception/admin-pilot.server.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
test("reception pilot accepts only global Admin, with cumulative roles and fail-closed reads", async()=>{
  for(const role of ["admin","manager","manager_viewer","accoglienza","capogruppo",null]){
    const session={auth:{getUser:async()=>({data:{user:role?{id:"actor"}:null},error:null})},from:()=>({select:()=>({eq:async()=>({data:[{role,event_id:role==="admin"?null:"event"}],error:null})})})} as unknown as SupabaseClient;
    assert.equal(await isAdminReceptionPilot(session),role==="admin");
  }
});
test("real reception actions reject non-Admin before scanner or badge service, even for forged direct calls",async()=>{
  const source=ts.transpileModule(readFileSync(new URL('../app/dashboard/accoglienza/actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  let allowed=false,scans=0,services=0;
  const deps:Record<string,unknown>={
    '@/lib/reception/admin-pilot.server':{isAdminReceptionPilot:async()=>allowed},
    '@/lib/reception/check-in.server':{executeReceptionCommand:async()=>{scans++;return {status:'invalid'};}},
    '@/lib/supabase/server':{createSupabaseServerClient:async()=>({})},
    '@/lib/supabase/service':{createSupabaseServiceClient:()=>{services++;return {}; }},
  };
  const exported:{receptionCheckIn?:(event:string,input:unknown)=>Promise<{status:string}>;groupBadgeCommand?:(input:unknown)=>Promise<{status:string}>}={};
  new Function('require','exports',source)((name:string)=>{assert.ok(name in deps);return deps[name];},exported);
  assert.equal((await exported.receptionCheckIn!('forged-event',{action:'enter'})).status,'forbidden');
  assert.equal((await exported.groupBadgeCommand!({action:'prepare'})).status,'forbidden');assert.equal(scans,0);assert.equal(services,0);
  allowed=true;assert.equal((await exported.receptionCheckIn!('event',{action:'inspect'})).status,'invalid');assert.equal(scans,1);
});
