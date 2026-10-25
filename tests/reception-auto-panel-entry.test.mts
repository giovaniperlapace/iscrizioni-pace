import assert from 'node:assert/strict';
import test from 'node:test';
import { ReceptionStationSession } from '../lib/reception/station.ts';
import type { ReceptionCommand, ReceptionResult } from '../lib/reception/contracts.ts';

const adult = '11111111-1111-4111-8111-111111111111';
const child = '22222222-2222-4222-8222-222222222222';
const request = '33333333-3333-4333-8333-333333333333';
const lookup = {kind: 'qr' as const, value: 'a'.repeat(43)};
const context = {duty: 'panel_entry' as const, panelId: adult};
const family = (): Extract<ReceptionResult, {kind:'family'}> => ({status:'valid',kind:'family',code:'TEST',revision:0,outcome:'verified',registrationStatus:'confirmed',persons:[{id:adult,kind:'adult',firstName:'Anna',lastName:'Test',checkedInAt:null,eventCheckedIn:true}]});
const saved = () => ({...family(),outcome:'saved' as const,persons:family().persons.map(p=>({...p,checkedInAt:'2026-10-25T12:00:00Z'}))});

for (const kind of ['qr','code'] as const) test(`Forum single ${kind}: automatic entry, ordinary command, no intermediate unlocked state`,async()=>{
 const calls:ReceptionCommand[]=[];const phases:string[]=[];
 const session=new ReceptionStationSession(async command=>{calls.push(command);return command.action==='inspect'?family():saved();},()=>request,20000,context,true);
 session.subscribe(()=>phases.push(session.snapshot().phase));
 await session.inspect({kind,value:kind==='qr'?lookup.value:'TEST'},true);
 assert.deepEqual(calls.map(c=>c.action),['inspect','enter']);
 assert.deepEqual(calls[1],{...context,lookup:calls[0].lookup,action:'enter',requestId:request,subjectIds:[adult]});
 assert.ok(phases.slice(0,-1).every(phase=>phase==='ready'||phase==='pending'));
 assert.equal(session.snapshot().phase,'result');assert.equal(session.snapshot().result?.outcome,'saved');assert.equal(session.snapshot().automaticEntry,true);
});

test('automatic Forum entry excludes families, lone minors, missing/unknown event attendance, ineligible subjects, schools and existing entries',async()=>{
 const variants:ReceptionResult[]=[];
 const children=family();children.persons.push({...children.persons[0],id:child,kind:'child'});variants.push(children);
 for(const patch of [{kind:'child' as const},{eventCheckedIn:false},{eventCheckedIn:undefined},{eligible:false},{checkedInAt:'2026-10-25T12:00:00Z'}]) {const result=family();Object.assign(result.persons[0],patch);variants.push(result);}
 variants.push({status:'valid',kind:'school',outcome:'verified',revision:0,registrationStatus:'submitted',schoolName:'Test',classDescription:'1A',expectedStudents:10,expectedCompanions:2,students:0,companions:0,checkedInAt:null});
 for(const result of variants){
  const calls:ReceptionCommand[]=[];
  const session=new ReceptionStationSession(async command=>{calls.push(command);return result;},()=>request,20000,context,true);
  await session.inspect(lookup,true);assert.deepEqual(calls.map(c=>c.action),['inspect']);assert.equal(session.snapshot().phase,'result');
 }
});

