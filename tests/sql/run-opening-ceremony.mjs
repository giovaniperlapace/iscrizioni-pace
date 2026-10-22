// Disposable local PostgreSQL only: no application env or remote database access.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const bin='/opt/homebrew/opt/postgresql@17/bin';
const dir=mkdtempSync(join(tmpdir(),'pace-opening-'));
const args=['-h',dir,'-p','55484','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q'];
const psql=(sql,unaligned=false)=>execFileSync(join(bin,'psql'),unaligned?[...args,'-tA']:args,{input:sql,encoding:'utf8',maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']});
const file=(path,atomic=false)=>execFileSync(join(bin,'psql'),[...args,...((atomic || path.startsWith('supabase/migrations/'))?['-1']:[]),'-f',path],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
let started=false;
try {
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-U','postgres','-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'postgres.log'),'-o',`-k ${dir} -p 55484 -c listen_addresses=''`,'-w','start'],{stdio:'pipe'});started=true;
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
  const guard=process.argv.find(x=>x.startsWith('--guarded-migration='))?.slice('--guarded-migration='.length);
  if(guard && name===(process.argv.find(x=>x.startsWith('--guarded-name='))?.slice('--guarded-name='.length)??'20261021180000_opening_ceremony_layout.sql')) {
   psql('create schema if not exists supabase_migrations;create table if not exists supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);');
   file(guard,true);continue;
  }
  if(name==='20261022150000_opening_rear_blocks_sector_e.sql') {
   const seed=readFileSync('tests/sql/reception-check-ins.sql','utf8').split('set role service_role;')[0];
   const [setup,checks]=readFileSync('tests/sql/opening-rear-blocks-sector-e.sql','utf8').split('-- APPLY REAR BLOCK MIGRATION HERE');
   const rearGuard=process.argv.find(x=>x.startsWith('--rear-guard='))?.slice('--rear-guard='.length);
   const migration=readFileSync(rearGuard??join('supabase/migrations',name),'utf8');
   try {console.log(psql('begin;'+seed+setup+migration+checks+'rollback;').split('\n').filter(line=>line.includes('PASS')).join('\n'));}
   catch(e){throw new Error(`Rear conversion regression: ${e.stderr}`);}
   const occupied="select save_ceremony(f(1),f(31),'opening',(select revision from ceremony_plans where kind='opening'),'allocate',jsonb_build_object('id',f(9804),'quotaId',(select q.id from ceremony_quotas q join ceremony_sectors s on s.id=q.sector_id where s.layout_code='H1'),'registrationId',f(11),'quantity',1));";
   for(const [change,message] of [[occupied,'H allocations or claims exist'],["update ceremony_quotas set quantity=69 where sector_id=(select id from ceremony_sectors where layout_code='H2');",'Unexpected H configuration']]) {
    assert.throws(()=>psql('begin;'+seed+setup+change+migration+'commit;'),error=>String(error.stderr).includes(message));
    assert.equal(psql('select count(*) from ceremony_plans',true).trim(),'0');
   }
   console.log('PASS rear conversion refuses occupied H or changed quota and rolls back completely');
  }
  if(name==='20261022180000_ceremony_unified_b_and_seat_revoke.sql') {
   const seed=readFileSync('tests/sql/reception-check-ins.sql','utf8').split('set role service_role;')[0];
   const [setup,checks]=readFileSync('tests/sql/ceremony-unified-b.sql','utf8').split('-- APPLY UNIFIED B MIGRATION HERE');
   const unifiedGuard=process.argv.find(x=>x.startsWith('--b-guard='))?.slice('--b-guard='.length);
   const migration=readFileSync(unifiedGuard??join('supabase/migrations',name),'utf8');
   try {console.log(psql('begin;'+seed+setup+migration+checks+'rollback;').split('\n').filter(line=>line.includes('PASS')).join('\n'));}
   catch(e){throw new Error(`B conversion regression: ${e.stderr}`);}
   const occupied="select save_ceremony(f(1),f(31),'opening',(select revision from ceremony_plans where kind='opening'),'allocate',jsonb_build_object('id',f(9804),'quotaId',(select q.id from ceremony_quotas q join ceremony_sectors s on s.id=q.sector_id where s.layout_code='B2'),'registrationId',f(11),'quantity',1));";
   for(const [change,message] of [[occupied,'B allocations or claims exist'],["update ceremony_quotas set quantity=299 where sector_id=(select id from ceremony_sectors where layout_code='B1');",'Unexpected B quota or seats']]) {
    assert.throws(()=>psql('begin;'+seed+setup+change+migration+'commit;'),error=>String(error.stderr).includes(message));
    assert.equal(psql('select count(*) from ceremony_plans',true).trim(),'0');
   }
   console.log('PASS B unification refuses existing B allocation or changed quota without modifying data');
  }
  try {file(join('supabase/migrations',name));} catch(e) {throw new Error(`Migration ${name}: ${e.stderr}`);}
 }
 psql(readFileSync('tests/sql/reception-check-ins.sql','utf8').split('set role service_role;')[0]);
 for (const name of ['ceremony-allocations','ceremony-distribution','ceremony-seat-maps','opening-ceremony-layout','ceremony-seats-desk','ceremony-leader-pairing']) {
   try { console.log(file(`tests/sql/${name}.sql`).split('\n').filter(line=>line.includes('PASS')).join('\n')); }
   catch(e) {throw new Error(`${name}: ${e.stderr}`);}
 }
 try { console.log(psql(readFileSync('tests/sql/ceremony-seats-desk.sql','utf8').replace(/rollback;\s*$/, '') + readFileSync('tests/sql/ceremony-assignment-history.sql','utf8') + '\nrollback;').split('\n').filter(line=>line.includes('PASS')).join('\n')); } catch(e) { throw new Error('History: '+e.stderr); }
 try {console.log(psql(readFileSync('tests/sql/ceremony-seats-desk.sql','utf8').replace(/rollback;\s*$/, '') + readFileSync('tests/sql/ceremony-seat-revoke.sql','utf8') + '\nrollback;').split('\n').filter(line=>line.includes('PASS')).join('\n'));}catch(e){throw new Error('Seat revoke: '+e.stderr);}
 const exportFile=process.argv.find(x=>x.startsWith('--export-fixture='))?.slice('--export-fixture='.length);
 {
  psql(`select prepare_opening_ceremony_layout(f(1),f(33),-1);
   select save_ceremony(f(1),f(33),'opening',(select revision from ceremony_plans where kind='opening'),'configure','{"location":"Synthetic hall","capacity":3540,"startsAt":"2026-10-25T16:30","endsAt":"2026-10-25T19:00","state":"validated","attendancePart":"afternoon"}');
   select set_ceremony_map(f(1),f(33),(select id from ceremony_plans where kind='opening'),(select revision from ceremony_plans where kind='opening'),f(9990),'publish',jsonb_build_object('versionId',(select id from ceremony_map_versions where state='draft')));`);
  if(exportFile) writeFileSync(exportFile,psql(`select jsonb_build_object('snapshot',get_ceremony(f(1),f(33),'opening'),'desk',get_ceremony_seats_desk(f(1),f(33),'opening'),'map',get_ceremony_map(f(1),f(33),(select id from ceremony_plans where kind='opening')));`,true).trim());
 }
 psql(`delete from event_attendance_choices where registration_id in(f(10),f(11));insert into event_attendance_choices(registration_id,day,day_part,choice) values(f(10),'2026-10-25','afternoon','yes'),(f(11),'2026-10-25','afternoon','yes');
  update ceremony_quotas set quantity=1 where sector_id=(select id from ceremony_sectors where layout_code='A1');`);
 const revision=Number(psql("select revision from ceremony_plans where kind='opening'",true).trim());
 const concurrent=sql=>new Promise((resolve,reject)=>{const child=spawn(join(bin,'psql'),[...args,'-tA'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('exit',code=>code===0?resolve(out.trim()):reject(Error(err)));child.stdin.end(sql);});
 const race=await Promise.all([31,33].map((actor,i)=>concurrent(`set role service_role;select assign_ceremony_seats(f(1),f(${actor}),(select id from ceremony_plans where kind='opening'),${revision},f(${9970+i}),jsonb_build_object('action','assign','sectorId',(select id from ceremony_sectors where layout_code='A1'),'quantity',1,'seatIds',jsonb_build_array((select s->>'id' from ceremony_map_versions v,jsonb_array_elements(v.seats) s where v.state='published' and (s->>'sectorId')::uuid=(select id from ceremony_sectors where layout_code='A1') limit 1)),'subjects',jsonb_build_array(jsonb_build_object('registrationId',f(${i===0?10:11}),'childId',${i===0?'f(40)':'null'}))))->>'status';`)));
 assert.equal(race.filter(x=>x==='saved').length,1);assert.equal(race.filter(x=>x==='conflict').length,1);
 assert.equal(psql("select count(*) from ceremony_nominees where revoked_at is null",true).trim(),'1');
 assert.equal(psql("select count(*) from ceremony_seat_claims where released_at is null and nominee_id is not null",true).trim(),'1');
 console.log('PASS atomic desk Manager/Admin race: one final chair, one save, one conflict, one nominal assignment');
 const revokeRevision=Number(psql("select revision from ceremony_plans where kind='opening'",true).trim());
 const revokeTarget=psql("select seat_id from ceremony_seat_claims where released_at is null",true).trim();
 const revokes=await Promise.all([31,33].map((actor,i)=>concurrent(`set role service_role;select revoke_ceremony_seat(f(1),f(${actor}),(select id from ceremony_plans where kind='opening'),${revokeRevision},f(${9980+i}),'${revokeTarget}')->>'status';`)));
 assert.deepEqual(revokes.sort(),['conflict','saved']);
 assert.equal(psql("select count(*) from ceremony_seat_claims where released_at is null",true).trim(),'0');
 assert.equal(psql("select count(*) from ceremony_nominees where revoked_at is null",true).trim(),'0');
 assert.equal(psql("select count(*) from ceremony_nominees where revoked_at is not null",true).trim(),'1');
 console.log('PASS concurrent single-chair revocations: one save, one conflict, historical nominee retained, chair freed once');
 const browserBase=process.argv.find(x=>x.startsWith('--browser-base='))?.slice('--browser-base='.length);
 if(browserBase) {
  psql(`truncate ceremony_seat_claims,ceremony_nominees,ceremony_allocations,ceremony_map_requests,ceremony_distribution_requests cascade;
   update ceremony_quotas set quantity=100 where sector_id=(select id from ceremony_sectors where layout_code='A1');
   insert into groups(id,event_id,name,is_active) values('11111111-1111-4111-8111-111111111111',f(1),'Delegazione prova',true);
   select group_reception_credential(f(1),f(33),'11111111-1111-4111-8111-111111111111','get',encode(extensions.digest(repeat('g',43),'sha256'),'hex'),'synthetic');
   insert into participant_group_assignments(registration_id,group_id,is_current,source,status) values(f(10),'11111111-1111-4111-8111-111111111111',true,'manager','confirmed');
   delete from event_attendance_choices where registration_id in(f(10),f(11));`);
  execFileSync(process.execPath,['tests/browser/ceremony-seats-desk.mjs',browserBase,process.env.CEREMONY_BROWSER_ROOT],{env:{...process.env,CEREMONY_TEST_SOCKET:dir},stdio:'inherit'});
  assert.equal(psql("select count(*) from ceremony_nominees where revoked_at is null",true).trim(),'1');
  assert.equal(psql("select count(*) from ceremony_seat_claims where released_at is null",true).trim(),'0');
  assert.equal(psql("select sum(quantity) from ceremony_allocations where group_id='11111111-1111-4111-8111-111111111111' and revoked_at is null",true).trim(),'3');
 }
 const leaderBase=process.argv.find(x=>x.startsWith('--leader-browser-base='))?.slice('--leader-browser-base='.length);
 if(leaderBase) {
  psql('truncate ceremony_plans cascade;'+readFileSync('tests/sql/ceremony-leader-pairing.sql','utf8').split('-- BEGIN PAIR TESTS')[0].replace(/^begin;/,'')+'commit;');
  const pairRevision=Number(psql("select revision from ceremony_plans where kind='opening'",true).trim());
  const pairAllocation=psql("select a.id from ceremony_allocations a join ceremony_quotas q on q.id=a.quota_id join ceremony_sectors s on s.id=q.sector_id where a.group_id=f(7701) and s.name='B'",true).trim();
  const pairSeat=psql(`select seat_id from ceremony_seat_claims where allocation_id='${pairAllocation}' and released_at is null order by seat_id limit 1`,true).trim();
  const paired=await Promise.all([36,31].map((actor,i)=>concurrent(`set role service_role;select pair_ceremony_group_ticket(f(1),f(${actor}),'${pairAllocation}',${pairRevision},f(${7780+i}),'assign','${pairSeat}',f(10),${i?'f(40)':'null'},null)->>'status';`)));
  assert.deepEqual(paired.sort(),['conflict','saved']);
  psql(`select pair_test('revoke',null,null,null,(select id from ceremony_nominees where revoked_at is null));`);
  assert.equal(psql("select count(*) from ceremony_nominees where revoked_at is null",true).trim(),'0');
  assert.equal(psql("select count(*) from ceremony_seat_claims where released_at is null",true).trim(),'4');
  console.log('PASS concurrent leader pairing: one atomic save, one conflict; cancellation preserves the group reserve');
  psql(`insert into participants(id,first_name,last_name,public_code) select f(80000+n),'Synthetic','Member '||lpad(n::text,3,'0'),'L'||lpad(n::text,3,'0') from generate_series(1,105) n;
    insert into registrations(id,event_id,participant_id,status) select f(81000+n),f(1),f(80000+n),'submitted' from generate_series(1,105) n;
    insert into participant_group_assignments(registration_id,group_id,is_current,source,status) select f(81000+n),f(7701),true,'manager','confirmed' from generate_series(1,105) n;`);
  execFileSync(process.execPath,['tests/browser/ceremony-leader-tickets.mjs',leaderBase,process.env.CEREMONY_BROWSER_ROOT],{env:{...process.env,CEREMONY_TEST_SOCKET:dir},stdio:'inherit'});
  assert.equal(psql("select count(*) from ceremony_nominees where revoked_at is null",true).trim(),'0');
  assert.equal(psql("select count(*) from ceremony_seat_claims where released_at is null",true).trim(),'4');
  assert.equal(psql("select sum(quantity) from ceremony_allocations where revoked_at is null",true).trim(),'5');
 }
 console.log('PASS complete ceremony migrations and SQL regression on disposable PostgreSQL');
} finally {
 if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'pipe'});
 rmSync(dir,{recursive:true,force:true});
}
