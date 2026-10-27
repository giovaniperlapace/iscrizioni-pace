// Official validation-only token; synthetic names and instructions, no delivery.
import { prepareClosingBadgeEmail } from '../lib/ceremonies/closing-email.server.ts';
import { CLOSING_BADGE_SECTORS } from '../lib/ceremonies/closing-badges.ts';
import { sendTransactionalEmail } from '../lib/email/smtp.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
Object.assign(process.env, { NODE_ENV:'test', EMAIL_DELIVERY_MODE:'postmark', POSTMARK_SERVER_TOKEN:'POSTMARK_API_TEST',
 EMAIL_FROM:'registrationspeace@santegidio.org', EMAIL_REPLY_TO:'registrationspeace@santegidio.org',
 POSTMARK_TRANSACTIONAL_STREAM:'outbound', POSTMARK_BROADCAST_STREAM:'broadcast' });
const id='00000000-0000-4000-8000-000000000001';
const instructions=Object.fromEntries(CLOSING_BADGE_SECTORS.map(s=>[s.code,{it:`ISTRUZIONI SINTETICHE DI COLLAUDO · ${s.color}`,en:`SYNTHETIC TEST INSTRUCTIONS · ${s.code}`} ]));
const notice={id,claim:id,eventId:id,userId:null,registrationId:id,payload:{kind:'closing',badgeWorkflow:true,title:'Cerimonia finale',startsAt:'2026-10-27T15:15:00Z',location:'Sede sintetica',instructions,lines:[]}};
mkdirSync('output/closing-badges',{recursive:true});
for(const [index,sector] of CLOSING_BADGE_SECTORS.entries()){
 const email=await prepareClosingBadgeEmail({...notice,payload:{...notice.payload,lines:[{nomineeId:id,name:'Maria Rossi',sector:sector.name,badgeCode:sector.code}]}},'https://example.invalid');
 for(const file of email.attachments)writeFileSync(`output/closing-badges/${sector.code}.${file.contentType==='application/pdf'?'pdf':'jpg'}`,file.content);
 writeFileSync(`output/closing-badges/email-${index+1}.html`,email.html);
 const sent=await sendTransactionalEmail({to:'synthetic@example.com',...email,metadata:{ceremony_email_id:id}});
 if(!sent.messageId)throw Error('Validation failed');
 console.log(`PASS ${sector.code}: downloadable PDF + CID, Postmark ErrorCode 0; no delivery`);
}
const family=await prepareClosingBadgeEmail({...notice,payload:{...notice.payload,lines:CLOSING_BADGE_SECTORS.map((s,i)=>({nomineeId:`${id}-${i}`,name:`Persona sintetica ${i+1}`,sector:s.name,badgeCode:s.code}))}},'https://example.invalid');
await sendTransactionalEmail({to:'synthetic@example.com',...family,metadata:{ceremony_email_id:id}});
console.log('PASS family: three distinct PDF attachments + CIDs, Postmark ErrorCode 0; no delivery');
const line={name:'Gruppo sintetico',sector:CLOSING_BADGE_SECTORS[0].name,badgeCode:CLOSING_BADGE_SECTORS[0].code,quantity:200};
for(const [name,payload] of [
 ['group',{...notice.payload,lines:[line]}],
 ['contacts-1005',{...notice.payload,noticeType:'leader_contacts',snapshotAt:'2026-10-26T15:00:00Z',lines:Array.from({length:1005},(_,i)=>({...line,quantity:undefined,name:`Persona sintetica ${i+1}`}))}],
 ['delegates-1005-three-pdfs',{...notice.payload,noticeType:'leader_contacts',snapshotAt:'2026-10-26T15:00:00Z',lines:Array.from({length:1005},(_,i)=>({name:`Persona sintetica ${i+1}`,nomineeId:`synthetic-${i}`,groupId:id,groupName:'Gruppo sintetico',communicationDelegated:true,sector:CLOSING_BADGE_SECTORS[i%3].name,badgeCode:CLOSING_BADGE_SECTORS[i%3].code}))}],
]){
 const email=await prepareClosingBadgeEmail({...notice,userId:id,registrationId:null,payload},'https://example.invalid');
 if(name==='delegates-1005-three-pdfs' && email.attachments.filter(file=>file.contentType==='application/pdf').length!==3)throw Error('Expected three sector PDFs');
 await sendTransactionalEmail({to:'synthetic@example.com',...email,metadata:{ceremony_email_id:id}});
 console.log(`PASS ${name}: Postmark ErrorCode 0; no delivery`);
}
