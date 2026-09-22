import assert from "node:assert/strict";
import test from "node:test";
import { ReceptionStationSession, ScanLatch } from "../lib/reception/station.ts";
import type { ReceptionCommand, ReceptionResult } from "../lib/reception/contracts.ts";

const adult = "11111111-1111-4111-8111-111111111111";
const child = "22222222-2222-4222-8222-222222222222";
const request = "33333333-3333-4333-8333-333333333333";
const lookup = { kind: "code" as const, value: "TEST" };
const family = (children = false): Extract<ReceptionResult, {kind:"family"}> => ({
  status:"valid",kind:"family",code:"TEST",revision:0,outcome:"verified",registrationStatus:"confirmed",
  persons:[{id:adult,kind:"adult",firstName:"Anna",lastName:"Test",checkedInAt:null},
    ...(children ? [{id:child,kind:"child" as const,firstName:"Luca",lastName:"Test",checkedInAt:null}] : [])],
});
const school: Extract<ReceptionResult,{kind:"school"}> = {status:"valid",kind:"school",schoolName:"Test",classDescription:"1A",revision:0,outcome:"verified",registrationStatus:"submitted",expectedStudents:10,expectedCompanions:2,students:0,companions:0,checkedInAt:null};
const now = "2026-09-22T12:00:00Z";

