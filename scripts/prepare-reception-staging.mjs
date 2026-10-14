// Explicit staging fixture preparation. Never resets attendance or existing tokens.
import fs from 'node:fs';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import QRCode from 'qrcode';
import {env,sql,api} from './reception-staging-connection.mjs';
import {encryptQrToken} from '../lib/qrcode/secure-token.ts';
Object.assign(process.env,env);
const dir='.env.collaudo-accoglienza';
fs.mkdirSync(dir,{recursive:true,mode:0o700});
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
const event=JSON.parse(sql("select row_to_json(e) from events e where is_current"));
if(event.slug!=='assisi-2026-test') throw Error('Unexpected current event');
const accounts=[];
for(const [prefix,name,role] of [['accoglienza','Operatore uno','accoglienza'],['accoglienza2','Operatore due','accoglienza'],['admin.accoglienza','Admin collaudo','admin']]){
 const email=`${prefix}.staging@example.invalid`;
 const existing=sql(`select id from auth.users where email=${quote(email)}`);
 const id=existing||(await api('admin/users',{email,email_confirm:true,user_metadata:{full_name:`${name} Test Accoglienza`,test_user:true}})).id;
 if(!id) throw Error('Missing user');
 sql(`begin; insert into profiles(id,email,full_name) values(${quote(id)},${quote(email)},${quote(name+' Test Accoglienza')}) on conflict(id) do nothing; insert into event_user_roles(user_id,event_id,role) select ${quote(id)},${role==='admin'?'null':quote(event.id)},${quote(role)} where not exists(select 1 from event_user_roles where user_id=${quote(id)} and role=${quote(role)} and event_id is not distinct from ${role==='admin'?'null::uuid':quote(event.id)+'::uuid'}); commit;`);
 accounts.push({email,id,role});
}
const manifestPath=`${dir}/campioni.json`;
let samples;
if(fs.existsSync(manifestPath)) samples=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
else {
 samples=['A','B','F','S','X'].map(label=>({label,id:randomUUID(),personId:randomUUID(),token:randomBytes(32).toString('base64url')}));
 fs.writeFileSync(manifestPath,JSON.stringify(samples,null,2),{mode:0o600});
}
let statements=['begin;'];
for(const s of samples){
 const hash=createHash('sha256').update(s.token).digest('hex');
 const enc=encryptQrToken(s.token);
 if(s.label==='S'){
 statements.push(`insert into school_booking_teachers(id,event_id,email,first_name,last_name,phone) values(${quote(s.personId)},${quote(event.id)},'docente.accoglienza.staging@example.invalid','Docente','Test Accoglienza','+39000000') on conflict(id) do nothing; insert into school_bookings(id,event_id,teacher_id,school_name,school_city,class_description,student_count,companion_count,privacy_version,privacy_accepted_at) values(${quote(s.id)},${quote(event.id)},${quote(s.personId)},'Scuola Test Accoglienza','Città fittizia','Classe S collaudo',10,2,'test',now()) on conflict(id) do nothing; insert into school_booking_qr_tokens(booking_id,token_hash,token_encrypted) select ${quote(s.id)},${quote(hash)},${quote(enc)} where not exists(select 1 from school_booking_qr_tokens where booking_id=${quote(s.id)});`);
 } else {
 const name={A:'Alba',B:'Bruno',F:'Francesca',X:'Xavier'}[s.label];
 statements.push(`insert into participants(id,first_name,last_name,participates_with_group) values(${quote(s.personId)},${quote(name)},'Test Accoglienza',false) on conflict(id) do nothing; insert into registrations(id,event_id,participant_id,status,source) values(${quote(s.id)},${quote(event.id)},${quote(s.personId)},'confirmed','public_form') on conflict(id) do nothing; insert into qr_tokens(registration_id,token_hash,token_encrypted,status,revoked_at) select ${quote(s.id)},${quote(hash)},${quote(enc)},${quote(s.label==='X'?'revoked':'active')},${s.label==='X'?'now()':'null'} where not exists(select 1 from qr_tokens where registration_id=${quote(s.id)});`);
 if(s.label==='F') for(const [position,name,date] of [[1,'Luca','2018-01-01'],[2,'Sofia','2020-01-01']]) statements.push(`insert into registration_children(registration_id,position,first_name,last_name,birth_date) select ${quote(s.id)},${position},${quote(name)},'Test Accoglienza',${quote(date)} where not exists(select 1 from registration_children where registration_id=${quote(s.id)} and position=${position});`);
 }
}
statements.push('commit;');sql(statements.join('\n'));
let html='<!doctype html><meta charset="utf-8"><title>Campioni accoglienza staging</title><style>body{font:20px system-ui;max-width:800px;margin:30px auto}section{break-after:page;border-bottom:2px solid;padding:30px}img{width:320px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px}</style><h1>Campioni fittizi — staging</h1><p>QR per lo scanner dell’app. Tutti inizialmente assenti; X è revocato. Non usare in produzione.</p>';
const summary=[];
for(const s of samples){
 const hash=createHash('sha256').update(s.token).digest('hex');
 const result=JSON.parse(sql(`select public.reception_event_check_in('event_entry',${quote(event.id)},${quote(accounts[0].id)},'qr',${quote(hash)});`));
 if(result.status!==(s.label==='X'?'invalid':'valid')) throw Error('Unexpected verification '+s.label);
 const code=s.label==='S'?'Scuola: 10 studenti + 2 accompagnatori':sql(`select public_code from participants where id=${quote(s.personId)}`);
 summary.push({label:s.label,code,status:result.status,kind:result.kind});
 const image=await QRCode.toDataURL(s.token,{width:640,margin:4,errorCorrectionLevel:'M'});
 await QRCode.toFile(`${dir}/${s.label}.png`,s.token,{width:640,margin:4});
 html+=`<section><h2>${s.label} — ${code}</h2><img src="${image}"><p>${s.label==='F'?'Francesca, Luca e Sofia Test Accoglienza':s.label==='X'?'QR revocato — esito non valido atteso':''}</p>${s.label==='S'?`<details><summary>Contenuto QR per correzione manuale</summary><pre>${s.token}</pre></details>`:''}</section>`;
}
fs.writeFileSync(`${dir}/campioni.html`,html,{mode:0o600});
fs.writeFileSync(`${dir}/riepilogo.json`,JSON.stringify({event:event.slug,accounts,samples:summary},null,2),{mode:0o600});
console.log(JSON.stringify({event:event.slug,accounts:accounts.map(a=>({email:a.email,role:a.role})),samples:summary},null,2));
