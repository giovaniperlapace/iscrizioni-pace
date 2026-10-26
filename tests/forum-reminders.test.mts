import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { SupabaseClient } from '@supabase/supabase-js';
import { renderForumReminderEmail, renderForumReminderDigest, type ForumReminderPayload, type ForumReminderNotice } from '../lib/panels/reminder-email.ts';
import { processForumReminders } from '../lib/panels/reminder-delivery.ts';
import { EmailDeliveryError, type SendEmailInput } from '../lib/email/smtp.ts';
import { SUPPORTED_LOCALES } from '../lib/i18n/config.ts';
const id='00000000-0000-4000-8000-000000000001';
const payload: ForumReminderPayload = {
 eventId:id,registrationId:id,panelId:id,title:'Forum 1 — Insieme <test>',
 startsAt:'2099-10-26T09:00:00Z',endsAt:'2099-10-26T11:00:00Z',
 location:'Sala <test>',address:'Via Sintetica 42',city:'Assisi',locale:'it',name:'Persona <test>',children:['Minore prenotato'],relay:false,
};
const notice: ForumReminderNotice={id,claim:id,eventId:id,recipientKey:`participant:${id}`,panelId:id,payload:[payload]};
const email = {to:'synthetic@example.invalid',...renderForumReminderEmail(payload)};

test('all seven locales show exact canonical venue, full address, local time and booked family in HTML/text',()=>{
 for(const locale of SUPPORTED_LOCALES){
  const mail=renderForumReminderEmail({...payload,locale});
  assert.match(mail.text,/Via Sintetica 42, Assisi/);assert.match(mail.html,/Via Sintetica 42, Assisi/);
  assert.match(mail.text,/10:00/);assert.match(mail.text,/Europe\/Rome/);
  assert.match(mail.text,/Minore prenotato/);assert.match(mail.html,/Sala &lt;test&gt;/);
  assert.doesNotMatch(mail.html,/<test>/);assert.match(mail.html,new RegExp(`lang="${locale}"`));
  assert.match(mail.text,/QR/);
  assert.doesNotMatch(mail.text + mail.html,/https?:|href=|<a[ >]|<img[ >]/i);
 }
});

test('relay warning and delegated recipient are explicit; no request to accept an existing booking',()=>{
 const mail=renderForumReminderEmail({...payload,relay:true},true);
 assert.match(mail.text,/SALA COLLEGATA — SOLO IN ITALIANO/);
 assert.match(mail.text,/prenotazione vale soltanto per questa sala collegata/);
 assert.match(mail.text,/ti ha delegato/);assert.match(mail.text,/Il QR code del capogruppo non sostituisce/);
 assert.doesNotMatch(mail.text,/Accetta|entro 1 ora|offerta scade/);
 const single=renderForumReminderEmail({...payload,children:[]});
 assert.doesNotMatch(single.text,/Minori prenotati/);
});

test('missing canonical address, invalid identifier blocks rendering; Rome DST is correct',()=>{
 for(const address of [null,'','  ']) assert.throws(()=>renderForumReminderEmail({...payload,address}),/address_missing/);
 assert.throws(()=>renderForumReminderEmail({...payload,panelId:'invalid'}));
 assert.match(renderForumReminderEmail({...payload,startsAt:'2026-07-01T09:00:00Z'}).text,/11:00/);
 assert.match(renderForumReminderEmail({...payload,startsAt:'2026-10-26T09:00:00Z'}).text,/10:00/);
});

type Row = { id:string; state:string; claim:string; [key:string]:unknown };
function database(n=1, options:{authorized?:boolean;ackError?:boolean;emptyPayload?:boolean}={}) {
 const rows:Row[]=Array.from({length:n},(_,i)=>({id:`message-${i}`,state:'queued',claim:`claim-${i}`}));
 const authorized:unknown[]=[];let rpcCalls=0;
 const db={
  async rpc(name:string,args?:Record<string,unknown>){
   rpcCalls++;
   if(name==='enqueue_forum_reminders') return {data:0,error:null};
   if(name==='authorize_forum_reminder'){
    authorized.push(args);return {data:options.authorized!==false,error:null};
   }
   assert.equal(name,'claim_forum_reminder');
   const row=rows.find(r=>r.state==='queued'&&(!r.retry_after||Date.parse(String(r.retry_after))<=Date.now()));if(!row)return {data:null,error:null};
   row.state='sending';return {data:{...notice,id:row.id,claim:row.claim,payload:options.emptyPayload?[]:[payload]},error:null};
  },
  from(table:string){assert.equal(table,'forum_reminder_emails');const filters:Record<string,unknown>={};let patch:Record<string,unknown>={};
   const query={update(p:Record<string,unknown>){patch=p;return query;},eq(k:string,v:unknown){filters[k]=v;return query;},select(){return query;},
    async maybeSingle(){
     if(options.ackError)return {data:null,error:{message:'synthetic'}};
     const row=rows.find(r=>Object.entries(filters).every(([k,v])=>r[k]===v));
     if(row)Object.assign(row,patch);return {data:row?{id:row.id}:null,error:null};
    }};return query;
  },
 };
 return {db:db as unknown as SupabaseClient,rows,authorized,rpcCalls:()=>rpcCalls};
}