test("single entry keeps one duty across consecutive QR/manual reads and needs no action choice", async () => {
  const calls: ReceptionCommand[] = [];
  const session = new ReceptionStationSession(async c => { calls.push(c); const r=family(); return c.action === "inspect" ? r : {...r,outcome:"saved",persons:r.persons.map(p=>({...p,checkedInAt:now}))}; },()=>request);
  await session.inspect(lookup);
  assert.deepEqual(calls.map(c=>c.action),["inspect","enter"]);
  assert.deepEqual(calls[1].subjectIds,[adult]);
  assert.equal(session.snapshot().phase,"result"); assert.equal(session.canScan(),true);
  await session.inspect({kind:"qr",value:"a".repeat(43)});
  assert.equal(calls.length,4); assert.ok(calls.every(c=>c.duty==="event_entry"));
  assert.equal(session.snapshot().mode,"enter");
});
test("family is paused until explicit subset; school requires explicit counts",async()=>{
  for (const result of [family(true),school]) {
    const calls:ReceptionCommand[]=[];
    const session=new ReceptionStationSession(async c=>{calls.push(c);return result;},()=>request);
    await session.inspect(lookup);
    assert.equal(session.snapshot().phase,"selection");assert.equal(session.canScan(),false);assert.equal(calls.length,1);
    await session.inspect({kind:"code",value:"NEXT"});assert.equal(calls.length,1);
    await session.submit(result.kind==="family"?{subjectIds:[child]}:{students:8,companions:1});
    assert.equal(calls.length,2);assert.equal(session.snapshot().phase,"result");
    if (result.kind==="family") assert.deepEqual(calls[1].subjectIds,[child]);
    else {assert.equal(calls[1].students,8);assert.equal(calls[1].companions,1);}
  }
});
test("repeated school entry shows existing time/count without automatic overwrite",async()=>{
  const calls:ReceptionCommand[]=[];
  const session=new ReceptionStationSession(async c=>{calls.push(c);return {...school,checkedInAt:now,students:8,companions:1};},()=>request);
  await session.inspect(lookup);assert.equal(calls.length,1);assert.equal(session.snapshot().phase,"result");
  assert.match(session.snapshot().message,/déjà|già/);
});
test("synchronous interlock blocks double clicks and new subjects during slow inspect/enter",async()=>{
  let finish:(r:ReceptionResult)=>void=()=>{};const calls:ReceptionCommand[]=[];
  const session=new ReceptionStationSession(c=>{calls.push(c);return new Promise(r=>{finish=r;});},()=>request);
  const first=session.inspect(lookup);
  await session.inspect({kind:"code",value:"NEXT"});session.setMode("cancel");
  assert.equal(calls.length,1);assert.equal(session.snapshot().mode,"enter");
  finish(family());await new Promise(r=>setTimeout(r,0));
  assert.equal(calls.length,2);assert.equal(session.snapshot().phase,"pending");
  await session.inspect(lookup);assert.equal(calls.length,2);
  finish({...family(),outcome:"saved"});await first;
});
test("uncertain writes freeze duty/subject and retry the exact original command",async()=>{
  const calls:ReceptionCommand[]=[];let entries=0;
  const session=new ReceptionStationSession(async c=>{calls.push(c);return c.action==="inspect"?family():++entries===1?{status:"unavailable"}:{...family(),outcome:"replayed"};},()=>request);
  await session.inspect(lookup);const original=calls[1];
  assert.equal(session.snapshot().phase,"uncertain");assert.equal(session.snapshot().result,null);
  session.next();session.setMode("cancel");await session.inspect({kind:"code",value:"NEXT"});
  assert.equal(calls.length,2);assert.equal(session.snapshot().mode,"enter");
  await session.retry();assert.equal(calls[2],original);assert.equal(session.snapshot().phase,"result");
  assert.match(session.snapshot().message,/presenze correnti/);
});
test("timeout ignores late response and never announces an unconfirmed presence",async()=>{
  let resolve:(r:ReceptionResult)=>void=()=>{};
  const session=new ReceptionStationSession(c=>c.action==="inspect"?Promise.resolve(family()):new Promise(r=>{resolve=r;}),()=>request,5);
  await session.inspect(lookup);assert.equal(session.snapshot().phase,"uncertain");
  resolve({...family(),outcome:"saved"});await new Promise(r=>setTimeout(r,0));
  assert.equal(session.snapshot().phase,"uncertain");assert.equal(session.snapshot().result,null);
});
test("uncertain inspection retries inspection before any entry",async()=>{
  let count=0;const calls:ReceptionCommand[]=[];
  const session=new ReceptionStationSession(async c=>{calls.push(c);return count++===0?{status:"unavailable"}:family();},()=>request);
  await session.inspect(lookup);await session.retry();
  assert.deepEqual(calls.map(c=>c.action),["inspect","inspect","enter"]);assert.equal(calls[0],calls[1]);
});
test("correction is separate, confirmed, versioned; conflict requires fresh lookup",async()=>{
  const calls:ReceptionCommand[]=[];
  const session=new ReceptionStationSession(async c=>{calls.push(c);return c.action==="inspect"?{...family(true),revision:7}:{status:"conflict"};},()=>request);
  session.setMode("correct");await session.inspect(lookup);assert.equal(calls.length,1);
  await session.submit({subjectIds:[child]});assert.equal(calls.length,1);
  await session.submit({subjectIds:[child]},true);
  assert.equal(calls[1].expectedRevision,7);assert.equal(calls[1].reason,"selection_error");
  assert.equal(session.snapshot().phase,"error");assert.equal(session.canScan(),false);
  await session.submit({subjectIds:[adult]},true);assert.equal(calls.length,2);
  await session.inspect(lookup);assert.equal(calls.length,3);
});
test("revocation/session expiry blocks scanner and invalid lookups clear prior identity",async()=>{
  for (const status of ["forbidden","invalid","invalid_request"] as const) {
    let fail=false;
    const session=new ReceptionStationSession(async()=>fail?{status}:family(),()=>request);
    await session.inspect(lookup);fail=true;await session.inspect(lookup);
    assert.equal(session.snapshot().result,null);assert.equal(session.snapshot().mode,"enter");
    assert.equal(session.canScan(),status!=="forbidden");
    if(status==="forbidden"){session.next();session.setMode("cancel");assert.equal(session.snapshot().phase,"blocked");}
  }
});
test("leaving while verification is pending cannot trigger an automatic entry",async()=>{
  const calls:ReceptionCommand[]=[];let resolve:(r:ReceptionResult)=>void=()=>{};
  const session=new ReceptionStationSession(c=>{calls.push(c);return new Promise(r=>{resolve=r;});},()=>request);
  const pending=session.inspect(lookup);session.setActive(false);resolve(family());await pending;assert.equal(calls.length,1);
});
test("same-frame QR and unreadable gaps never repeat a token; explicit release permits another arrival",()=>{
  const latch=new ScanLatch();assert.equal(latch.accept("a"),true);
  for(let i=0;i<20;i++) assert.equal(latch.accept("a"),false);
  assert.equal(latch.accept("b"),true);assert.equal(latch.accept("b"),false);
  latch.reset();assert.equal(latch.accept("b"),true);
});
