import assert from 'node:assert/strict';
import test from 'node:test';
import { UsbScannerBuffer } from '../lib/reception/usb-scanner.ts';
import { ReceptionStationSession } from '../lib/reception/station.ts';
import type { ReceptionCommand, ReceptionResult } from '../lib/reception/contracts.ts';
const id='11111111-1111-4111-8111-111111111111';
const request='22222222-2222-4222-8222-222222222222';
const lookup={kind:'qr' as const,value:'a'.repeat(43)};
const single: Extract<ReceptionResult,{kind:'family'}>={status:'valid',kind:'family',code:'TEST',revision:0,outcome:'verified',registrationStatus:'confirmed',persons:[{id,kind:'adult',firstName:'Ada',lastName:'Mori',checkedInAt:null}]};
const group: Extract<ReceptionResult,{kind:'group'}>={...single,kind:'group',groupId:id,groupName:'Gruppo sintetico',snapshot:'a'.repeat(64),persons:[{...single.persons[0],registrationId:id,code:'TEST'}]};
const school: Extract<ReceptionResult,{kind:'school'}>={status:'valid',kind:'school',revision:0,outcome:'verified',registrationStatus:'confirmed',schoolName:'Scuola sintetica',classDescription:'1A',expectedStudents:10,expectedCompanions:2,students:0,companions:0,checkedInAt:null};
function setup(result:ReceptionResult) {
 const calls:ReceptionCommand[]=[];
 const session=new ReceptionStationSession(async c=>{calls.push(c);return structuredClone(result);},()=>request,20000,{duty:'event_entry'},true);
 return {calls,session};
}
test('USB reception never records single, family, group, school or existing presences on scan',async()=>{
 for(const result of [single,{...single,persons:[...single.persons,{...single.persons[0],id:request,kind:'child' as const}]},group,school,{...single,persons:[{...single.persons[0],checkedInAt:'2026-10-15T10:00:00Z'}]}]) {
  const {session,calls}=setup(result);
  await session.inspect(result.kind==='group'?{kind:'qr',value:'G:'+'g'.repeat(43)}:lookup);
  assert.deepEqual(calls.map(c=>c.action),['inspect']);
  assert.equal(session.snapshot().phase,'result');
  assert.match(session.snapshot().message,/Nessuna presenza modificata/);
  assert.ok(session.snapshot().result);
  assert.equal(session.canScan(),false);
  await session.inspect(lookup);assert.equal(calls.length,1);
 }
});
test('USB selection and Escape preserve printable identity without saving',async()=>{
 const {session,calls}=setup(single);await session.inspect(lookup);
 session.selectPresence();assert.equal(session.snapshot().phase,'selection');
 session.closeSelection();assert.equal(session.snapshot().phase,'result');
 assert.deepEqual(session.snapshot().lookup,lookup);assert.deepEqual(session.snapshot().result,single);
 assert.equal(calls.length,1);
 session.next();assert.equal(session.snapshot().result,null);
});
test('USB presence is an explicit versioned write, independent from print and next',async()=>{
 const {session,calls}=setup(single);await session.inspect(lookup);
 await session.submit({subjectIds:[id]});assert.equal(calls.length,1);
 session.selectPresence();await session.submit({subjectIds:[id]});
 assert.deepEqual(calls.map(c=>c.action),['inspect','enter']);assert.equal(calls[1].requestId,request);
 await session.editCurrent();assert.equal(session.snapshot().mode,'correct');
 await session.submit({subjectIds:[]});assert.equal(calls.length,3);
 session.closeSelection();assert.equal(session.snapshot().mode,'enter');assert.equal(calls.length,3);
});
test('USB uncertain inspection retries only inspection, with no automatic entry',async()=>{
 const calls:ReceptionCommand[]=[];let fail=true;
 const session=new ReceptionStationSession(async c=>{calls.push(c);return fail?{status:'unavailable'}:single;},()=>request,20,{duty:'event_entry'},true);
 await session.inspect(lookup);assert.equal(session.snapshot().phase,'uncertain');fail=false;
 await session.retry();assert.equal(calls[0],calls[1]);assert.deepEqual(calls.map(c=>c.action),['inspect','inspect']);
 assert.equal(session.snapshot().phase,'result');
});
test('Forum explicit presence reads first and saves only after confirmation',async()=>{
 const calls:ReceptionCommand[]=[];
 const session=new ReceptionStationSession(async c=>{calls.push(c);return {...single,persons:single.persons.map(p=>({...p,eventCheckedIn:true})),panel:{id,title:'Forum',room:'Sala',section:'A'}};},()=>request,20,{duty:'panel_entry',panelId:id},true);
 await session.inspect(lookup);assert.deepEqual(calls.map(c=>c.action),['inspect']);
 session.selectPresence();await session.submit({subjectIds:[single.persons[0].id]});assert.deepEqual(calls.map(c=>c.action),['inspect','enter']);
});
test('USB HID buffers exact case and punctuation, completes only on Enter and swallows CRLF duplicate',()=>{
 for(const code of ['Ab_-'.repeat(10)+'Ab_', 'G:'+'G_a-b'.repeat(8)+'Ab_']) {
  const buffer=new UsbScannerBuffer();let now=0;
  for(const c of code){assert.equal(buffer.key(c,now+=10).code,undefined);}
  assert.deepEqual(buffer.key('Enter',now+10),{consumed:true,code});
  assert.deepEqual(buffer.key('Enter',now+20),{consumed:true});
  assert.deepEqual(buffer.key('Enter',now+500),{consumed:false});
 }
});
test('USB HID ignores stale partials, clears on blur/reset and rejects oversize scans rather than truncating',()=>{
 const buffer=new UsbScannerBuffer();buffer.key('a',10);buffer.key('b',1200);
 assert.equal(buffer.key('Enter',1210).code,'b');
 buffer.key('a',2000);buffer.clear();assert.equal(buffer.key('Enter',2500).code,undefined);
 for(let i=0;i<46;i++)buffer.key('a',3000+i);
 assert.equal(buffer.key('Enter',3100).code,'!invalid');
 buffer.key('a',4000);buffer.key('Escape',4010);assert.equal(buffer.key('Enter',4500).code,undefined);
 assert.equal(buffer.key(' ',5000).consumed,false);
 buffer.key('a',6000);assert.deepEqual(buffer.key('Enter',8000),{consumed:false});
});

