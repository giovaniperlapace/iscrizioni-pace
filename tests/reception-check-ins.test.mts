import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeReceptionCommand, projectReceptionResult } from "../lib/reception/check-in.server.ts";
import { parseReceptionCommand } from "../lib/reception/contracts.ts";
import { hashQrToken } from "../lib/qrcode/token.ts";

const id = "11111111-1111-4111-8111-111111111111";
const token = "a".repeat(43);
const inspect = { lookup: {kind:"qr",value:token}, action:"inspect" };
const enter = { ...inspect, action:"enter",requestId:id,subjectIds:[id] };
const family = {status:"valid",kind:"family",revision:0,outcome:"verified",registrationStatus:"confirmed",code:"AB12",
  persons:[{id,kind:"adult",firstName:"Synthetic",lastName:"Test",checkedInAt:null}]};

function fixture({role="accoglienza", roleEvent="event", user="operator", fail="", result:response=family as unknown, errorCode=""}={}) {
  const calls: { table:string; filters:[string,unknown][] }[]=[];
  const rpcCalls: Record<string,unknown>[]=[];
  let services=0;
  const session = {
    auth:{getUser: async()=>({data:{user:user?{id:user}:null},error:fail==="auth"?{}:null})},
    from(table:string) {
      const call={table,filters:[] as [string,unknown][]};calls.push(call);
      const result = () => ({data:table==="events"?{id:"event"}:[{role,event_id:roleEvent === "global" ? null : roleEvent}],error:fail===table?{message:"private error"}:null});
      return {select(){return this;},eq(key:string,value:unknown){call.filters.push([key,value]);return this;},
        maybeSingle:async()=>result(),then(resolve:(value:unknown)=>unknown){return Promise.resolve(result()).then(resolve);}};
    },
  } as unknown as SupabaseClient;
  const service=()=>{
    services++;
    return {rpc:async(name:string,args:Record<string,unknown>)=>{
      assert.equal(name,"reception_check_in");rpcCalls.push(args);
      if(fail==="throw") throw new Error(`secret ${token}`);
      return {data:response,error:errorCode?{code:errorCode,message:`secret ${token}`,details:"private"}:null};
    }} as unknown as SupabaseClient;
  };
  return {session,service,calls,rpcCalls,get services(){return services;}};
}

