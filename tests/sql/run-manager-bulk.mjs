// Disposable local database only; never reads credentials or application env files.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const bin='/opt/homebrew/opt/postgresql@17/bin';
const dir=mkdtempSync(join(tmpdir(),'pace-bulk-'));
try {
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-U','postgres','-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'postgres.log'),'-o',`-k ${dir} -p 55483 -c listen_addresses=''`,'-w','start'],{stdio:'pipe'});
 execFileSync(join(bin,'psql'),['-h',dir,'-p','55483','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-f','tests/sql/manager-bulk-operations.sql'],{stdio:'pipe'});
 console.log('PASS PostgreSQL: existing operations and new bulk/tag-delete permissions, atomic rollback, audit, FK cascade');
 const args=['-h',dir,'-p','55483','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-qAt'];
 const sql=query=>execFileSync(join(bin,'psql'),args,{input:query,encoding:'utf8'});
 const concurrent=query=>new Promise((resolve,reject)=>{
   const child=spawn(join(bin,'psql'),args,{stdio:['pipe','pipe','pipe']}); let error='';
   child.stderr.on('data',x=>error+=x); child.on('error',reject); child.on('exit',code=>code===0?resolve():reject(new Error(error))); child.stdin.end(query);
 });
 sql("insert into operational_tags(id,event_id,label,color) values(fixture_id(53),fixture_id(100),'Concurrent','#123456');");
 await Promise.all([50,53].map(tag=>concurrent(`set role service_role; select bulk_update_registration_operation(fixture_id(100),array[fixture_id(21),fixture_id(20)],fixture_id(2),'tags',fixture_id(${tag}));`)));
 sql(`do $$ begin assert (select count(*)=4 from participant_operational_tags where tag_id in (fixture_id(50),fixture_id(53))), 'concurrent additive tag lost'; end $$;`);
 // Deletion can win before assignment (which must then fail) or after assignment.
 const outcomes=await Promise.allSettled([
   concurrent("set role service_role; select bulk_update_registration_operation(fixture_id(100),array[fixture_id(20),fixture_id(21)],fixture_id(2),'tags',fixture_id(53));"),
   concurrent("set role service_role; select delete_operational_tag(fixture_id(100),fixture_id(53),fixture_id(2));")
 ]);
 if(outcomes[1].status!=='fulfilled') throw outcomes[1].reason;
 if(outcomes[0].status==='rejected' && !/Invalid tag/.test(String(outcomes[0].reason))) throw outcomes[0].reason;
 sql(`do $$ begin assert not exists(select 1 from participant_operational_tags where tag_id=fixture_id(53)); assert (select count(*)=2 from participant_operational_tags where tag_id=fixture_id(50)), 'unrelated tag changed'; end $$;`);
 console.log('PASS concurrency: additive tags retained, deletion racing assignment leaves no dangling tags');

} catch (error) { console.error(error.stderr?.toString() ?? error); process.exitCode=1; }
finally { try { execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'pipe'}); } catch {} rmSync(dir,{recursive:true,force:true}); }
