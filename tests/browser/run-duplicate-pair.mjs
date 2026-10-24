import {execFileSync,spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,copyFileSync,symlinkSync,openSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
const root=resolve('.'),dir=mkdtempSync(join(tmpdir(),'pace-duplicate-browser-'));
for(const file of execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean)){if(file.startsWith('.env'))continue;mkdirSync(dirname(join(dir,file)),{recursive:true});copyFileSync(file,join(dir,file));}
symlinkSync(join(root,'node_modules'),join(dir,'node_modules'),'dir');
mkdirSync(join(dir,'app/duplicate-pair-check'),{recursive:true});copyFileSync(join(root,'tests/browser/duplicate-pair.fixture'),join(dir,'app/duplicate-pair-check/page.tsx'));
const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55490',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3198',EMAIL_DELIVERY_MODE:'log'};
const log=openSync('/tmp/pace-duplicate-pair-dev.log','w');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3198'],{cwd:dir,env,stdio:['ignore',log,log]});
try{
 for(let i=0;i<60;i++){try{await fetch('http://127.0.0.1:3198/duplicate-pair-check');break;}catch{if(i===59)throw Error('Synthetic server unavailable');await new Promise(r=>setTimeout(r,500));}}
 const test=spawn(process.execPath,['tests/browser/duplicate-pair.mjs','http://127.0.0.1:3198'],{cwd:root,env:{...env,PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE},stdio:'inherit'});
 process.exitCode=await new Promise(resolve=>test.on('exit',code=>resolve(code??1)));
}finally{server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));rmSync(dir,{recursive:true,force:true});}