test('USB next scan replaces a completed card and never records presence',async()=>{
 const {session,calls}=setup(single);
 await session.inspect(lookup);
 await session.inspectNext({kind:'qr',value:'G:'+'g'.repeat(43)});
 assert.deepEqual(calls.map(c=>c.action),['inspect','inspect']);
 assert.equal(session.snapshot().lookup?.value,'G:'+'g'.repeat(43));
 session.selectPresence();
 await session.inspectNext(lookup);
 assert.equal(calls.length,2);
 session.closeSelection();
 await session.removeCurrent();
 assert.equal(session.snapshot().mode,'cancel');
 await session.inspectNext(lookup);
 assert.equal(calls.length,3);
});
test('USB removal rereads revision, requires confirmation and cancels only selected people',async()=>{
 const present={...group,revision:7,persons:[{...group.persons[0],checkedInAt:'2026-10-16T10:00:00Z'}, {...group.persons[0],id:request,checkedInAt:'2026-10-16T10:00:00Z'}]};
 const {session,calls}=setup(present);
 await session.inspect({kind:'qr',value:'G:'+'g'.repeat(43)});await session.removeCurrent();
 assert.deepEqual(calls.map(c=>c.action),['inspect','inspect']);
 assert.equal(session.snapshot().phase,'selection');
 await session.submit({subjectIds:[id]});assert.equal(calls.length,2);
 await session.submit({subjectIds:[id]},true);
 assert.equal(calls[2].action,'cancel');assert.deepEqual(calls[2].subjectIds,[id]);
 assert.equal(calls[2].expectedRevision,7);assert.equal(calls[2].groupSnapshot,present.snapshot);
 assert.equal(calls[2].reason,'entry_cancelled');
});
test('USB new scans cannot displace pending, uncertain or revoked operations',async()=>{
 for(const status of ['unavailable','forbidden'] as const){
  const calls:ReceptionCommand[]=[];
  let finish!:(result:ReceptionResult)=>void;
  const session=new ReceptionStationSession(c=>{calls.push(c);return new Promise(resolve=>{finish=resolve;});},()=>request,20000,{duty:'event_entry'},true);
  const pending=session.inspectNext(lookup);
  await session.inspectNext({kind:'qr',value:'b'.repeat(43)});assert.equal(calls.length,1);
  finish({status});await pending;
  await session.inspectNext({kind:'qr',value:'b'.repeat(43)});assert.equal(calls.length,1);
  assert.deepEqual(session.snapshot().lookup,lookup);
 }
});
