import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseReceptionCommand, type ReceptionCommand, type ReceptionResult } from "../lib/reception/contracts.ts";
import { executeReceptionCommand } from "../lib/reception/check-in.server.ts";
import { ReceptionStationSession } from "../lib/reception/station.ts";
import { isDutyAvailable } from "../lib/reception/duty-windows.ts";
import { REGISTRATION_CHECK_DUTY, validDutyKey } from "../lib/reception/event-duties.ts";
import { createForumReceptionDemo } from "../lib/reception/forum-demo.ts";
import { DEMO_EVENT } from "../lib/reception/demo-samples.ts";
import { hashQrToken } from "../lib/qrcode/token.ts";
const token="a".repeat(43);
const command:ReceptionCommand={duty:"registration_check",action:"inspect",lookup:{kind:"qr",value:token}};
const result:ReceptionResult={status:"valid",kind:"family",outcome:"verified",registrationStatus:"confirmed",revision:0,code:"AB12",persons:[{id:"registration",kind:"adult",firstName:"Test",lastName:"Person",checkedInAt:null}]};
test("verification only accepts inspections without write fields, groups or target",()=>{
 assert.deepEqual(parseReceptionCommand(command),command);
 for(const action of ["enter","correct","cancel"]) assert.equal(parseReceptionCommand({...command,action,requestId:"11111111-1111-4111-8111-111111111111",subjectIds:[]}),null);
 for(const fields of [{panelId:"opening"},{students:1},{subjectIds:[]},{expectedRevision:0},{actor:"user"},{lookup:{kind:"qr",value:`G:${token}`}}]) assert.equal(parseReceptionCommand({...command,...fields}),null);
 assert.equal(validDutyKey("registration_check"),false);
 for(const now of [0,Date.parse("2026-10-24"),Date.parse("2026-10-28"),Date.parse("2030-01-01")]) assert.equal(isDutyAvailable(REGISTRATION_CHECK_DUTY,now),true);
});
test("server uses only read RPC with verified event/actor and hashed QR; session, stale event and writes denied",async()=>{
 const calls:unknown[]=[];
 let user:string|null="operator";
 const session={auth:{getUser:async()=>({data:{user:user?{id:user}:null},error:null})},from:(table:string)=>{assert.equal(table,"events");return {select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:"event"},error:null})};}} as unknown as SupabaseClient;
 const service=()=>({rpc:async(name:string,args:unknown)=>{calls.push([name,args]);return {data:result,error:null};}} as unknown as SupabaseClient);
 assert.deepEqual(await executeReceptionCommand(session,service,command,"event"),result);
 assert.deepEqual(calls,[["reception_registration_check",{p_event:"event",p_actor:"operator",p_kind:"qr",p_value:hashQrToken(token)}]]);
 assert.equal((await executeReceptionCommand(session,service,command,"old-event")).status,"forbidden");
 assert.equal((await executeReceptionCommand(session,service,{...command,action:"enter"})).status,"invalid_request");
 user=null;assert.equal((await executeReceptionCommand(session,service,command)).status,"forbidden");assert.equal(calls.length,1);
});
test("station never automatically enters or exposes selection, correction or cancellation in verification",async()=>{
 for(const explicit of [false,true]) {
  const calls:ReceptionCommand[]=[];
  const station:ReceptionStationSession=new ReceptionStationSession(async (c:ReceptionCommand):Promise<ReceptionResult>=>{calls.push(c);return result;},()=>"request",1000,{duty:"registration_check"},explicit);
  await station.inspect(command.lookup);
  assert.equal(station.snapshot().phase,"result");
  station.selectPresence();station.setMode("cancel");await station.editCurrent();await station.removeCurrent();await station.submit({subjectIds:["registration"]},true);
  assert.equal(station.snapshot().phase,"result");assert.equal(station.snapshot().mode,"enter");
  assert.deepEqual(calls,[command]);
  if(explicit){await station.inspectNext({kind:"code",value:"AB12"});assert.equal(calls.length,2);assert.ok(calls.every(c=>c.action==="inspect"));}
 }
});
test("demo shows badge received, missing and invalid without recording an entry",async()=>{
 const demo=createForumReceptionDemo();
 for(const [code,expected] of [["F001","received"],["F009","missing"],["F008","invalid"]]) {
  const value=await demo.request(DEMO_EVENT,{operation:"scan",command:{...command,lookup:{kind:"code",value:code}}});
  if(expected==="invalid")assert.equal(value.status,"invalid");
  else {assert.ok(value.status==="valid"&&"kind" in value&&value.kind==="family");assert.equal(!!value.persons[0].checkedInAt,expected==="received");}
 }
});