test('concurrent workers send every reminder at most once and persist provider acceptance',async()=>{
 const f=database(35);let sent=0;
 const options={mode:'postmark' as const,send:async()=>{sent++;return {messageId:'provider-id'};}};
 await Promise.all([processForumReminders(f.db,async()=>email,options),processForumReminders(f.db,async()=>email,options)]);
 assert.equal(sent,35);assert.equal(f.authorized.length,35);
 assert.ok(f.rows.every(r=>r.state==='accepted'&&r.message_id==='provider-id'));
 await processForumReminders(f.db,async()=>email,options);assert.equal(sent,35);
});

test('provider timeout or unexpected failure is uncertain; definitive rejection is failed; neither resends',async()=>{
 for(const [error,state] of [[new EmailDeliveryError('postmark_delivery_unknown'),'uncertain'],[new Error('interrupted'),'uncertain'],[new EmailDeliveryError('postmark_rejected'),'failed']] as const){
  const f=database();let sends=0;
  const options={mode:'postmark' as const,send:async()=>{sends++;throw error;}};
  const count=await processForumReminders(f.db,async()=>email,options);
  assert.equal(count[state],1);assert.equal(f.rows[0].state,state);
  await processForumReminders(f.db,async()=>email,options);assert.equal(sends,1);
 }
});

test('log mode does not consume queue; missing contacts, cancelled bookings, changed data and missing address do not send',async()=>{
 let sends=0;const options={mode:'postmark' as const,send:async()=>{sends++;return {messageId:'synthetic'};}};
 const preview=database();await processForumReminders(preview.db,async()=>email,{...options,mode:'log'});assert.equal(preview.rpcCalls(),0);
 const noContact=database();assert.equal((await processForumReminders(noContact.db,async()=>null,options)).skipped,1);
 const cancelled=database(1,{emptyPayload:true});assert.equal((await processForumReminders(cancelled.db,async()=>{throw Error('must not prepare');},options)).skipped,1);
 const changed=database(1,{authorized:false});assert.equal((await processForumReminders(changed.db,async()=>email,options)).deferred,1);
 const noAddress=database();assert.equal((await processForumReminders(noAddress.db,async()=>{throw Error('forum_reminder_address_missing');},options)).failed,1);
 assert.equal(noAddress.rows[0].error_code,'forum_reminder_address_missing');assert.equal(sends,0);
});

test('acknowledgement loss after acceptance never requeues a possibly delivered reminder',async()=>{
 const f=database(1,{ackError:true});let sends=0;
 const options={mode:'postmark' as const,send:async()=>{sends++;return {messageId:'synthetic'};}};
 await assert.rejects(processForumReminders(f.db,async()=>email,options),/processing_failed/);
 assert.equal(f.rows[0].state,'sending');
 await processForumReminders(f.db,async()=>email,options);assert.equal(sends,1);
});

