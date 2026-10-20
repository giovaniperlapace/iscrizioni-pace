import * as childSelection from "../lib/panels/child-selection.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as bookings from "../lib/panels/group-bookings.ts";
import { GROUP_WAITLIST_COPY } from "../lib/panels/group-waitlist-copy.ts";
import { renderForumWaitlistEmail, type ForumWaitlistOffer } from "../lib/panels/waitlist-email.ts";
const id="11111111-1111-4111-8111-111111111111";
const offer: ForumWaitlistOffer={id,claim:id,eventId:id,registrationId:id,panelId:id,sectionId:id,notificationKind:"leader",name:"Synthetic <person>",email:"leader@example.invalid",locale:"it",title:"Forum",location:"Room",startsAt:"2026-10-26T16:00:00+01:00",endsAt:"2026-10-26T17:00:00+01:00",expiresAt:"2026-10-17T12:30:00+02:00",seats:2};
function load(file: string,deps: Record<string, unknown>,extra:Record<string,unknown>={}) {
  const code=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports:Record<string, (...args:never[])=>unknown>={};
  new Function("require","exports",...Object.keys(extra),code)((name:string)=>{assert.ok(name in deps,name);return deps[name];},exports,...Object.values(extra));
  return exports;
}
for(const locale of ["it","en","fr","de","es","nl","uk"] as const) test(`leader email in ${locale} identifies participant and opens scoped dashboard without accepting`,()=>{
  const email=renderForumWaitlistEmail({...offer,locale},"https://example.invalid");
  assert.equal(email.subject,GROUP_WAITLIST_COPY[locale].emailSubject);
  assert.ok(email.text.includes(GROUP_WAITLIST_COPY[locale].swap));
  assert.ok(email.text.includes(GROUP_WAITLIST_COPY[locale].emailAccess));
  assert.match(email.text,new RegExp(`/dashboard/capogruppo/panel\\?section=${id}`));
  assert.match(email.text,/Synthetic <person>/);assert.match(email.html,/Synthetic &lt;person&gt;/);
  assert.doesNotMatch(email.html,/token=|claim=|accept=|registrationId=/);
  assert.match(email.text,/30/);assert.match(email.text,/Europe\/Rome/);
});
test("leader email requires a valid section instead of falling back to a personal booking",()=>{
  assert.throws(()=>renderForumWaitlistEmail({...offer,sectionId:undefined},"https://example.invalid"));
  assert.throws(()=>renderForumWaitlistEmail({...offer,sectionId:"//evil.invalid"},"https://example.invalid"));
});
for(const scenario of ["join","leave","accept","expired","available","revoked","closed","invalid","unknown-result"] as const) test(`group waitlist action validates ${scenario} and uses current event and authenticated actor`,async()=>{
  const calls: {name:string;args:Record<string,unknown>}[]=[];
  const deps={
    "@/lib/panels/child-selection":childSelection,
    "@/lib/panels/release.server":{requirePublicPanelBookings:async()=>{if(scenario==="closed")throw new Error("closed");}},
    "@/lib/i18n/server":{getRequestLocale:async()=>"fr"},
    "next/cache":{revalidatePath:()=>{}},
    "@/lib/auth/session":{getCurrentAuthContext:async()=>scenario==="revoked"?null:{dashboardRole:"capogruppo"}},
    "@/lib/events/current":{getCurrentOperationalEventId:async()=>id},
    "@/lib/panels/group-bookings":bookings,
    "@/lib/supabase/server":{createSupabaseServerClient:async()=>({rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return {data:{status:scenario==="join"?"queued":scenario==="leave"?"left":scenario==="accept"?"booked":scenario},error:null};}})},
  };
  const action=load("app/dashboard/capogruppo/panel/actions.ts",deps).setGroupPanelWaitlist as (s:string,r:string,i:string)=>Promise<unknown>;
  if(scenario==="closed"){await assert.rejects(action(id,id,"join"),/closed/);assert.equal(calls.length,0);return;}
  const result=await action(id,id,scenario==="invalid"?"force":scenario==="leave"?"leave":scenario==="accept"?"accept":"join");
  if(scenario==="revoked"||scenario==="invalid"){assert.equal(calls.length,0);assert.deepEqual(result,{error:scenario==="revoked"?"scopeError":"failure"});return;}
  assert.equal(calls[0].name,"set_panel_family_booking");
  assert.deepEqual(Object.keys(calls[0].args).sort(),["p_as_leader","p_child_ids","p_intent","p_locale","p_panel_id","p_registration_id","p_section_id"]);
  assert.equal(calls[0].args.p_as_leader,true);assert.deepEqual(calls[0].args.p_child_ids,[]);assert.equal(calls[0].args.p_locale,"fr");
  if(scenario==="expired"||scenario==="available"||scenario==="unknown-result")assert.deepEqual(result,{error:scenario==="expired"?"expired":scenario==="available"?"availableNow":"failure"});
});
for(const scenario of ["unauthenticated","role","closed","invalid","revoked","failed","withdrawn","ok"] as const)test(`group availability ${scenario} is private and scoped`,async()=>{
  let calls=0;
  const route=load("app/dashboard/capogruppo/panel/availability/route.ts",{
    "next/server":{NextResponse:{json:(data:unknown,options:ResponseInit)=>Response.json(data,options)}},
    "@/lib/auth/session":{getCurrentAuthContext:async()=>scenario==="unauthenticated"?null:{dashboardRole:scenario==="role"?"manager_viewer":"capogruppo"}},
    "@/lib/events/current":{getCurrentOperationalEventId:async()=>id},
    "@/lib/panels/group-bookings":bookings,
    "@/lib/panels/release":{getPanelReleaseMode:async()=>scenario==="closed"?"internal":"open"},
    "@/lib/supabase/server":{createSupabaseServerClient:async()=>({rpc:async(_name:string,args:Record<string,unknown>)=>{
      calls++;assert.equal(args.p_event_id,id);
      if(scenario==="revoked"||scenario==="failed"||(scenario==="withdrawn"&&calls===1))return {error:{code:scenario==="revoked"?"42501":scenario==="withdrawn"?"22023":"XX000",message:"private secret"}};
      if(scenario==="withdrawn")assert.equal(args.p_section_id,null);
      return {data:{panels:[],participants:[]}};
    }})},
  }).GET as (r:Request)=>Promise<Response>;
  const response=await route(new Request(`http://127.0.0.1/panel/availability?section=${scenario==="invalid"?"bad":id}`));
  assert.equal(response.status,({unauthenticated:401,role:403,closed:403,invalid:400,revoked:403,failed:500,withdrawn:200,ok:200})[scenario]);
  assert.equal(response.headers.get("Cache-Control"),"private, no-store");
  assert.doesNotMatch(await response.text(),/private secret/);
  assert.equal(calls,scenario==="withdrawn"?2:["revoked","failed","ok"].includes(scenario)?1:0);
});
for(const paused of [true,false])test(`group polling pauses during mutations (${paused}), prevents overlap and aborts on cleanup`,async()=>{
  let effect:(()=>void)|undefined,callback:(()=>void)|undefined,cleared=false,aborted=false,reads=0;
  let release:((v:unknown)=>void)|undefined;
  const hook=load("lib/panels/use-group-forum-availability.ts",{react:{useState:(v:unknown)=>[v,()=>{}],useEffect:(fn:()=>void)=>{effect=fn;}}},{
    window:{setInterval:(fn:()=>void,ms:number)=>{assert.equal(ms,300000);callback=fn;return 1;},clearInterval:()=>{cleared=true;}},
    fetch:(_url:string,options:{signal:AbortSignal})=>{reads++;options.signal.addEventListener("abort",()=>{aborted=true;});return new Promise(resolve=>{release=resolve;});},
  }).useGroupForumAvailability as (v:unknown,s:string,p:boolean)=>unknown;
  hook({panels:[],participants:[]},id,paused);const cleanup=effect!() as unknown as ()=>void;
  if(paused){assert.equal(callback,undefined);return;}
  callback!();callback!();assert.equal(reads,1);
  release!({ok:true,json:async()=>({view:{panels:[],participants:[]}})});
  await new Promise(resolve=>setTimeout(resolve,0));callback!();assert.equal(reads,2);
  cleanup();assert.ok(cleared);assert.ok(aborted);
});
