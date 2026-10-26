// Real components in an isolated source copy; synthetic API responses only.
import {execFileSync,spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,copyFileSync,symlinkSync,openSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import assert from 'node:assert/strict';
import { CLOSING_BADGE_SECTORS } from '../../lib/ceremonies/closing-badges.ts';
const root=resolve('.'),dir=mkdtempSync(join(tmpdir(),'pace-closing-badges-'));
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
for(const file of files){if(file.startsWith('.env'))continue;mkdirSync(dirname(join(dir,file)),{recursive:true});copyFileSync(file,join(dir,file));}
symlinkSync(join(root,'node_modules'),join(dir,'node_modules'),'dir');
const path=join(dir,'app/closing-badge-check');mkdirSync(path,{recursive:true});
writeFileSync(join(dir,'app/layout.tsx'),`import './globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="it"><body>{children}</body></html>}`);
const sectors=CLOSING_BADGE_SECTORS.map((s,i)=>({id:`s${i}`,name:s.name,layoutCode:s.code,capacity:s.capacity,assignableLimit:s.capacity,remaining:s.capacity,numbered:false}));
const desk={planId:'p',kind:'closing',revision:1,state:'validated',layoutKey:'assisi-closing-badges-2026',day:'2026-10-27',part:'afternoon',location:'Assisi',active:null,sectors,allocations:[],nominees:[],claims:[],drafts:[]};
const seats=CLOSING_BADGE_SECTORS.map((s,i)=>({id:`00000000-0000-4000-8000-00000000000${i+1}`,kind:'closing',name:'Maria Rossi',child:false,needsSeat:true,location:s.name,startsAt:'2026-10-27T15:15:00Z',sector:s.name,category:'Partecipanti',review:false,badgeCode:s.code}));
writeFileSync(join(path,'page.tsx'),`"use client";import {useState} from 'react';import {CeremonySectorMap} from '@/app/dashboard/ceremony-sector-map';import {PersonalCeremonySeats} from '@/app/dashboard/partecipante/cerimonie/seats';import type {SeatsDesk} from '@/lib/ceremonies/seats-desk';import type {PersonalSeat} from '@/lib/ceremonies/distribution';export default function Page(){const [selected,setSelected]=useState(''),[disabled,setDisabled]=useState(false);return <main className="mx-auto grid max-w-5xl gap-6 p-3"><h1>Cerimonia finale</h1><CeremonySectorMap desk={${JSON.stringify(desk)} as SeatsDesk} onSelect={setSelected} disabled={disabled}/><output>{selected}</output><button onClick={()=>setDisabled(!disabled)}>Blocca</button><PersonalCeremonySeats seats={${JSON.stringify(seats)} as PersonalSeat[]} locale="it"/></main>}`);
// A local synthetic endpoint also serves browser download requests, which may bypass page.route.
writeFileSync(join(dir,'proxy.ts'),`import {NextResponse} from 'next/server';export function proxy(){return NextResponse.next()}`);
writeFileSync(join(dir,'app/dashboard/ceremonies/badge/route.ts'),`import {readFile} from 'node:fs/promises';export async function GET(request:Request){const q=new URL(request.url).searchParams;const i=Number(q.get('nominee')?.slice(-1))-1;const codes=['CLOSING_ORANGE','CLOSING_PURPLE','CLOSING_GREEN'];if(!codes[i])return new Response(null,{status:404});const jpg=q.get('format')==='jpg';const data=await readFile(${JSON.stringify(join(root,'output/closing-badges/'))}+codes[i]+(jpg?'.jpg':'.pdf'));return new Response(data,{headers:{'Content-Type':jpg?'image/jpeg':'application/pdf','Content-Disposition':(jpg?'inline':'attachment')+'; filename="badge.pdf"','Cache-Control':'private, no-store'}})}`);
const env={LC_ALL:'C',PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55490',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3196',EMAIL_DELIVERY_MODE:'log'};
const log=openSync(join(root,'output/closing-badges/browser-dev.log'),'w');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3196'],{cwd:dir,env,stdio:['ignore',log,log]});
let browser;
try{
 for(let i=0;i<40;i++){try{const r=await fetch('http://127.0.0.1:3196/closing-badge-check');if(r.ok)break;}catch{}if(i===39)throw Error('Synthetic server unavailable');await new Promise(r=>setTimeout(r,500));}
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/dashboard/ceremonies/badge?**',route=>{
  const url=new URL(route.request().url());const index=Number(url.searchParams.get('nominee').slice(-1))-1;
  const jpg=url.searchParams.get('format')==='jpg';const body=readFileSync(join(root,`output/closing-badges/${CLOSING_BADGE_SECTORS[index].code}.${jpg?'jpg':'pdf'}`));
  return route.fulfill({status:200,headers:{'Content-Type':jpg?'image/jpeg':'application/pdf','Content-Disposition':`${jpg?'inline':'attachment'}; filename="badge.pdf"`,'Cache-Control':'private, no-store'},body});
 });
 await page.goto('http://127.0.0.1:3196/closing-badge-check',{waitUntil:'networkidle'});
 for(const width of [320,390,1024,1440]){
  await page.setViewportSize({width,height:1100});
  for(const [index,sector] of CLOSING_BADGE_SECTORS.entries()){
   assert.equal(await page.locator(`svg[data-sector="${sector.code}"] rect`).count(),sector.capacity);
   await page.getByRole('button',{name:`${sector.name} · Badge ${sector.color} · ${sector.capacity} posti assegnabili`,exact:true}).click();
   assert.equal(await page.locator('output').innerText(),`s${index}`);
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  await page.screenshot({path:join(root,`output/closing-badges/map-${width}.png`),fullPage:true});
  console.log(`PASS browser ${width}px: three sectors, 3500 symbols, exact quantities, selection and no overflow`);
 }
 await page.getByRole('button',{name:'Blocca',exact:true}).click();
 assert.equal(await page.locator('button:disabled').count(),3);
 assert.equal(await page.getByRole('img',{name:/Maria Rossi/}).count(),3);
 for(const link of await page.getByRole('link',{name:'Scarica badge PDF',exact:true}).all()){
  const download=page.waitForEvent('download');await link.click();const file=await download;
  assert.equal(file.suggestedFilename(),'badge.pdf');assert.equal(await file.failure(),null);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS browser: three personalized images and downloadable PDFs; disabled operations respected; no JavaScript errors');
}finally{
 await browser?.close();server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));rmSync(dir,{recursive:true,force:true});
}
