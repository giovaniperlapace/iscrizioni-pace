// Official validation-only token: Postmark validates these synthetic payloads but delivers nothing.
import { renderForumReminderEmail, renderForumReminderDigest } from '../lib/panels/reminder-email.ts';
import { renderForumReminderReport } from '../lib/panels/reminder-report.ts';
import { sendTransactionalEmail } from '../lib/email/smtp.ts';
Object.assign(process.env, { NODE_ENV:'test', EMAIL_DELIVERY_MODE:'postmark', POSTMARK_SERVER_TOKEN:'POSTMARK_API_TEST',
 EMAIL_FROM:'registrationspeace@santegidio.org', EMAIL_REPLY_TO:'registrationspeace@santegidio.org',
 POSTMARK_TRANSACTIONAL_STREAM:'outbound', POSTMARK_BROADCAST_STREAM:'broadcast' });
const id='00000000-0000-4000-8000-000000000001';
const payload={eventId:id,registrationId:id,panelId:id,title:'Forum sintetico <test>',startsAt:'2026-10-27T09:00:00Z',endsAt:'2026-10-27T11:00:00Z',location:'Sala sintetica',address:'Via Esempio 42',city:'Assisi',locale:'it',name:'Persona sintetica',children:['Minore sintetico'],relay:false};
const report={id,claim:id,payload:{title:payload.title,startsAt:payload.startsAt,location:payload.location,address:payload.address,checkedAt:'2026-10-27T07:10:00Z',total:100,accepted:97,delivered:90,bounced:2,pending:4,unverified:1,failed:1,uncertain:1,skipped:1,personal:90,digests:7,missingAddress:0}};
const variants=[
 ['personal',{to:'synthetic@example.com',...renderForumReminderEmail(payload),metadata:{forum_reminder_id:id}}],
 ['relay',{to:'synthetic@example.com',...renderForumReminderEmail({...payload,relay:true}),metadata:{forum_reminder_id:id}}],
 ['digest-1005',{to:'synthetic@example.com',...renderForumReminderDigest(Array.from({length:1005},(_,i)=>({...payload,name:`Persona sintetica ${i}`})),'it'),metadata:{forum_reminder_id:id}}],
 ['report',renderForumReminderReport(report)],
];
for(const [name,email] of variants){
 const result=await sendTransactionalEmail(email);
 if(!result.messageId)throw Error('validation failed');
 console.log(`PASS ${name}: Postmark accepted validation-only payload; no delivery`);
}
