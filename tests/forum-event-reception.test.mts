import assert from "node:assert/strict";
import test from "node:test";
import { parseDeskRequest } from "../lib/reception/forum-desk.ts";
import { parseReceptionCommand } from "../lib/reception/contracts.ts";
import { projectReceptionResult, executeReceptionCommand } from "../lib/reception/check-in.server.ts";
import { dutySummary } from "../lib/reception/event-duties.ts";
import { ReceptionStationSession } from "../lib/reception/station.ts";
import { isRoleAllowedForDashboard, dashboardRoleFromPath } from "../lib/auth/roles.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
const id="00000000-0000-4000-8000-000000000001";
const other="00000000-0000-4000-8000-000000000002";
const lookup={kind:"code" as const,value:" tst1 "};
test("desk accepts only explicit scoped booking, rejects caller identity, duplicate/foreign shape and group QR",()=>{
 const preview={target:id,lookup,operation:"preview"};
 assert.deepEqual(parseDeskRequest(preview),{...preview,lookup:{kind:"code",value:"TST1"}});
 const book={...preview,operation:"book",option:id,children:[other],request:other};
 assert.ok(parseDeskRequest(book));
 for(const invalid of [{...book,actor:id},{...book,eventId:id},{...book,children:[other,other]},{...book,children:["invalid"]},{...book,request:null},{...preview,option:id},{...preview,target:"event_entry"},{...preview,lookup:{kind:"qr",value:"G:"+"x".repeat(43)}},{...book,target:"opening"}])assert.equal(parseDeskRequest(invalid),null);
 assert.ok(parseDeskRequest({...book,target:"opening",children:[]}));
});
test("ceremony commands cannot use other targets, automatic corrections or school quantities",()=>{
 const command={duty:"ceremony_entry",panelId:"opening",lookup,action:"inspect"};
 assert.ok(parseReceptionCommand(command));
 for(const invalid of [{...command,panelId:id},{...command,students:1},{...command,action:"correct",requestId:id,expectedRevision:0,reason:"selection_error"}])assert.equal(parseReceptionCommand(invalid),null);
 assert.ok(parseReceptionCommand({...command,action:"enter",requestId:id,subjectIds:[other]}));
});
test("all-duties summary requires complete current catalogue and grants no implicit future duty",()=>{
 const choices=[{key:id,title:"Forum 1",room:null,kind:"panel" as const},{key:"opening",title:"Apertura",room:null,kind:"ceremony" as const}];
 assert.equal(dutySummary([id,"opening"],choices),"Tutti gli incarichi");
 assert.equal(dutySummary([id],choices),"Forum 1");
 assert.equal(dutySummary([id,"opening"],[...choices,{key:"closing",title:"Finale",room:null,kind:"ceremony"}]),"Forum 1, Apertura");
 assert.equal(isRoleAllowedForDashboard("accoglienza",new Set(["partecipante"]),true),false);
 assert.equal(isRoleAllowedForDashboard("accoglienza_forum_eventi",new Set(["partecipante"]),true),true);
 assert.equal(dashboardRoleFromPath("/dashboard/accoglienza-forum-eventi"),"accoglienza_forum_eventi");
});
test("wrong-Forum message exposes routing only, and scans cannot record entry",async()=>{
 const response=projectReceptionResult({status:"not_booked",routes:[{title:"Forum 2",room:"Sala B",email:"private"}],registrationId:id});
 assert.deepEqual(response,{status:"not_booked",routes:[{title:"Forum 2",room:"Sala B"}]});
 assert.deepEqual(projectReceptionResult({status:"not_booked",routes:[{title:"X",room:7}]}),{status:"unavailable"});
 const calls:string[]=[];
 const session=new ReceptionStationSession(async command=>{calls.push(command.action);return response;},()=>id,20000,{duty:"panel_entry",panelId:id},true);
 await session.inspect(lookup);
 assert.deepEqual(calls,["inspect"]);
 assert.match(session.snapshot().message,/Non è prenotato per questo Forum.*Forum 2.*Sala B/);
 assert.equal(session.snapshot().result,null);
});
test("assigned Forum operator needs no general reception role, but cannot use the event scanner",async()=>{
 const calls:string[]=[];
 const session={auth:{getUser:async()=>({data:{user:{id:"operator"}},error:null})},from(table:string){
 const data=table==="events"?{id:"event"}:table==="panel_reception_assignments"?{id:"duty"}:[];
 return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data,error:null}),then(resolve:(x:unknown)=>unknown){return Promise.resolve({data,error:null}).then(resolve);}};
 }} as unknown as SupabaseClient;
 const service=()=>({rpc:async(name:string)=>{calls.push(name);return {data:{status:"invalid"},error:null};}}) as unknown as SupabaseClient;
 assert.equal((await executeReceptionCommand(session,service,{duty:"panel_entry",panelId:id,lookup,action:"inspect"})).status,"invalid");
 assert.deepEqual(calls,["reception_panel_check_in"]);
 assert.equal((await executeReceptionCommand(session,service,{duty:"event_entry",lookup,action:"inspect"})).status,"forbidden");
 assert.equal(calls.length,1);
});
