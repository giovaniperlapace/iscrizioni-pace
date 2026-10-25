import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import jsQR from "jsqr";
import { createForumReceptionDemo } from "../lib/reception/forum-demo.ts";
import { DEMO_SAMPLES, DEMO_EVENT, DEMO_FORUM_ONE, DEMO_FORUM_TWO, DEMO_OPTION, demoId } from "../lib/reception/demo-samples.ts";
const sample=(code:string)=>DEMO_SAMPLES.find(s=>s.code===code)!;
const scan=(code:string,target=DEMO_FORUM_ONE,extra:object={})=>({operation:"scan",command:{duty:target==="opening"||target==="closing"?"ceremony_entry":"panel_entry",panelId:target,lookup:{kind:"qr",value:sample(code).token},action:"inspect",...extra}});
const desk=(code:string,target=DEMO_FORUM_ONE,extra:object={})=>({operation:"desk",command:{target,lookup:{kind:"code",value:code},operation:"preview",...extra}});

test("all nine delivered PNGs decode to distinct synthetic scanner tokens",async()=>{
 assert.equal(new Set(DEMO_SAMPLES.map(s=>s.token)).size,9);
 for(const s of DEMO_SAMPLES){
  const {data,info}=await sharp(`tests/fixtures${s.image}`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(jsQR(new Uint8ClampedArray(data),info.width,info.height)?.data,s.token);
  assert.match(s.token,/^[A-Za-z0-9_-]{43}$/);
 }
});
test("demo inspection, explicit presence, replay and removal preserve independent sessions",async()=>{
 const demo=createForumReceptionDemo(),other=createForumReceptionDemo();
 const initial=await demo.request(DEMO_EVENT,scan("F001"));
 assert.equal(initial.status,"valid");
 if(initial.status!=="valid"||!("persons" in initial))throw new Error("Missing person");
 assert.equal(initial.persons[0].checkedInAt,null);
 const command=scan("F001",DEMO_FORUM_ONE,{action:"enter",requestId:demoId(500),subjectIds:[sample("F001").id]});
 assert.equal((await demo.request(DEMO_EVENT,command)).status,"valid");
 assert.equal((await demo.request(DEMO_EVENT,command) as {outcome:string}).outcome,"replayed");
 assert.equal((await demo.request(DEMO_EVENT,{operation:"statistics",target:DEMO_FORUM_ONE}) as {entered:number}).entered,2);
 assert.equal((await other.request(DEMO_EVENT,{operation:"statistics",target:DEMO_FORUM_ONE}) as {entered:number}).entered,1);
 assert.equal((await demo.request(DEMO_EVENT,scan("F001",DEMO_FORUM_ONE,{action:"cancel",requestId:demoId(501),subjectIds:[sample("F001").id],expectedRevision:0,reason:"entry_cancelled"}))).status,"conflict");
 assert.equal((await demo.request(DEMO_EVENT,scan("F001",DEMO_FORUM_ONE,{action:"cancel",requestId:demoId(502),subjectIds:[sample("F001").id],expectedRevision:1,reason:"entry_cancelled"}))).status,"valid");
});
test("wrong Forum routing and desktop booking remain distinct from entry",async()=>{
 const demo=createForumReceptionDemo();
 const wrong=await demo.request(DEMO_EVENT,scan("F002"));
 assert.deepEqual(wrong,{status:"not_booked",routes:[{title:"Forum 2 · Prova",room:"Sala B fittizia"}]});
 assert.equal((await demo.request(DEMO_EVENT,scan("F003"))).status,"not_booked");
 assert.equal((await demo.request(DEMO_EVENT,desk("F003",DEMO_FORUM_ONE,{operation:"book",option:DEMO_OPTION,children:[],request:demoId(503)}))).status,"saved");
 assert.equal((await demo.request(DEMO_EVENT,{operation:"statistics",target:DEMO_FORUM_ONE}) as {entered:number}).entered,1);
 assert.equal((await demo.request(DEMO_EVENT,scan("F003"))).status,"valid");
 assert.equal((await demo.request(DEMO_EVENT,desk("F003",DEMO_FORUM_TWO,{operation:"book",option:DEMO_OPTION,children:[],request:demoId(504)}))).status,"booking_conflict");
});
test("ceremony samples show numbered seats and prevent entry without a ticket",async()=>{
 const demo=createForumReceptionDemo();
 const ticket=await demo.request(DEMO_EVENT,scan("F006","opening"));
 if(ticket.status!=="valid"||!("persons" in ticket))throw new Error("Missing ticket");
 assert.equal(ticket.persons[0].ceremonies?.[0].seat?.number,"12");
 const noTicket=await demo.request(DEMO_EVENT,scan("F007","opening"));
 if(noTicket.status!=="valid"||!("persons" in noTicket))throw new Error("Missing person");
 assert.equal(noTicket.persons[0].eligible,false);
 assert.equal((await demo.request(DEMO_EVENT,scan("F007","opening",{action:"enter",requestId:demoId(505),subjectIds:[sample("F007").id]}))).status,"not_booked");
 assert.equal((await demo.request(DEMO_EVENT,desk("F007","opening",{operation:"book",option:DEMO_OPTION,children:[],request:demoId(506)}))).status,"saved");
 assert.equal((await demo.request(DEMO_EVENT,{operation:"statistics",target:"opening"}) as {entered:number}).entered,0);
});
test("demo accepts only its own identities, target event and selected family members",async()=>{
 const demo=createForumReceptionDemo();
 assert.equal((await demo.request(DEMO_EVENT,scan("F008"))).status,"invalid");
 assert.equal((await demo.request(demoId(999),scan("F001"))).status,"forbidden");
 assert.equal((await demo.request(DEMO_EVENT,scan("F001",DEMO_FORUM_ONE,{lookup:{kind:"qr",value:"A".repeat(43)}}))).status,"invalid");
 assert.equal((await demo.request(DEMO_EVENT,scan("F009",DEMO_FORUM_ONE,{action:"enter",requestId:demoId(507),subjectIds:[sample("F009").id]}))).status,"event_entry_required");
 assert.equal((await demo.request(DEMO_EVENT,scan("F005",DEMO_FORUM_ONE,{action:"enter",requestId:demoId(508),subjectIds:[sample("F005").childId]}))).status,"valid");
 const family=await demo.request(DEMO_EVENT,scan("F005"));
 if(family.status!=="valid"||!("persons" in family))throw new Error("Missing family");
 assert.equal(family.persons[0].checkedInAt,null);
 assert.ok(family.persons[1].checkedInAt);
});