test('other duties and history inspections remain read-only, including after automatic entry and removal',async()=>{
 for(const duty of [{duty:'event_entry' as const},{duty:'registration_check' as const},{duty:'ceremony_entry' as const,panelId:'opening'},{duty:'room_assistance' as const,panelId:adult}]){
  const calls:ReceptionCommand[]=[];const session=new ReceptionStationSession(async c=>{calls.push(c);return family();},()=>request,20000,duty,true);
  await session.inspect(lookup,true);assert.deepEqual(calls.map(c=>c.action),['inspect']);
 }
 const calls:ReceptionCommand[]=[];const session=new ReceptionStationSession(async c=>{calls.push(c);return c.action==='enter'?saved():family();},()=>request,20000,context,true);
 await session.inspect(lookup,true);await session.inspectNext(lookup);assert.deepEqual(calls.map(c=>c.action),['inspect','enter','inspect']);
 assert.equal(session.snapshot().automaticEntry,false);
 await session.removeCurrent();assert.equal(session.snapshot().phase,'selection');assert.equal(session.snapshot().automaticEntry,false);
 assert.deepEqual(calls.map(c=>c.action),['inspect','enter','inspect','inspect']);
 session.closeSelection();await session.inspectNext(lookup);assert.equal(calls.at(-1)?.action,'inspect');assert.equal(calls.length,5);
});

test('concurrent scans cannot replace an automatic write; retry uses the exact request and history retry never writes',async()=>{
 let release:(r:ReceptionResult)=>void=()=>{};let writes=0;const calls:ReceptionCommand[]=[];
 const session=new ReceptionStationSession(async c=>{calls.push(c);if(c.action==='inspect')return family();if(++writes===1)return new Promise(r=>{release=r;});return saved();},()=>request,20000,context,true);
 const pending=session.inspect(lookup,true);await new Promise(r=>setTimeout(r,0));
 await session.inspectNext({kind:'code',value:'NEXT'},true);session.next();session.setMode('cancel');
 assert.equal(calls.length,2);assert.equal(session.snapshot().phase,'pending');
 release({status:'unavailable'});await pending;assert.equal(session.snapshot().phase,'uncertain');
 await session.inspectNext(lookup,true);assert.equal(calls.length,2);
 await session.retry();assert.deepEqual(calls[2],calls[1]);assert.equal(session.snapshot().phase,'result');assert.equal(session.snapshot().automaticEntry,true);
 for(const automatic of [false,true]){
  const retried:ReceptionCommand[]=[];
  const s=new ReceptionStationSession(async c=>{retried.push(c);return retried.length===1?{status:'unavailable'}:c.action==='inspect'?family():saved();},()=>request,20000,context,true);
  await s.inspect(lookup,automatic);await s.retry();assert.deepEqual(retried.map(c=>c.action),automatic?['inspect','inspect','enter']:['inspect','inspect']);
 }
});

for(const status of ['not_booked','invalid','forbidden','capacity_exceeded','event_entry_required','conflict','panel_unavailable'] as const) test(`automatic entry respects server ${status}`,async()=>{
 const calls:ReceptionCommand[]=[];const duringInspect=['not_booked','invalid','forbidden'].includes(status);
 const session=new ReceptionStationSession(async c=>{calls.push(c);return duringInspect||c.action==='enter'?{status}:family();},()=>request,20000,context,true);
 await session.inspect(lookup,true);assert.equal(calls.length,duringInspect?1:2);assert.equal(session.snapshot().problem,status);assert.equal(session.snapshot().result,null);
});

test('leaving during inspection suppresses automatic entry; late write response cannot resolve uncertainty',async()=>{
 let release:(r:ReceptionResult)=>void=()=>{};const calls:ReceptionCommand[]=[];
 const session=new ReceptionStationSession(c=>{calls.push(c);return new Promise(r=>{release=r;});},()=>request,20000,context,true);
 const pending=session.inspect(lookup,true);session.setActive(false);release(family());await pending;assert.equal(calls.length,1);
 const timeout=new ReceptionStationSession(c=>c.action==='inspect'?Promise.resolve(family()):new Promise(r=>{release=r;}),()=>request,5,context,true);
 await timeout.inspect(lookup,true);assert.equal(timeout.snapshot().phase,'uncertain');release(saved());await new Promise(r=>setTimeout(r,0));assert.equal(timeout.snapshot().phase,'uncertain');
});
