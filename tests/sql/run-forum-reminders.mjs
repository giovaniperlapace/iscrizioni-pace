// Isolated local PostgreSQL; no .env, remote database or email provider.
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const bin = '/opt/homebrew/opt/postgresql@17/bin';
const dir = mkdtempSync(join(tmpdir(), 'pace-forum-reminders-'));
const args = ['-h', dir, '-p', '55517', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-tA'];
const sql = input => execFileSync(join(bin, 'psql'), args, { input, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
let started = false;
try {
  execFileSync(join(bin, 'initdb'), ['-D', join(dir,'data'), '-U','postgres','-A','trust','--no-locale','-E','UTF8'], {stdio:'pipe'});
  execFileSync(join(bin, 'pg_ctl'), ['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p 55517 -c listen_addresses=''`,'-w','start'], {stdio:'pipe'});
  started = true;
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
    alter default privileges in schema public grant all on tables to service_role;
    alter default privileges in schema public grant all on sequences to service_role;`);
  for (const file of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort()) {
    if (file === '20260813170000_rename_anziani_and_amici_groups.sql') continue;
    try { execFileSync(join(bin,'psql'), [...args,'-1','-f',join('supabase/migrations',file)], {stdio:'pipe'}); }
    catch(e) { throw new Error(`Migration ${file}: ${e.stderr}`); }
  }
  console.log('PASS all canonical migrations on isolated PostgreSQL');
  const result = execFileSync(join(bin,'psql'), [...args,'-f','tests/sql/forum-reminders.sql'], {encoding:'utf8',stdio:['ignore','pipe','pipe']});
  console.log(result);
  const claims = await Promise.all(Array.from({length:12},()=>promisify(execFile)(join(bin,'psql'), [...args,'-c',"set role service_role; select claim_forum_reminder()->>'id';"])));
  const ids = claims.map(r=>r.stdout.trim()).filter(Boolean);
  assert.equal(ids.length,1); assert.equal(new Set(ids).size,1);
  console.log('PASS twelve concurrent workers claim one message exactly once');
  sql("update forum_reminder_emails set state='accepted',recipient='synthetic@example.invalid',message_id='provider-test',accepted_at=now()-interval '6 minutes',updated_at=now()-interval '6 minutes';");
  for (const rpc of ['claim_forum_reminder_delivery_check','claim_forum_reminder_report']) {
    if(rpc==='claim_forum_reminder_report')sql("update forum_reminder_emails set delivery_checked_at=now(),delivery_state='pending';");
    const results=await Promise.all(Array.from({length:12},()=>promisify(execFile)(join(bin,'psql'),[...args,'-c',`set role service_role;select ${rpc}()->>'id';`])));
    assert.equal(results.map(r=>r.stdout.trim()).filter(Boolean).length,1);
  }
  console.log('PASS twelve concurrent delivery checks and operational report claims each run once');
} catch(e) { console.error(e.stderr?.toString() || e); process.exitCode=1; }
finally {
  if(started) execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'pipe'});
  rmSync(dir,{recursive:true,force:true});
}