test("reception parser accepts bare opaque QR and normalizes exact public code",()=>{
  assert.deepEqual(parseReceptionCommand(inspect),inspect);
  assert.deepEqual(parseReceptionCommand({lookup:{kind:"code",value:" ab12 "},action:"inspect"}),{lookup:{kind:"code",value:"AB12"},action:"inspect"});
  assert.deepEqual(parseReceptionCommand(enter),enter);
});
test("reception rejects URLs, oversized values, forged identity and unsafe correction payloads",()=>{
  for(const input of [null,{}, {...enter,action:["enter"]},{...enter,reason:["selection_error"]},{...inspect,lookup:{kind:["qr"],value:token}}, {...inspect,actorUserId:id}, {...inspect,eventId:id},
    {...inspect,lookup:{kind:"qr",value:`https://example.invalid/${token}`}},
    {...inspect,lookup:{kind:"qr",value:"a".repeat(10000)}},
    {...inspect,lookup:{kind:"code",value:"A%"}}, {...inspect,reason:"private free text"},
    {...enter,requestId:"bad"}, {...enter,subjectIds:[id,id]}, {...enter,subjectIds:[null]},
    {...enter,action:"correct"}, {...enter,action:"cancel",expectedRevision:0},
    {...enter,students:-1},{...enter,students:1.1},{...enter,companions:101},
    {...enter,expectedRevision:NaN}, {...enter,reason:"private text"},
  ]) assert.equal(parseReceptionCommand(input),null,JSON.stringify(input));
  assert.ok(parseReceptionCommand({...enter,action:"correct",expectedRevision:0,reason:"selection_error"}));
});
test("reception derives verified actor/current event and hashes token before RPC",async()=>{
  const f=fixture(); assert.deepEqual(await executeReceptionCommand(f.session,f.service,inspect),family);
  assert.equal(f.services,1);
  assert.ok(f.calls.find(c=>c.table==="event_user_roles")?.filters.some(([k,v])=>k==="user_id"&&v==="operator"));
  assert.ok(f.calls.find(c=>c.table==="events")?.filters.some(([k,v])=>k==="is_current"&&v===true));
  assert.equal(f.rpcCalls[0].p_actor_user_id,"operator");assert.equal(f.rpcCalls[0].p_event_id,"event");
  assert.equal(f.rpcCalls[0].p_lookup,hashQrToken(token));assert.ok(!JSON.stringify(f.rpcCalls).includes(token));
});
test("reception permits manager/global admin, denies viewer/leader/participant/foreign and event admin",async()=>{
  for (const [role,roleEvent,expected] of [
    ["manager","event","valid"],["admin","global","valid"],["admin","event","forbidden"],
    ["manager_viewer","event","forbidden"],["capogruppo","event","forbidden"],["partecipante","event","forbidden"],
    ["accoglienza","foreign","forbidden"],["manager","foreign","forbidden"],
  ]) {
    const f=fixture({role,roleEvent});
    assert.equal((await executeReceptionCommand(f.session,f.service,inspect)).status,expected);
    assert.equal(f.services,expected==="valid"?1:0);
  }
});
test("session and read failures fail closed without creating a privileged client",async()=>{
  for(const options of [{user:""},{fail:"auth"},{fail:"events"},{fail:"event_user_roles"}]) {
    const f=fixture(options); assert.notEqual((await executeReceptionCommand(f.session,f.service,inspect)).status,"valid");assert.equal(f.services,0);
  }
  const f=fixture();assert.equal((await executeReceptionCommand(f.session,f.service,{...inspect,eventId:"foreign"})).status,"invalid_request");assert.equal(f.services,0);
});
test("RPC failure details and private fields never cross the response boundary",async()=>{
  for(const [errorCode,status] of [["42501","forbidden"],["22023","invalid_request"],["XX000","unavailable"]]) {
    const f=fixture({errorCode});assert.deepEqual(await executeReceptionCommand(f.session,f.service,enter),{status});
  }
  const f=fixture({fail:"throw"});assert.deepEqual(await executeReceptionCommand(f.session,f.service,enter),{status:"unavailable"});
  assert.deepEqual(projectReceptionResult({...family,email:"private",token,persons:family.persons.map(p=>({...p,birthDate:"2018-01-01",phone:"private"}))}),family);
  assert.deepEqual(projectReceptionResult({status:"invalid",token}),{status:"invalid"});
  for(const data of [null,{}, {...family,persons:[]},{...family,revision:-1},{...family,persons:[{...family.persons[0],checkedInAt:"bad"}]}]) {
    assert.deepEqual(projectReceptionResult(data),{status:"unavailable"});
  }
});
test("school projection exposes only aggregate counts, school and class",()=>{
  const school={status:"valid",kind:"school",revision:2,outcome:"saved",registrationStatus:"submitted",
    schoolName:"Test school",classDescription:"Class 1",expectedStudents:10,expectedCompanions:2,students:8,companions:1,checkedInAt:"2026-09-12T12:00:00Z"};
  assert.deepEqual(projectReceptionResult({...school,teacherEmail:"private",internal_notes:"private",token_encrypted:"secret"}),school);
});
test("correction/cancellation forward explicit revision, selected subjects and constrained reason",async()=>{
  const f=fixture();
  const command={...enter,action:"cancel",expectedRevision:3,reason:"entry_cancelled"};
  await executeReceptionCommand(f.session,f.service,command);
  assert.equal(f.rpcCalls[0].p_expected_revision,3);assert.equal(f.rpcCalls[0].p_reason,"entry_cancelled");
  assert.deepEqual(f.rpcCalls[0].p_subject_ids,[id]);assert.equal(f.rpcCalls[0].p_request_id,id);
});
