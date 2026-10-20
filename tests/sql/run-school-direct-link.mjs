// Disposable local PostgreSQL only: no application env or remote database access.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const bin='/opt/homebrew/opt/postgresql@17/bin';
const dir=mkdtempSync(join(tmpdir(),'pace-school-direct-'));
const args=['-h',dir,'-p','55491','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q'];
const psql=(sql,unaligned=false)=>execFileSync(join(bin,'psql'),unaligned?[...args,'-tA']:args,{input:sql,encoding:'utf8',maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']});
const file=path=>execFileSync(join(bin,'psql'),[...args,...(path.startsWith('supabase/migrations/')?['-1']:[]),'-f',path],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
let started=false;
try {
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-U','postgres','-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'postgres.log'),'-o',`-k ${dir} -p 55491 -c listen_addresses=''`,'-w','start'],{stdio:'pipe'});started=true;
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
  if(['20260813170000_rename_anziani_and_amici_groups.sql','20261017180000_school_class_slot_constraints.sql'].includes(name))continue;
  try {file(join('supabase/migrations',name));}catch(e){throw new Error(`Migration ${name}: ${e.stderr}`);}
 }
 console.log('PASS canonical migrations applied to disposable PostgreSQL');
 try {console.log(file('tests/sql/school-direct-link.sql').split('\n').filter(x=>x.startsWith('PASS ')).join('\n'));} catch(e){throw new Error(e.stderr);}
 const reserve=email=>new Promise((resolve,reject)=>{
  const child=spawn(join(bin,'psql'),[...args,'-tA']);let out='',err='';child.stdout.on('data',x=>out+=x);child.stderr.on('data',x=>err+=x);child.on('error',reject);child.on('close',code=>resolve({code,out,err}));
  child.stdin.end(`set role service_role;select sd_create('${email}',14,1,2);`);
 });
 const concurrent=await Promise.all([reserve('race-a@example.invalid'),reserve('race-b@example.invalid')]);
 assert.equal(concurrent.filter(x=>x.code===0).length,1);assert.match(concurrent.find(x=>x.code!==0).err,/capacity exceeded/);
 assert.equal(psql('select app.panel_section_occupancy(sd(502));',true).trim(),'15');
 psql("update school_panel_reservations set status='cancelled' where panel_id=sd(402);update school_bookings set status='cancelled',cancelled_at=now() where school_name='Scuola sintetica' and status='submitted';");
 console.log('PASS simultaneous school requests cannot overbook the last available seats');
 const {checkSchoolClassMigration}=await import('./school-class-migration.mjs');
 checkSchoolClassMigration(psql);
 try {console.log(file('tests/sql/school-class-slots.sql').split('\n').filter(x=>x.startsWith('PASS ')).join('\n'));} catch(e){throw new Error(e.stderr);}
 const {checkSchoolClassConcurrency}=await import('./school-class-slots-concurrency.mjs');
 await checkSchoolClassConcurrency({psql,bin,args});
 if(process.argv.includes('--browser')) {const {checkSchoolDirectLink}=await import('../browser/school-direct-link.mjs');await checkSchoolDirectLink(psql);}
} finally {
 if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'pipe'});
 rmSync(dir,{recursive:true,force:true});
}
