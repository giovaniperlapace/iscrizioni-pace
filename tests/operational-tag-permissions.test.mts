import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
const source = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
const code = source.slice(source.indexOf("export async function updateParticipantOperationalTags"),source.indexOf("export async function saveEventService")).replace("export async", "async");
const js = ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
for (const role of ["capogruppo","manager_viewer","accoglienza","partecipante"]) test(`${role} cannot assign tags even with a forged manager form`,async()=>{
 for(const dashboard of ["capogruppo","manager","admin"]) {
  const deps = { optionalText:(x:unknown)=>typeof x==="string"?x:null,createSupabaseServerClient:async()=>({}),getCurrentAuthContext:async()=>({user:{id:"actor"},eventRoles:[{role,eventId:"event"}]}),
   createSupabaseServiceClient:()=>{throw Error("unauthorized database access");},formFailureFromRedirect:(path:string)=>path };
  const run=new Function(...Object.keys(deps),`${js};return updateParticipantOperationalTags`)(...Object.values(deps));
  const form=new FormData();Object.entries({participantId:"participant",eventId:"event",sourceDashboard:dashboard,tagIds:"tag"}).forEach(([k,v])=>form.set(k,v));
  assert.match(await run(form),/forbidden/);
 }
});
test("leader payload and table/export preferences do not expose tag catalog",()=>{
 const loader=readFileSync(new URL("../lib/groups/leader-data.server.ts",import.meta.url),"utf8");
 const page=readFileSync(new URL("../app/dashboard/capogruppo/page.tsx",import.meta.url),"utf8");
 assert.doesNotMatch(loader,/participant_operational_tags/);
 assert.doesNotMatch(page,/updateParticipantOperationalTags|TagCheckboxGrid|getOperationalTags/);
});
