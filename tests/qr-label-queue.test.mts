import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseLabelCommand } from "../lib/reception/qr-labels.ts";
import { executeLabelCommand } from "../lib/reception/qr-labels.server.ts";
import { renderQrLabelsHtml } from "../lib/qrcode/print-label.ts";
import { QR_LABEL_SAMPLES } from "../lib/qrcode/print-samples.ts";
import { encryptQrToken } from "../lib/qrcode/secure-token.ts";
import { hashQrToken } from "../lib/qrcode/token.ts";
const id = "11111111-1111-4111-8111-111111111111", req = "22222222-2222-4222-8222-222222222222";
const snapshot = "a".repeat(64);
test("label commands reject forged fields, mixed scope, duplicate IDs and implicit retry", () => {
  assert.ok(parseLabelCommand({ registrationId:id, action:"read" }));
  const valid = { groupId:id, action:"print", ids:[id], snapshot, requestId:req, profile:"continuous-29x45" };
  assert.ok(parseLabelCommand(valid));
  for (const patch of [{actor:id},{groupId:undefined},{registrationId:id},{ids:[id,id]},{profile:"fake"},{snapshot:"bad"},{requestId:undefined}]) assert.equal(parseLabelCommand({...valid,...patch}),null);
  assert.equal(parseLabelCommand({registrationId:id,action:"read",ids:[id]}),null);
});
function session(role: string | null) {
  return { auth:{ getUser:async()=>({ data:{user:role?{id}:null},error:null }) }, from:(table:string)=>{
    const q={ select:()=>q, eq:()=>q, maybeSingle:async()=>({data:{id:"event"},error:null}),
      then:(resolve:(v:unknown)=>void)=>resolve({data:table==="event_user_roles"?[{role,event_id:role==="admin"?null:"event"}]:[],error:null}) }; return q;
  } } as unknown as SupabaseClient;
}
test("global Admin and current reception reach label service; missing migration fails visibly", async()=>{
  for(const role of [null,"manager","manager_viewer","capogruppo"]){
    let services=0;
    assert.equal((await executeLabelCommand(session(role),()=>{services++;throw Error();},{registrationId:id,action:"read"})).status,"forbidden");
    assert.equal(services,0);
  }
  const db={rpc:async()=>({data:null,error:{code:"PGRST202"}})} as unknown as SupabaseClient;
  for (const role of ["admin", "accoglienza"]) assert.equal((await executeLabelCommand(session(role),()=>db,{registrationId:id,action:"read"})).status,"migration_required");
});
test("queue projection removes credentials; rendering precedes atomic claim, conflicts never print",async(t)=>{
  const before=process.env.QR_TOKEN_ENCRYPTION_SECRET;process.env.QR_TOKEN_ENCRYPTION_SECRET="synthetic-label-test";
  t.after(()=>{if(before===undefined)delete process.env.QR_TOKEN_ENCRYPTION_SECRET;else process.env.QR_TOKEN_ENCRYPTION_SECRET=before;});
  const sample=QR_LABEL_SAMPLES[0];
  const row={registrationId:id,name:"Ada Mori",code:"TEST-101",firstName:"Ada",lastName:"Mori",reason:null,state:"pending",attempts:0,outcome:null,content:"b".repeat(64),printedContent:null,encrypted:encryptQrToken(sample.token),hash:hashQrToken(sample.token)};
  const calls:string[]=[];let claim="claimed";
  const db={rpc:async(_name:string,args:{p_action:string})=>{calls.push(args.p_action);return {data:args.p_action==="read"?{status:"queue",snapshot,items:[row]}:{status:claim},error:null};}} as unknown as SupabaseClient;
  const read=await executeLabelCommand(session("admin"),()=>db,{registrationId:id,action:"read"});
  assert.equal(read.status,"queue");assert.ok(!JSON.stringify(read).includes(row.encrypted));assert.ok(!JSON.stringify(read).includes(row.hash));
  const c={registrationId:id,action:"print",ids:[id],snapshot,requestId:req,profile:"continuous-29x45"};
  const printed=await executeLabelCommand(session("admin"),()=>db,c);assert.equal(printed.status,"document");assert.deepEqual(calls.slice(-2),["read","print"]);
  claim="conflict";assert.equal((await executeLabelCommand(session("admin"),()=>db,c)).status,"conflict");
  row.encrypted="bad";calls.length=0;assert.equal((await executeLabelCommand(session("admin"),()=>db,c)).status,"conflict");assert.deepEqual(calls,["read"]);
});
test("multipage documents retain distinct QR symbols, complete names and separate media profiles",async()=>{
  const html=await renderQrLabelsHtml(QR_LABEL_SAMPLES,"continuous-29x45");
  assert.equal((html.match(/<article /g)??[]).length,4);assert.match(html,/size:29mm 45mm/);assert.match(html,/height:44mm/);assert.ok(!html.includes('class="marks"'));
  for(const sample of QR_LABEL_SAMPLES){ assert.ok(html.includes(sample.participant.first_name));assert.ok(!html.includes(sample.token)); }
  assert.equal(new Set([...html.matchAll(/<path d="([^"]+)" fill="black"/g)].map(m=>m[1])).size,4);
  const legacy=await renderQrLabelsHtml(QR_LABEL_SAMPLES.slice(0,1),"die-cut-29x90");assert.match(legacy,/size:29mm 90mm/);assert.match(legacy,/class="marks"/);
});
test("group label responses omit deleted registrations and reject forged reprints without claiming", async(t)=>{
  const before=process.env.QR_TOKEN_ENCRYPTION_SECRET;
  process.env.QR_TOKEN_ENCRYPTION_SECRET="synthetic-deleted-label-test";
  t.after(()=>{if(before===undefined)delete process.env.QR_TOKEN_ENCRYPTION_SECRET;else process.env.QR_TOKEN_ENCRYPTION_SECRET=before;});
  const token=QR_LABEL_SAMPLES[0].token;
  const active={registrationId:id,name:"Ada Mori",code:"TEST-101",firstName:"Ada",lastName:"Mori",reason:null,state:"pending",attempts:0,outcome:null,content:"b".repeat(64),printedContent:null,encrypted:encryptQrToken(token),hash:hashQrToken(token)};
  const cancelledId="33333333-3333-4333-8333-333333333333";
  const rows=[active,{...active,registrationId:req,name:"Nome eliminato di prova",code:"HIDE",reason:"deleted",state:"verified",attempts:1},
    {...active,registrationId:cancelledId,reason:"cancelled"}];
  const calls:string[]=[];
  const db={rpc:async(_name:string,args:{p_action:string;p_group:string|null;p_registration:string|null})=>{
    calls.push(args.p_action);
    return {data:{status:"queue",snapshot,items:args.p_group?rows:rows.filter(i=>i.registrationId===args.p_registration)},error:null};
  }} as unknown as SupabaseClient;
  const result=await executeLabelCommand(session("admin"),()=>db,{groupId:id,action:"read"});
  assert.equal(result.status,"queue");
  if(result.status!=="queue")return;
  assert.deepEqual(result.items.map(i=>i.registrationId),[id,cancelledId]);
  assert.equal(result.items[1].reason,"cancelled");
  assert.equal(result.snapshot,snapshot);
  for(const hidden of [req,"Nome eliminato di prova","HIDE"])assert.ok(!JSON.stringify(result).includes(hidden));
  calls.length=0;
  const forged=await executeLabelCommand(session("admin"),()=>db,{groupId:id,action:"reprint",ids:[req],snapshot,requestId:req,profile:"continuous-29x45"});
  assert.equal(forged.status,"conflict");assert.deepEqual(calls,["read"]);
  const individual=await executeLabelCommand(session("admin"),()=>db,{registrationId:req,action:"read"});
  assert.equal(individual.status,"queue");
  if(individual.status==="queue")assert.equal(individual.items[0].reason,"deleted");
});

test("an explicit simple print renders new and previously requested labels together without verification",async(t)=>{
  const before=process.env.QR_TOKEN_ENCRYPTION_SECRET;process.env.QR_TOKEN_ENCRYPTION_SECRET="synthetic-simple-label-test";
  t.after(()=>{if(before===undefined)delete process.env.QR_TOKEN_ENCRYPTION_SECRET;else process.env.QR_TOKEN_ENCRYPTION_SECRET=before;});
  const other="33333333-3333-4333-8333-333333333333";
  const rows=QR_LABEL_SAMPLES.slice(0,2).map((sample,index)=>({registrationId:index?other:id,name:sample.participant.first_name+" "+sample.participant.last_name,code:sample.participant.public_code,firstName:sample.participant.first_name,lastName:sample.participant.last_name,reason:null,state:index?"prepared":"pending",attempts:index?1:0,outcome:index?"browser_returned":null,content:"b".repeat(64),printedContent:index?"b".repeat(64):null,encrypted:encryptQrToken(sample.token),hash:hashQrToken(sample.token)}));
  const calls:string[]=[];
  const db={rpc:async(_name:string,args:{p_action:string;p_ids:string[];p_request:string})=>{calls.push(args.p_action);if(args.p_action==="request"){assert.deepEqual(args.p_ids,[id,other]);assert.equal(args.p_request,req);}return {data:args.p_action==="read"?{status:"queue",snapshot,items:rows}:{status:"claimed"},error:null};}} as unknown as SupabaseClient;
  const command={groupId:id,action:"request",ids:[id,other],snapshot,requestId:req,profile:"continuous-29x45"};
  assert.ok(parseLabelCommand(command));
  const result=await executeLabelCommand(session("admin"),()=>db,command);
  assert.equal(result.status,"document");if(result.status==="document")assert.equal((result.html.match(/<article /g)??[]).length,2);
  assert.deepEqual(calls,["read","request"]);
  calls.length=0;
  assert.equal((await executeLabelCommand(session("admin"),()=>db,{...command,snapshot:"c".repeat(64)})).status,"conflict");
  assert.deepEqual(calls,["read"]);
});
