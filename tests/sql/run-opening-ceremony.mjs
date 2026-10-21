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
const file=path=>execFileSync(join(bin,'psql'),[...args,...(path.startsWith('supabase/migrations/')?['-1']:[]),'-f',path],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
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
  if(guard && name==='20261021180000_opening_ceremony_layout.sql') {
   psql('create schema if not exists supabase_migrations;create table if not exists supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);');
   file(guard);continue;
  }
  try {file(join('supabase/migrations',name));} catch(e) {throw new Error(`Migration ${name}: ${e.stderr}`);}
 }
 psql(readFileSync('tests/sql/reception-check-ins.sql','utf8').split('set role service_role;')[0]);
 for (const name of ['ceremony-allocations','ceremony-distribution','ceremony-seat-maps','opening-ceremony-layout']) {
   try { console.log(file(`tests/sql/${name}.sql`).split('\n').filter(line=>line.includes('PASS')).join('\n')); }
   catch(e) {throw new Error(`${name}: ${e.stderr}`);}
 }
 const exportFile=process.argv.find(x=>x.startsWith('--export-fixture='))?.slice('--export-fixture='.length);
 {
  psql(`select prepare_opening_ceremony_layout(f(1),f(33),-1);
   select save_ceremony(f(1),f(33),'opening',(select revision from ceremony_plans where kind='opening'),'configure','{"location":"Synthetic hall","capacity":3540,"startsAt":"2026-10-25T16:30","endsAt":"2026-10-25T19:00","state":"validated","attendancePart":"afternoon"}');
   select set_ceremony_map(f(1),f(33),(select id from ceremony_plans where kind='opening'),(select revision from ceremony_plans where kind='opening'),f(9990),'publish',jsonb_build_object('versionId',(select id from ceremony_map_versions where state='draft')));`);
  if(exportFile) writeFileSync(exportFile,psql(`select jsonb_build_object('snapshot',get_ceremony(f(1),f(33),'opening'),'map',get_ceremony_map(f(1),f(33),(select id from ceremony_plans where kind='opening')));`,true).trim());
 }
 psql(`delete from event_attendance_choices where registration_id in(f(10),f(11));insert into event_attendance_choices(registration_id,day,day_part,choice) values(f(10),'2026-10-25','afternoon','yes'),(f(11),'2026-10-25','afternoon','yes');
  update ceremony_quotas set quantity=1 where sector_id=(select id from ceremony_sectors where layout_code='A1');`);
 const revision=Number(psql("select revision from ceremony_plans where kind='opening'",true).trim());
 const concurrent=sql=>new Promise((resolve,reject)=>{const child=spawn(join(bin,'psql'),[...args,'-tA'],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('exit',code=>code===0?resolve(out.trim()):reject(Error(err)));child.stdin.end(sql);});
 const race=await Promise.all([31,33].map((actor,i)=>concurrent(`set role service_role;select save_ceremony(f(1),f(${actor}),'opening',${revision},'allocate',jsonb_build_object('id',f(${9970+i}),'quotaId',(select q.id from ceremony_quotas q join ceremony_sectors s on s.id=q.sector_id where s.layout_code='A1'),'registrationId',f(${i===0?10:11}),'childId',${i===0?'f(40)':'null'},'quantity',1))->>'status';`)));
 assert.equal(race.filter(x=>x==='saved').length,1);assert.equal(race.filter(x=>x==='conflict').length,1);
 assert.equal(psql("select count(*) from ceremony_nominees where revoked_at is null",true).trim(),'1');
 console.log('PASS current Manager/Admin race: one final seat, one save, one conflict, one nominal assignment');
 console.log('PASS complete ceremony migrations and SQL regression on disposable PostgreSQL');
} finally {
 if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'pipe'});
 rmSync(dir,{recursive:true,force:true});
}
