// Isolated real UI -> real download route -> synthetic canonical snapshot -> real PDF.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, symlinkSync, openSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { CLOSING_BADGE_SECTORS } from '../../lib/ceremonies/closing-badges.ts';
const root = resolve('.'), dir = mkdtempSync(join(tmpdir(), 'pace-closing-download-'));
const output = join(root, 'output/closing-leader-download'); mkdirSync(output, { recursive: true });
for (const file of execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)) {
  if (file.startsWith('.env')) continue;
  mkdirSync(dirname(join(dir, file)), { recursive: true }); copyFileSync(file, join(dir, file));
}
symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
const count = 103;
const view = {
  allocations: CLOSING_BADGE_SECTORS.map((s,i) => ({ id: `a${i}`, planId: 'p', kind: 'closing', badgeCode: s.code, state: 'validated', revision: 1, groupId: `g${i}`, groupName: `Gruppo sintetico ${i+1}`, location: 'Assisi', startsAt: '2026-10-27T15:15:00Z', sector: s.name, category: 'delegations', quantity: 200, used: 35, numbered: false })),
  nominees: Array.from({length:count}, (_,i) => ({id:`n${i}`,allocationId:`a${i%3}`,registrationId:`r${i}`,childId:null,needsSeat:true,name:`Persona ${i}`,review:false})),
  people: Array.from({length:count}, (_,i) => ({registrationId:`r${i}`,name:`Persona sintetica ${i}`,code:'TEST',groupIds:[`g${i%3}`],children:[],eligiblePlanIds:['p'],assigned:[{planId:'p',childId:null,needsSeat:true}]})), tickets: [],
};
writeFileSync(join(dir,'app/layout.tsx'), `import './globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="it"><body>{children}</body></html>}`);
writeFileSync(join(dir,'proxy.ts'), `import {NextResponse} from 'next/server';export function proxy(){return NextResponse.next()}`);
writeFileSync(join(dir,'lib/supabase/server.ts'), `export async function createSupabaseServerClient(){return {auth:{getUser:async()=>({data:{user:{id:'synthetic'}}})}}}`);
writeFileSync(join(dir,'lib/supabase/service.ts'), `export function createSupabaseServiceClient(){return {}}`);
writeFileSync(join(dir,'lib/ceremonies/leader-tickets.server.ts'), `export async function loadLeaderTickets(){return ${JSON.stringify(view)}}`);
const fixture = join(dir,'app/closing-download-check'); mkdirSync(fixture);
writeFileSync(join(fixture,'page.tsx'), `"use client";import {useState} from 'react';import {CeremonyLeaderSectors} from '@/app/dashboard/ceremony-leader-sectors';import type {LeaderTickets} from '@/lib/ceremonies/leader-tickets';export default function Page(){const [kind,setKind]=useState<'closing'|'opening'>('closing');const [empty,setEmpty]=useState(false);const view=${JSON.stringify(view)} as LeaderTickets; if(empty)view.nominees=[];return <main className="mx-auto grid max-w-5xl gap-5 p-3"><button onClick={()=>setKind(kind==='closing'?'opening':'closing')}>Cambia cerimonia test</button><button onClick={()=>setEmpty(!empty)}>Svuota test</button><CeremonyLeaderSectors key={kind+empty} kind={kind} locale="it" initialView={view} save={async()=>({status:'saved'})} saveMany={async()=>({status:'saved'})} refresh={async()=>view}/></main>}`);
const env = { LC_ALL:'C',PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55490',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3197',EMAIL_DELIVERY_MODE:'log' };
const log = openSync(join(output,'browser-dev.log'),'w');
const server = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3197'], {cwd:dir,env,stdio:['ignore',log,log]});
let browser;
try {
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:3197/closing-download-check')).ok)break;}catch{}if(i===59)throw Error('Server unavailable');await new Promise(r=>setTimeout(r,500));}
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3197/closing-download-check',{waitUntil:'networkidle'});
  const button=page.getByRole('button',{name:'Scarica tutti i biglietti in un unico PDF',exact:true});
  for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:1000});assert.equal(await button.isEnabled(),true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:join(output,`browser-${width}.png`),fullPage:true});
  }
  // Choose just one sector and search: the aggregate download must still contain all 103.
  await page.getByRole('radio').first().check();
  await page.locator('input[type="search"]').fill('Persona 0');
  const download=page.waitForEvent('download');await button.click();
  await page.getByRole('button',{name:'Preparazione del PDF…',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Preparazione del PDF…',exact:true}).isDisabled(),true);
  const file=await download;assert.equal(await file.failure(),null);
  assert.equal(file.suggestedFilename(),'cerimonia-finale-tutti-i-biglietti.pdf');
  await file.saveAs(join(output,'combined-103.pdf'));
  const pdf=readFileSync(join(output,'combined-103.pdf'));
  assert.equal(pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length,103);
  assert.match(pdf.subarray(-50).toString(),/%%EOF/);
  await page.route('**/dashboard/ceremonies/badges',r=>r.fulfill({status:503,body:''}));
  await button.click();await page.getByRole('status').filter({hasText:'Impossibile'}).waitFor();
  assert.equal(await button.isEnabled(),true);
  await page.unroute('**/dashboard/ceremonies/badges');
  await page.route('**/dashboard/ceremonies/badges',r=>r.fulfill({status:404,body:''}));
  await button.click();await page.getByRole('status').filter({hasText:'Non ci sono biglietti'}).waitFor();
  await page.getByRole('button',{name:'Cambia cerimonia test'}).click();assert.equal(await button.count(),0);
  await page.getByRole('button',{name:'Cambia cerimonia test'}).click();
  await page.getByRole('button',{name:'Svuota test'}).click();assert.equal(await button.isDisabled(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS: 320/390/1440px; real 103-page PDF across all sectors despite selected sector/search; busy, errors, empty, opening unchanged; no JS errors');
}finally{
  await browser?.close();server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));rmSync(dir,{recursive:true,force:true});
}
