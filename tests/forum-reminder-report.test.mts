import assert from 'node:assert/strict';
import test from 'node:test';
import type {SupabaseClient} from '@supabase/supabase-js';
import {processForumReminderReports,renderForumReminderReport,type ForumReminderReport} from '../lib/panels/reminder-report.ts';
import {EmailDeliveryError} from '../lib/email/smtp.ts';
const id='00000000-0000-4000-8000-000000000001';
const report:ForumReminderReport={id,claim:id,payload:{title:'Forum <test>',startsAt:'2026-10-26T15:00:00Z',location:'Sala <test>',address:'Via Test 42',checkedAt:'2026-10-26T13:10:00Z',total:100,accepted:96,delivered:90,bounced:2,pending:3,unverified:1,failed:1,uncertain:2,skipped:1,personal:90,digests:6,missingAddress:1}};

test('report goes to registrationspeace and distinguishes provider acceptance, delivery evidence, failures and summary emails',()=>{
 const mail=renderForumReminderReport(report);
 assert.equal(mail.to,'registrationspeace@santegidio.org');
 assert.match(mail.text,/Accettate da Postmark: 96/);assert.match(mail.text,/Consegnate al server destinatario: 90/);
 assert.match(mail.text,/6 riepiloghi ai capigruppo/);assert.match(mail.text,/non conferma la lettura/);
 assert.match(mail.text,/verifica della consegna non disponibile: 1/);assert.match(mail.html,/Sala &lt;test&gt;/);
 assert.deepEqual(mail.metadata,{forum_report_id:id});
 for(const [key,value] of Object.entries(mail.metadata)){assert.ok(key.length<=20);assert.ok(value.length<=80);}
});

function database(){
 const mail={id:'mail',state:'accepted',messageId:'provider-id',recipient:'person@example.invalid',claim:'evidence',delivery_checked_at:null} as Record<string,unknown>;
 const summary={id,state:'queued',claim:id} as Record<string,unknown>;
 let evidenceClaimed=false,rpcCalls=0;
 const db={async rpc(name:string){rpcCalls++;
  if(name==='claim_forum_reminder_delivery_check'){
   if(evidenceClaimed)return {data:null,error:null};evidenceClaimed=true;return {data:mail,error:null};
  }
  assert.equal(name,'claim_forum_reminder_report');
  if(summary.state!=='queued')return {data:null,error:null};
  assert.ok(mail.delivery_checked_at);summary.state='sending';return {data:report,error:null};
 },from(table:string){let patch:Record<string,unknown>={};const query={update(p:Record<string,unknown>){patch=p;return query;},eq(){return query;},select(){return query;},async maybeSingle(){Object.assign(table==='forum_reminder_emails'?mail:summary,patch);return {data:{id},error:null};}};return query;}};
 return {db:db as unknown as SupabaseClient,mail,summary,rpcCalls:()=>rpcCalls};
}
const details={MessageID:'provider-id',MessageStream:'outbound',MessageEvents:[{Type:'Delivered',Recipient:'person@example.invalid',ReceivedAt:'2026-10-26T13:02:00Z'}]};
test('report worker checks exact message evidence, saves it and sends the summary only once',async()=>{
 const f=database();let sent=0,read=0;
 const options={mode:'postmark' as const,stream:'outbound',read:async(path:string)=>{assert.equal(path,'/messages/outbound/provider-id/details');read++;return details;},send:async()=>{sent++;return {messageId:'report-id'};}};
 const result=await processForumReminderReports(f.db,options);
 assert.equal(result.checked,1);assert.equal(result.accepted,1);assert.equal(f.mail.delivery_state,'delivered');assert.equal(f.summary.state,'accepted');
 await processForumReminderReports(f.db,options);assert.equal(sent,1);assert.equal(read,1);
});
test('missing or mismatched provider evidence never counts as delivered; report timeout never resends',async()=>{
 for(const variant of ['pending','mismatched','unavailable']){
  const f=database();let sent=0;
  const options={mode:'postmark' as const,stream:'outbound',read:async()=>{if(variant==='unavailable')throw Error('offline');return variant==='mismatched'?{...details,MessageID:'wrong'}:{...details,MessageEvents:[]};},send:async()=>{sent++;throw new EmailDeliveryError('postmark_delivery_unknown');}};
  const result=await processForumReminderReports(f.db,options);
  assert.equal(f.mail.delivery_state,variant==='pending'?'pending':'unverified');assert.equal(result.uncertain,1);
  await processForumReminderReports(f.db,options);assert.equal(sent,1);
 }
});
test('preview mode does not read Postmark, consume report claims or send anything',async()=>{
 const f=database();await processForumReminderReports(f.db,{mode:'log'});assert.equal(f.rpcCalls(),0);
});
