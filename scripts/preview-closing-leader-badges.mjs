// Synthetic preview only: no database, environment file or real email delivery.
import { mkdirSync,writeFileSync } from 'node:fs';
import { prepareClosingBadgeEmail } from '../lib/ceremonies/closing-email.server.ts';
import { CLOSING_BADGE_SECTORS } from '../lib/ceremonies/closing-badges.ts';
const id='00000000-0000-4000-8000-000000000001';
const names=['Alessandra Maria Francesca Della Rovere De Santis (esempio)', 'Anna Rossi (esempio)', 'François Müller (esempio)', 'Марія Петренко (приклад)', 'João Gonçalves (esempio)', 'Sofia Bianchi (esempio)', 'Luca Moretti (esempio)', 'Elena Costa (esempio)', 'Andrea Ferri (esempio)', 'Giulia Romano (esempio)'];
const notice={id,claim:id,eventId:id,userId:id,registrationId:null,payload:{kind:'closing',badgeWorkflow:true,noticeType:'leader_contacts',title:'Cerimonia finale',startsAt:'2026-10-27T15:15:00Z',snapshotAt:'2026-10-26T18:00:00Z',location:'Sede sintetica',
 instructions:Object.fromEntries(CLOSING_BADGE_SECTORS.map(s=>[s.code,{it:'ISTRUZIONI SINTETICHE',en:'SYNTHETIC INSTRUCTIONS'}])),
 lines:CLOSING_BADGE_SECTORS.flatMap((sector,s)=>names.map((name,i)=>({name,nomineeId:`synthetic-${s}-${i}`,groupId:id,groupName:'Gruppo dimostrativo',sector:sector.name,badgeCode:sector.code,communicationDelegated:true})))}};
const email=await prepareClosingBadgeEmail(notice,'https://example.invalid');
mkdirSync('output/pdf',{recursive:true});
for(const file of email.attachments){writeFileSync(`output/pdf/anteprima-${file.filename}`,file.content);console.log(file.filename,file.content.length);}
writeFileSync('output/pdf/anteprima-report-badge.html',email.html);
