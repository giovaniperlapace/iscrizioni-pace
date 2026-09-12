// A disposable PostgreSQL cluster; never reads application env or remote DB URLs.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const bin=process.env.P11_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin';
const dir=mkdtempSync(join(tmpdir(),'pace-p11-'));
const args=['-h',dir,'-p','55479','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-q'];
const psql=(sql)=>execFileSync(join(bin,'psql'),args,{input:sql,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const file=(path)=>execFileSync(join(bin,'psql'),[...args,'-f',path],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
let started=false;
try {
  execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-U','postgres','-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
  execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'postgres.log'),'-o',`-k ${dir} -p 55479 -c listen_addresses=''`,'-w','start'],{stdio:'pipe'});
  started=true;
  psql(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to service_role;
    alter default privileges in schema public grant all on sequences to service_role;`);
  for (const name of readdirSync(join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')).sort()) {
    if (name==='20260813170000_rename_anziani_and_amici_groups.sql') continue; // known absent fixture-only data prerequisites
    if(name==='20260912150000_reception_check_ins.sql') {
      psql(`insert into events(slug,title,city,country,status) values('p11-legacy','Synthetic legacy','Test','IT','draft');
        insert into participants(first_name,last_name,public_code) values('Legacy','Test','LGCY');
        insert into registrations(event_id,participant_id) select e.id,p.id from events e,participants p where e.slug='p11-legacy' and p.public_code='LGCY';
        insert into check_ins(registration_id,event_id,checked_in_at,source,notes)
          select id,event_id,'2026-09-01 10:00:00Z','manual','Synthetic legacy note' from registrations where event_id=(select id from events where slug='p11-legacy');
        create table public.p11_legacy_before as select to_jsonb(c) as payload from check_ins c;`);
    }
    try {file(join(root,'supabase/migrations',name));} catch(error) {throw new Error(`Migration ${name}: ${error.stderr}`);}
  }
  psql(`do $$ begin
    assert (select count(*)=1 from check_ins);
    assert (select payload=to_jsonb(c)-array['child_id','school_booking_id','student_count','companion_count','cancelled_at','updated_at','updated_by']
      from check_ins c,p11_legacy_before b where c.id=(b.payload->>'id')::uuid), 'legacy row changed';
    assert (select child_id is null and school_booking_id is null from check_ins);
    end $$; drop table public.p11_legacy_before;`);
  console.log('PASS canonical migrations applied to disposable PostgreSQL; legacy check-in preserved');
  console.log(file(join(root,'tests/sql/reception-check-ins.sql')).trim());
  // Separate connections compete for the same family, then same school booking.
  const concurrent=(sql)=>new Promise((resolve,reject)=>{
    const child=spawn(join(bin,'psql'),args,{stdio:['pipe','pipe','pipe']}); let out='',err='';
    child.stdout.on('data',x=>out+=x); child.stderr.on('data',x=>err+=x);
    child.on('error',reject); child.on('exit',code=>code===0?resolve(out):reject(new Error(err))); child.stdin.end(sql);
  });
  for (const school of [false,true]) {
    const jobs=Array.from({length:8},(_,i)=>concurrent(`set role service_role;
      select public.reception_check_in(f(1),f(30),'${school?'qr':'code'}','${school?'b'.repeat(64):'TST1'}','enter',f(${(school?800:700)+i}),${school?"'{}',8,1":"array[f(10)]"});`));
    await Promise.all(jobs);
    const count=psql(`select count(*) from check_ins where ${school?'school_booking_id=f(50)':'registration_id=f(10) and child_id is null'} and moment_id is null and cancelled_at is null;`);
    assert.match(count,/\b1\b/);
  }
  console.log('PASS 8 concurrent family entries and 8 concurrent school entries');
  const retryResults=await Promise.all(Array.from({length:8},()=>concurrent(`set role service_role;
    select reception_check_in(f(1),f(30),'code','TST1','enter',f(900),array[f(41)])->>'outcome';`)));
  assert.equal(retryResults.filter(x=>/saved/.test(x)).length,1);
  assert.equal(retryResults.filter(x=>/replayed/.test(x)).length,7);
  const rev=Number(execFileSync(join(bin,'psql'),[...args,'-tA','-c','select check_in_revision from registrations where id=f(10)'],{encoding:'utf8'}).trim());
  const corrections=await Promise.all([0,1].map(i=>concurrent(`set role service_role;
    select reception_check_in(f(1),f(30),'code','TST1','correct',f(${910+i}),array[f(${i===0?40:10})],null,null,${rev},'selection_error')->>'status';`)));
  assert.equal(corrections.filter(x=>/valid/.test(x)).length,1);
  assert.equal(corrections.filter(x=>/conflict/.test(x)).length,1);
  console.log('PASS concurrent identical retries (1 saved/7 replayed), concurrent corrections (1 saved/1 conflict)');
} catch(error) {
  console.error(error.stderr?.toString() ?? error.message); process.exitCode=1;
} finally {
  if(started) execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','fast','-w','stop'],{stdio:'pipe'});
  rmSync(dir,{recursive:true,force:true});
}
