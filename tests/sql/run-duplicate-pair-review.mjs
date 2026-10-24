// No application credentials or network: temporary PostgreSQL on a Unix socket.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const bin='/opt/homebrew/opt/postgresql@17/bin', dir=mkdtempSync(join(tmpdir(),'pace-duplicate-pair-'));
const args=['-h',dir,'-p','55497','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-qAt'];
let started=false;
const sql=query=>execFileSync(join(bin,'psql'),args,{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const concurrent=query=>new Promise((resolve,reject)=>{
 const child=spawn(join(bin,'psql'),args,{stdio:['pipe','pipe','pipe']});let error='';
 child.stderr.on('data',x=>error+=x);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(error)));child.stdin.end(query);
});
try {
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-U','postgres','-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'postgres.log'),'-o',`-k ${dir} -p 55497 -c listen_addresses=''`,'-w','start'],{stdio:'pipe'});started=true;
 execFileSync(join(bin,'psql'),[...args,'-f','tests/sql/duplicate-pair-review.sql'],{stdio:'pipe'});
 console.log('PASS SQL: legacy import/merge/delete, scoped pair, unrelated writes, changed identity/contact, permissions, replay, atomic audit rollback');
 const pair="fixture_id(100),fixture_id(2),least(fixture_id(211),fixture_id(212)),greatest(fixture_id(211),fixture_id(212))";
 const v=sql(`set role service_role;select quality_duplicate_pair_version(${pair});`).trim();
 const review=`set role service_role; select dismiss_participant_duplicate(${pair},'Concurrent review','${v}',repeat('a',64),repeat('b',64));`;
 await Promise.all([concurrent(review),concurrent(review)]);
 sql("do $$ begin assert (select count(*)=1 from audit_logs where action='duplicate.false_positive' and metadata->>'reason'='Concurrent review'),'concurrent retry duplicated audit'; end $$;");
 console.log('PASS SQL concurrency: simultaneous confirmation produces one review and one audit');
 // Realistic event growth: work for the pair stays constant while the old
 // event-wide digest visits every unrelated registration.
 sql("insert into participants(id,first_name,last_name) select fixture_id(10000+i),'Synthetic','Unrelated' from generate_series(1,15000)i; insert into registrations(id,event_id,participant_id) select fixture_id(30000+i),fixture_id(100),fixture_id(10000+i) from generate_series(1,15000)i; analyze;");
 for(const [name,query] of [['pair',`quality_duplicate_pair_version(${pair})`],['event',"quality_event_version(fixture_id(100),fixture_id(2))"]]) {
  console.log(name+': '+sql(`set role service_role;explain(analyze,format text) select ${query};`).trim().split('\n').filter(x=>x.includes('Execution Time')).join(''));
 }
} catch(error) { console.error(error.stderr?.toString()||error);process.exitCode=1; }
finally {if(started)execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'],{stdio:'pipe'});rmSync(dir,{recursive:true,force:true});}
