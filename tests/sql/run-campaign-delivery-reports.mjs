import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const bin='/opt/homebrew/opt/postgresql@17/bin';const dir=mkdtempSync(join(tmpdir(),'pace-mail-report-'));const port='55489';
const args=['-h',dir,'-p',port,'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
try{
 execFileSync(join(bin,'initdb'),['-D',join(dir,'data'),'-U','postgres','-A','trust','--no-locale','-E','UTF8'],{stdio:'pipe'});
 execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'log'),'-o',`-k ${dir} -p ${port} -c listen_addresses=''`,'-w','start'],{stdio:'pipe'});
 execFileSync(join(bin,'psql'),[...args,'-f','tests/sql/campaign-delivery-reports.sql'],{stdio:'pipe'});
 const sql="select retry_email_campaign_recipients(md5('campaign')::uuid,array[md5('race')::uuid],md5('manager')::uuid);";
 const results=await Promise.all([1,2].map(()=>promisify(execFile)(join(bin,'psql'),[...args,'-At','-c',sql])));
 if(results[0].stdout!==results[1].stdout)throw Error('concurrent retries differed');
 console.log('PASS: SQL permissions, event dedup, out-of-order suppression, early event, eligibility, atomic selection, idempotent concurrent retries');
}catch(e){console.error(e.stderr?.toString()||e);process.exitCode=1;}finally{try{execFileSync(join(bin,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','stop'],{stdio:'pipe'});}catch{}rmSync(dir,{recursive:true,force:true});}
