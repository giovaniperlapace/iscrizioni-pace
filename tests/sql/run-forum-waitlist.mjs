// Disposable local PostgreSQL only: no application env or remote database access.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const bin='/opt/homebrew/opt/postgresql@17/bin';
const dir=mkdtempSync(join(tmpdir(),'pace-forum-queue-'));
const args=['-h',dir,'-p','55483','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q'];
const psql=(sql,unaligned=false)=>execFileSync(join(bin,'psql'),unaligned?[...args,'-tA']:args,{input:sql,encoding:'utf8',maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']});
const file=path=>execFileSync(join(bin,'psql'),[...args,...(path.startsWith('supabase/migrations/')?['-1']:[]),'-f',path],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
let started=false;
try {
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-U','postgres','-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'postgres.log'),'-o',`-k ${dir} -p 55483 -c listen_addresses=''`,'-w','start'],{stdio:'pipe'});started=true;
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
  try {file(join('supabase/migrations',name));}catch(e){throw new Error(`Migration ${name}: ${e.stderr}`);}
 }
 console.log('PASS canonical migrations and Forum queue applied to disposable PostgreSQL');
 try { console.log(file('tests/sql/forum-waitlist.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n')); } catch(e) {throw new Error(e.stderr);}
 try { console.log(file('tests/sql/group-panel-waitlist.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n')); } catch(e) {throw new Error(e.stderr);}
 console.log(file('tests/sql/group-forum-read-only.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n'));
 console.log(file('tests/sql/admin-forum-opening.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n'));
 console.log(file('tests/sql/explicit-forum-children.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n'));
 if(process.argv.includes('--group-browser')) { const {checkGroupForumServerActions}=await import('../browser/group-forum-waitlist-actions.mjs');await checkGroupForumServerActions(psql,process.env.GROUP_FORUM_BROWSER_URL); }
 if(process.argv.includes('--browser')) {
  psql(`update panel_waitlist set status='cancelled' where registration_id=fw(103) and status='waiting';`);
  const {checkForumServerActions}=await import('../browser/forum-waitlist-actions.mjs');await checkForumServerActions(psql);
  psql(`select set_config('request.jwt.claim.sub',fw(3)::text,false);select set_individual_panel_booking(fw(103),fw(401),fw(501),false);
   select set_individual_panel_booking(fw(103),fw(402),fw(502),true);update panel_seat_sections set capacity=1 where id=fw(501);
   select set_individual_panel_waitlist(fw(103),fw(401),fw(501),'join');`);
 }
 const concurrent=sql=>new Promise((resolve,reject)=>{const proc=spawn(join(bin,'psql'),args,{stdio:['pipe','pipe','pipe']});let out='',err='';proc.stdout.on('data',x=>out+=x);proc.stderr.on('data',x=>err+=x);proc.on('error',reject);proc.on('exit',code=>code===0?resolve(out):reject(new Error(err)));proc.stdin.end(sql);});
 console.log(file('tests/sql/forum-attendance-required.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n'));
 // Claims, last-seat bookings and an acceptance race are checked on independent connections.
 psql(`update panel_waitlist_scheduler set next_run_at=clock_timestamp(); update panel_seat_sections set capacity=2 where id=fw(501);
 `);
 const claims=await Promise.all(Array.from({length:6},()=>concurrent(`set role service_role;select claim_panel_waitlist_notification()->>'id';`)));
 const ids=claims.flatMap(x=>x.match(/[a-f0-9]{8}-[a-f0-9-]{27}/g)??[]);
 assert.equal(ids.length,1);assert.equal(new Set(ids).size,1);
 console.log('PASS six concurrent workers claim each invitation once');
 const accepts=await Promise.all(Array.from({length:6},()=>concurrent(`select set_config('request.jwt.claim.sub',fw(3)::text,false);set role authenticated;
 select set_individual_panel_waitlist(fw(103),fw(401),fw(501),'accept')->>'status';`)));
 assert.ok(accepts.every(x=>/booked/.test(x)));
 assert.match(psql(`select count(*)=1 from moment_attendance_choices where registration_id=fw(103) and moment_id=fw(401) and choice='yes';`),/\bt\b/);
 console.log('PASS concurrent acceptance retries preserve one booking');
 // New separate section has one final seat and no queue.
 await Promise.all([4,5].map(n=>concurrent(`select set_config('request.jwt.claim.sub',fw(${n})::text,false);set role authenticated;
 do $$ begin perform set_individual_panel_booking(fw(${100+n}),fw(406),fw(506),true);raise notice 'booked';
 exception when sqlstate 'P0001' then raise notice 'full';end $$;
 select count(*) from moment_attendance_choices where moment_id=fw(406) and choice='yes';`)));
 assert.match(psql(`select count(*)=1 from moment_attendance_choices where moment_id=fw(406) and choice='yes';`),/\bt\b/);
 console.log('PASS competing ordinary bookings cannot both take the last seat');
 try { console.log(file('tests/sql/forum-unpublication.sql').split('\n').filter(line=>line.startsWith('PASS ')).join('\n')); } catch(e) {throw new Error(e.stderr);}
 if(process.argv.includes('--unpublish-browser')) { const {checkForumUnpublication}=await import('../browser/forum-unpublication.mjs');await checkForumUnpublication(psql); }
 const {checkGroupWaitlistConcurrency}=await import('./group-panel-waitlist-concurrency.mjs');await checkGroupWaitlistConcurrency(psql,concurrent);
} finally {
 if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'pipe'});
 rmSync(dir,{recursive:true,force:true});
}
