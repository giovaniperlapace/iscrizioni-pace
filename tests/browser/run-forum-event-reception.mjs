// Copies original sources to a credential-free temporary Next project. No live APIs.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, existsSync, cpSync, copyFileSync, symlinkSync, openSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
const root=resolve('.'), dir=mkdtempSync(join(tmpdir(),'pace-forum-browser-'));
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
for(const file of files){if(file.startsWith('.env')||!existsSync(file))continue;mkdirSync(dirname(join(dir,file)),{recursive:true});copyFileSync(file,join(dir,file));}
symlinkSync(join(root,'node_modules'),join(dir,'node_modules'),'dir');
mkdirSync(join(dir,'app/test-forum-roles'),{recursive:true});
copyFileSync('tests/browser/forum-role-page.fixture',join(dir,'app/test-forum-roles/page.tsx'));
mkdirSync(join(dir,'app/test-duty-windows'),{recursive:true});
copyFileSync('tests/browser/reception-duty-windows.fixture',join(dir,'app/test-duty-windows/page.tsx'));
mkdirSync(join(dir,'app/test-school-qr'),{recursive:true});
copyFileSync('tests/browser/school-qr-page.fixture',join(dir,'app/test-school-qr/page.tsx'));
mkdirSync(join(dir,'app/test-forum-demo'),{recursive:true});
copyFileSync('tests/browser/forum-reception-demo-page.fixture',join(dir,'app/test-forum-demo/page.tsx'));
cpSync('tests/fixtures/collaudo-forum-eventi',join(dir,'public/collaudo-forum-eventi'),{recursive:true});
mkdirSync(join(dir,'app/test-camera-recovery'),{recursive:true});
copyFileSync('tests/browser/camera-recovery-fixture.tsx',join(dir,'app/test-camera-recovery/page.tsx'));
const env={SCHOOL_QR_ONLY:process.env.SCHOOL_QR_ONLY,QR_TOKEN_ENCRYPTION_SECRET:'synthetic-school-browser',LC_ALL:'C',PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,
 NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55490',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon',
 SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3198',EMAIL_DELIVERY_MODE:'log'};
const log=openSync('/tmp/pace-forum-events-dev.log','w');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3198'],{cwd:dir,env,stdio:['ignore',log,log]});
try {
 for(let attempt=0;attempt<60;attempt++){
  try {await fetch('http://127.0.0.1:3198/login');break;}catch {if(attempt===59)throw new Error('Synthetic Next server unavailable');await new Promise(resolve=>setTimeout(resolve,1000));}
 }
 if(process.env.CAMERA_RECOVERY_ONLY) {
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  try {const {checkCameraRecovery}=await import('./camera-recovery.mjs');await checkCameraRecovery(browser,'http://127.0.0.1:3198');} finally {await browser.close();}
  const legacy=spawn(process.execPath,['tests/browser/reception-playwright.mjs','http://127.0.0.1:3198'],{cwd:dir,env:{...env,PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE,PLAYWRIGHT_CHANNEL:'chrome'},stdio:'inherit'});
  process.exitCode=await new Promise(resolve=>legacy.on('exit',code=>resolve(code??1)));
 } else {
 const test=spawn(process.execPath,['tests/sql/run-forum-events.mjs','--browser'],{cwd:root,env:{...env,PLAYWRIGHT_MODULE:process.env.PLAYWRIGHT_MODULE},stdio:'inherit'});
 process.exitCode=await new Promise(resolve=>test.on('exit',code=>resolve(code??1)));
 }
} finally {
 server.kill('SIGTERM');await new Promise(resolve=>server.on('exit',resolve));
 rmSync(dir,{recursive:true,force:true});
}
