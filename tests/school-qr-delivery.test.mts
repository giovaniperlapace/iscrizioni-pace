import assert from 'node:assert/strict';
import test from 'node:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {prepareSchoolQrEmail,processSchoolQrEmails} from '../lib/panels/school-qr-delivery.ts';
import {createOpaqueQrToken} from '../lib/qrcode/token.ts';
import {encryptQrToken} from '../lib/qrcode/secure-token.ts';
import {parseReceptionCommand} from '../lib/reception/contracts.ts';
import {ReceptionStationSession} from '../lib/reception/station.ts';

const id='11111111-1111-4111-8111-111111111111';
process.env.QR_TOKEN_ENCRYPTION_SECRET='synthetic-school-tests';
process.env.EMAIL_DELIVERY_MODE='postmark';
process.env.POSTMARK_SERVER_TOKEN='synthetic-never-network';

function database(status='confirmed') {
 const token=createOpaqueQrToken(); const encrypted=encryptQrToken(token.token);
 const delivery:Record<string,unknown>={state:'queued'};
 const tables:Record<string,unknown>={
  school_bookings:{id,event_id:id,teacher_id:id,school_name:'School <test>',class_description:'1A',student_count:10,companion_count:2,status},
  events:{id,title:'Event',is_current:true},school_booking_teachers:{email:'teacher@example.invalid',first_name:'Teacher'},
  school_panel_reservations:[{panel_id:id,student_count:10,companion_count:2}],
  event_moments:[{id,title:'Forum',starts_at:'2026-10-26T09:00:00Z',location_id:null}],
  school_booking_qr_tokens:{token_hash:token.tokenHash},
 };
 let claims=0;
 const db={from(table:string){
  let patch:Record<string,unknown>|undefined;
  const query={select(){return query;},eq(){return query;},in(){return query;},order(){return query;},single(){return query;},
   update(value:Record<string,unknown>){patch=value;return query;},
   then(resolve:(value:unknown)=>unknown){if(patch)Object.assign(delivery,patch);return Promise.resolve(resolve({data:tables[table],error:null}));}};
  return query;
 },async rpc(name:string){
  if(name==='ensure_school_booking_qr')return {data:encrypted,error:null};
  assert.equal(name,'claim_school_booking_email');claims++;
  if(delivery.state!=='queued')return {data:null,error:null};delivery.state='sending';return {data:id,error:null};
 }};
 return {db:db as unknown as SupabaseClient,token:token.token,delivery,tables,claims:()=>claims};
}

test('school notice uses existing QR, escaped identity, actual reservations and durable teacher access',async()=>{
 const f=database();const email=await prepareSchoolQrEmail(f.db,id,'https://example.invalid');
 assert.ok(email); assert.equal(email.to,'teacher@example.invalid');assert.match(email.html,/School &lt;test&gt;/);
 assert.match(email.text,/10 studenti, 2 accompagnatori/);assert.match(email.text,/direttamente all’ingresso del Forum/);
 assert.match(email.text,/https:\/\/example.invalid\/scuole\/accesso/);
 assert.equal(email.attachments[0].contentType,'image/png');assert.ok(email.attachments[0].content.length>100);
 const {default:sharp}=await import('sharp');const {default:jsQR}=await import('jsqr');
 const image=await sharp(email.attachments[0].content).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(jsQR(new Uint8ClampedArray(image.data),image.info.width,image.info.height)?.data,f.token);
});

test('school mail is accepted once; timeout and malformed provider results are uncertain and never retried',async()=>{
 const original=globalThis.fetch;
 try {
  for(const outcome of ['accepted','timeout','malformed']) {
   const f=database();let calls=0;
   globalThis.fetch=async(input,init)=>{calls++;assert.equal(String(input),'https://api.postmarkapp.com/email');
    const payload=JSON.parse(String(init?.body));assert.equal(payload.To,'teacher@example.invalid');assert.equal(payload.MessageStream,'outbound');
    if(outcome==='timeout')throw new Error('synthetic timeout');
    return outcome==='malformed'?new Response('broken',{status:200}):Response.json({ErrorCode:0,MessageID:'synthetic-id'});
   };
   const result=await processSchoolQrEmails(f.db,'https://example.invalid');
   assert.equal(f.delivery.state,outcome==='accepted'?'accepted':'uncertain');
   assert.equal(result[outcome==='accepted'?'accepted':'uncertain'],1);
   await processSchoolQrEmails(f.db,'https://example.invalid');assert.equal(calls,1);
   assert.equal(f.delivery.recipient,'teacher@example.invalid');
  }
 }finally {globalThis.fetch=original;}
});

test('cancelled bookings, broken QR and log mode never send an email',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('must not send');};
 try {
  const cancelled=database('cancelled');await processSchoolQrEmails(cancelled.db,'https://example.invalid');assert.equal(cancelled.delivery.state,'skipped');
  const broken=database();broken.tables.school_booking_qr_tokens={token_hash:'wrong'};
  await processSchoolQrEmails(broken.db,'https://example.invalid');assert.equal(broken.delivery.state,'failed');
  process.env.EMAIL_DELIVERY_MODE='log';const preview=database();await processSchoolQrEmails(preview.db,'https://example.invalid');
  assert.equal(preview.claims(),0);assert.equal(calls,0);
 }finally{globalThis.fetch=original;process.env.EMAIL_DELIVERY_MODE='postmark';}
});

test('school joint command is limited to Forum QR entry and retry preserves the exact command',async()=>{
 const input={duty:'panel_entry',panelId:id,lookup:{kind:'qr',value:'S'.repeat(43)},action:'enter',requestId:id,students:8,companions:1,reason:'school_event_entry'};
 assert.ok(parseReceptionCommand(input));assert.equal(parseReceptionCommand({...input,duty:'event_entry',panelId:undefined}),null);
 assert.equal(parseReceptionCommand({...input,action:'correct',expectedRevision:0}),null);
 const commands:unknown[]=[];const session=new ReceptionStationSession(async command=>{commands.push(command);
  return command.action==='inspect'?{status:'valid',kind:'school',schoolName:'School',classDescription:'1A',registrationStatus:'confirmed',revision:0,outcome:'verified',expectedStudents:10,expectedCompanions:2,students:0,companions:0,checkedInAt:null,eventCheckedIn:false}:{status:'unavailable'};
 },()=>id,1000,{duty:'panel_entry',panelId:id},true);
 await session.inspect({kind:'qr',value:'S'.repeat(43)});session.selectPresence(true);
 await session.submit({students:8,companions:1});assert.equal(session.snapshot().retry?.reason,'school_event_entry');
 await session.retry();assert.deepEqual(commands[1],commands[2]);
});
