// Disposable local PostgreSQL only: no application env or remote database access.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const bin='/opt/homebrew/opt/postgresql@17/bin';
const dir=mkdtempSync(join(tmpdir(),'pace-forum-reception-'));
const args=['-h',dir,'-p','55489','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q'];
const psql=(sql,unaligned=false)=>execFileSync(join(bin,'psql'),unaligned?[...args,'-tA']:args,{input:sql,encoding:'utf8',maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']});
const file=path=>execFileSync(join(bin,'psql'),[...args,...(path.startsWith('supabase/migrations/')?['-1']:[]),'-f',path],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
let started=false;
try {
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-U','postgres','-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'postgres.log'),'-o',`-k ${dir} -p 55489 -c listen_addresses=''`,'-w','start'],{stdio:'pipe'});started=true;
 psql(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create schema auth; create table auth.users(id uuid primary key,email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 grant usage on schema auth to anon,authenticated,service_role;
 grant execute on all functions in schema auth to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to service_role;
 alter default privileges in schema public grant all on sequences to service_role;`);
 for(const name of readdirSync('supabase/migrations').filter(x=>x.endsWith('.sql')).sort()) {
  if(name==='20260813170000_rename_anziani_and_amici_groups.sql')continue;
  if(name==='20261020140000_explicit_forum_children.sql') {
   const seed=readFileSync('tests/sql/forum-waitlist.sql','utf8').split("select set_config('request.jwt.claim.sub'")[0].replace(/^begin;|^commit;/gm,'');
   psql(`begin;${seed}
    insert into registration_children(id,registration_id,position,first_name,last_name,birth_date) values(fw(910),fw(101),1,'Before','Migration','2018-01-01');
    select set_config('request.jwt.claim.sub',fw(1)::text,true);
    select set_individual_panel_booking(fw(101),fw(403),fw(503),true);
    select set_individual_panel_waitlist(fw(101),fw(406),fw(506),'join');
    set constraints all immediate;
    create temp table before_choices as select * from moment_attendance_choices;
    create temp table before_waitlist as select * from panel_waitlist;
    create temp table before_occupancy as select id,app.panel_section_occupancy(id) seats from panel_seat_sections;
    ${readFileSync(join('supabase/migrations',name),'utf8')}
    do $$ begin
     assert not exists((select * from moment_attendance_choices except select * from before_choices) union all (select * from before_choices except select * from moment_attendance_choices));
     assert not exists((select * from panel_waitlist except select * from before_waitlist) union all (select * from before_waitlist except select * from panel_waitlist));
     assert not exists(select 1 from before_occupancy b where b.seats<>app.panel_section_occupancy(b.id));
     assert app.panel_child_ids(fw(101),fw(403))=array[fw(910)];
     assert app.panel_child_ids(fw(101),fw(406))=array[fw(910)];
    end $$;rollback;`);
   console.log('PASS migration backfill preserves exact existing bookings, waiting requests, selected minors and every section occupancy');
  }
  if(name==='20261023130000_reception_all_duties.sql') {
   const seed=readFileSync('tests/sql/forum-waitlist.sql','utf8').split("select set_config('request.jwt.claim.sub'")[0].replace(/^begin;|^commit;/gm,'');
   const migration=readFileSync(join('supabase/migrations',name),'utf8').replace(/^begin;|^commit;/gm,'');
   psql(`begin;${seed}
    insert into panel_reception_assignments(event_id,user_id,panel_id,duty,created_by)
     values(fw(200),fw(8),fw(403),'panel_entry',fw(11)),(fw(200),fw(9),fw(403),'room_assistance',fw(11));
    insert into ceremony_reception_assignments values(fw(200),fw(7),'opening',fw(11));
    create temp table before_roles as select * from event_user_roles;
    ${migration}
    do $$ begin
     assert cardinality(app.reception_duty_keys(fw(200),fw(8)))=8;
     assert cardinality(app.reception_duty_keys(fw(200),fw(7)))=8;
     assert cardinality(app.reception_duty_keys(fw(200),fw(9)))=0;
     assert exists(select 1 from panel_reception_assignments where user_id=fw(9) and duty='room_assistance');
     assert (select count(*)=2 from audit_logs where action='reception.duties_completed');
     assert not exists((select * from event_user_roles except select * from before_roles) union all (select * from before_roles except select * from event_user_roles));
    end $$;
    ${migration}
    do $$ begin assert (select count(*)=2 from audit_logs where action='reception.duties_completed');end $$;
    rollback;`);
   console.log('PASS existing Forum and ceremony operators expanded, assistance-only and general roles unchanged, migration idempotent');
  }
  if(name==='20261025190000_reception_relay_room_statistics.sql') {
   const migration=readFileSync(join('supabase/migrations',name),'utf8').replace(/^begin;|^commit;/gm,'');
   const after=readFileSync('tests/sql/registration-verification-preservation-after.sql','utf8').replaceAll('reception_registration_check(uuid,uuid,text,text)','reception_relay_room_statistics(uuid,uuid,uuid)');
   psql('begin;'+readFileSync('tests/sql/registration-verification-preservation-before.sql','utf8')+migration+after+'commit;');
   console.log('PASS relay statistics migration preserves all rows, existing functions/ACL, policies and triggers');
   continue;
  }
  if(name==='20261024160000_reception_registration_check.sql') {
   const migration=readFileSync(join('supabase/migrations',name),'utf8').replace(/^begin;|^commit;/gm,'');
   psql('begin;'+readFileSync('tests/sql/registration-verification-preservation-before.sql','utf8')+migration+readFileSync('tests/sql/registration-verification-preservation-after.sql','utf8')+'commit;');
   console.log('PASS registration verification migration preserves every table row, existing function/ACL, policy and trigger');
   continue;
  }
  try {file(join('supabase/migrations',name));}catch(e){throw new Error(`Migration ${name}: ${e.stderr}`);}
 }
 console.log(file('tests/sql/forum-waitlist.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n'));
 console.log(file('tests/sql/registration-verification.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n'));
 console.log(file('tests/sql/reception-morning-early.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n'));
 console.log(file('tests/sql/reception-duty-windows.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n'));
 console.log(file('tests/sql/forum-event-reception.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n'));
 console.log(file('tests/sql/reception-relay-statistics.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n'));
 console.log(file('tests/sql/school-qr-reception.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n'));
 psql(`select set_reception_duties(fw(200),fw(11),fw(8),array[fw(406)::text]);
 select set_reception_duties(fw(200),fw(11),fw(9),array[fw(406)::text]);`);
 const concurrent=sql=>new Promise((resolve,reject)=>{const proc=spawn(join(bin,'psql'),[...args,'-tA'],{stdio:['pipe','pipe','pipe']});let out='',err='';proc.stdout.on('data',x=>out+=x);proc.stderr.on('data',x=>err+=x);proc.on('error',reject);proc.on('exit',code=>code===0?resolve(out.trim()):reject(new Error(err)));proc.stdin.end(sql);});
 const competing=await Promise.all([7,8].map(n=>concurrent(`set role service_role;select reception_desk(fw(200),fw(${n+1}),fw(406)::text,'code','QQQ${n}','book',fw(506),'{}',fw(${1100+n}))->>'status';`)));
 if(competing.filter(x=>x==='saved').length!==1 || competing.filter(x=>x==='capacity_exceeded').length!==1) throw new Error('Last seat race: '+competing.join(','));
 console.log('PASS two independent reception desks compete for the last seat: one reservation, one capacity refusal');
 psql(`select set_reception_duties(fw(200),fw(10),fw(8),array[fw(401)::text]);
 insert into school_booking_teachers(id,event_id,email,first_name,last_name,phone) values(fw(4996),fw(200),'school-race@example.invalid','Teacher','Race','+39000000');
 insert into school_bookings(id,event_id,teacher_id,school_name,school_city,class_description,student_count,companion_count,privacy_version,privacy_accepted_at)
 values(fw(4997),fw(200),fw(4996),'School race','Test','1A',3,1,'test',now());
 insert into school_booking_qr_tokens(booking_id,token_hash,token_encrypted) values(fw(4997),repeat('e',64),'synthetic');
 insert into school_panel_reservations(event_id,booking_id,panel_id,seat_section_id,student_count,companion_count) values(fw(200),fw(4997),fw(401),fw(550),3,1);`);
 const schoolRace=await Promise.all([
 concurrent(`set role service_role;select reception_panel_check_in('panel_entry',fw(401),fw(200),fw(8),'qr',repeat('e',64),'enter',fw(4998),'{}',3,1,null,'school_event_entry')->>'status';`),
 concurrent(`set role service_role;select reception_event_check_in('event_entry',fw(200),fw(10),'qr',repeat('e',64),'enter',fw(4999),'{}',3,1)->>'status';`)
 ]);
 if(schoolRace.some(x=>x!=='valid') || psql('select count(*) from check_ins where school_booking_id=fw(4997) and cancelled_at is null;',true).trim()!=='2')throw new Error('School event/Forum concurrent entry failed');
 console.log('PASS concurrent general reception and school Forum entry create exactly one event and one Forum entry');
 if(process.argv.includes('--browser')) { const {checkForumReception}=await import('../browser/forum-event-reception.mjs'); await checkForumReception(psql); }
} catch(error) { console.error(error.stderr?.toString() || error); if(!started) {try {console.error(readFileSync(join(dir,'postgres.log'),'utf8'));} catch {}} process.exitCode=1;
} finally {
 if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'pipe'});
 rmSync(dir,{recursive:true,force:true});
}