test('real server preparation prefers personal email and requires an explicit matching delegation',async()=>{
 const previous=process.env.APP_URL;process.env.APP_URL='https://example.invalid';
 let kind='direct',snapshots:unknown[]=[],readError=false,prepared:SendEmailInput|null=null;
 try {
  const dependencies:Record<string,unknown>={
   '@/lib/supabase/service':{createSupabaseServiceClient:()=>({from:()=>{const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:{preferred_locale:'it'},error:null})};return query;}})},
   '@/lib/email/campaign-recipients.server':{
    resolveCurrentParticipantRecipients:async()=>[{registrationId:id,deliveryKind:kind,delegateUserId:id}],
    loadCampaignRecipientPreviews:async()=>[{registrationId:id,destinationEmail:kind==='direct'?'personal@example.invalid':'leader@example.invalid'}],
   },
   '@/lib/supabase/all-rows':{loadRowsForIds:async()=>{if(readError)throw Error('snapshot read failed');return {data:snapshots,error:null};}},
   './reminder-email':{renderForumReminderEmail,renderForumReminderDigest},
   './reminder-delivery':{processForumReminders:async(_db:unknown,prepare:(n:ForumReminderNotice)=>Promise<SendEmailInput|null>)=>{prepared=await prepare({...notice,recipientKey:kind==='direct'?`participant:${id}`:`delegate:${id}`});}},
  };
  const source=ts.transpileModule(readFileSync('lib/panels/reminder-delivery.server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={} as {processDueForumReminders:()=>Promise<unknown>};
  new Function('require','exports',source)((name:string)=>{assert.ok(name in dependencies,name);return dependencies[name];},exports);
  await exports.processDueForumReminders();assert.equal((prepared as SendEmailInput|null)?.to,'personal@example.invalid');
  kind='delegated';await exports.processDueForumReminders();assert.equal(prepared,null);
  snapshots=[{registration_id:id,answers:{contact:{useLeaderEmail:true,communicationDelegateUserId:'different'}}}];
  await exports.processDueForumReminders();assert.equal(prepared,null);
  snapshots=[{registration_id:id,answers:{contact:{useLeaderEmail:true,communicationDelegateUserId:id}}}];
  await exports.processDueForumReminders();assert.equal((prepared as SendEmailInput|null)?.to,'leader@example.invalid');
  assert.deepEqual((prepared as SendEmailInput|null)?.metadata,{forum_reminder_id:id});
  readError=true;await assert.rejects(exports.processDueForumReminders(),/snapshot read failed/);
 }finally{if(previous===undefined)delete process.env.APP_URL;else process.env.APP_URL=previous;}
});

test('one leader digest contains all 1,005 delegated participants and their selected children, without truncation',()=>{
 const people=Array.from({length:1005},(_,i)=>({...payload,registrationId:`r-${i}`,name:`Persona numero ${i}`,children:i===1004?['Ultimo minore']:[]}));
 for(const locale of SUPPORTED_LOCALES){
  const digest=renderForumReminderDigest(people,locale);
  assert.match(digest.text,/Persona numero 1004/);assert.match(digest.text,/Ultimo minore/);
  assert.match(digest.html,/Via Sintetica 42, Assisi/);
  assert.equal((digest.html.match(/<ul>[\s\S]*?<\/ul>/)?.[0].match(/<li>/g)||[]).length,1005);
  assert.match(digest.text,/\(1005\)/);assert.doesNotMatch(digest.text + digest.html,/https?:|href=|<a[ >]|<img[ >]/i);
 }
 assert.throws(()=>renderForumReminderDigest([]));
 assert.throws(()=>renderForumReminderDigest([payload,{...payload,address:'Another venue'}]));
});

test('batch contact resolution reads all 1,205 registrations in bounded filters and fails on a later read error',async()=>{
 const allRows=await import('../lib/supabase/all-rows.ts');
 const ids=Array.from({length:1205},(_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,'0')}`);
 let failAt=-1,registrationReads=0;
 const service={from(table:string){let selected:string[]=[],deleted=false;
  const query={select:()=>query,eq:()=>query,is:()=>query,neq:()=>query,order:()=>query,
   not:()=>{deleted=true;return query;},in:(_key:string,values:string[])=>{selected=values;assert.ok(values.length<=100);return query;},
   async range(){
    if(table==='registrations'&&!deleted){
     registrationReads++;if(registrationReads===failAt)return {data:null,error:{message:'later batch failed'}};
     return {data:selected.map(id=>({id,participant_id:id,status:'confirmed',source:'public_form',created_by:null})),error:null};
    }
    if(table==='participant_contacts')return {data:selected.map(id=>({participant_id:id,email:`${id}@example.invalid`,is_primary:true})),error:null};
    return {data:[],error:null};
   }};return query;
 }};
 const code=ts.transpileModule(readFileSync('lib/email/campaign-recipients.server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={} as {resolveCurrentParticipantRecipients:(eventId:string,ids:string[])=>Promise<{registrationId:string}[]>};
 new Function('require','exports',code)((name:string)=>name.includes('supabase/all-rows')?allRows:name.includes('supabase/service')?{createSupabaseServiceClient:()=>service}:{},exports);
 const result=await exports.resolveCurrentParticipantRecipients(id,ids);
 assert.equal(result.length,1205);assert.equal(new Set(result.map(r=>r.registrationId)).size,1205);
 failAt=registrationReads+2;
 await assert.rejects(exports.resolveCurrentParticipantRecipients(id,ids),/later batch failed/);
});
