// Real leader component, controlled save/read responses; no operational data or emails.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, symlinkSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('.'), dir = mkdtempSync(join(tmpdir(), 'pace-leader-completion-'));
const output = join(root, 'output/ceremony-leader-completion'); mkdirSync(output, { recursive: true });
for (const file of execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)) {
  if (file.startsWith('.env')) continue;
  mkdirSync(dirname(join(dir, file)), { recursive: true }); copyFileSync(file, join(dir, file));
}
symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
const view = {
  allocations: [{ id:'a', planId:'p', kind:'opening', state:'validated', revision:1, groupId:'g', groupName:'Gruppo sintetico', location:'Assisi', startsAt:'2026-10-25T15:15:00Z', sector:'A', category:'delegations', quantity:110, used:0, numbered:false }],
  nominees: [], tickets: [],
  people: Array.from({length:102}, (_,i) => ({registrationId:`r${i}`, name:`Persona ${String(i).padStart(3,'0')}`, code:`TEST${i}`, groupIds:['g'], children:i===0?[{id:'child',name:'Minore sintetico'}]:[], eligiblePlanIds:['p'], assigned:[]})),
};
writeFileSync(join(dir,'app/layout.tsx'), `import './globals.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="it"><body>{children}</body></html>}`);
writeFileSync(join(dir,'proxy.ts'), `import {NextResponse} from 'next/server';export function proxy(){return NextResponse.next()}`);
const fixture = join(dir,'app/leader-completion-check'); mkdirSync(fixture);
writeFileSync(join(fixture,'page.tsx'), `"use client";import {CeremonyLeaderSectors} from '@/app/dashboard/ceremony-leader-sectors';import type {LeaderTickets} from '@/lib/ceremonies/leader-tickets';export default function Page(){return <main className="mx-auto max-w-5xl p-3"><CeremonyLeaderSectors locale="it" initialView={${JSON.stringify(view)} as LeaderTickets} save={async c=>(await fetch('/batch-test/save',{method:'POST',body:JSON.stringify(c)})).json()} saveMany={async c=>(await fetch('/batch-test/save',{method:'POST',body:JSON.stringify(c)})).json()} refresh={async()=>{const r=await fetch('/batch-test/read');if(!r.ok)throw Error('Read failed');return r.json();}}/></main>}`);
const env = { LC_ALL:'C', PATH:process.env.PATH, HOME:process.env.HOME, TMPDIR:process.env.TMPDIR, NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55490', NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon', SUPABASE_SERVICE_ROLE_KEY:'synthetic-service', NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3196', EMAIL_DELIVERY_MODE:'log' };
const log = openSync(join(output,'browser-dev.log'),'w');
const server = spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3196'], {cwd:dir,env,stdio:['ignore',log,log]});
const gate=()=>{let release;const promise=new Promise(r=>{release=r;});return {promise,release};};
let browser, activePage;
try {
  for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:3196/leader-completion-check')).ok)break;}catch{}if(i===59)throw Error('Server unavailable');await new Promise(r=>setTimeout(r,500));}
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  for(const scenario of ['slow-mobile','slow-desktop','read-failure','lost-response','capacity','revision-conflict','revision-conflict-lost','revision-keeps-changing','allocation-changed','conflict-read-failure']) {
    const page=await browser.newPage({viewport:{width:scenario==='slow-desktop'?1440:390,height:900}});page.setDefaultTimeout(20000);
    activePage=page;const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const saveGate=gate(), readGate=gate(), saveStarted=gate(), readStarted=gate();
    let savedView=structuredClone(view), saves=[], reads=0;
    await page.route('**/batch-test/save',async route=>{
      const command=route.request().postDataJSON();saves.push(command);saveStarted.release();await saveGate.promise;
      assert.equal(command.subjects.length,103,'all pages, including explicit child');
      if(scenario==='capacity')return route.fulfill({json:{status:'capacity'}});
      if((scenario.startsWith('revision-conflict')||scenario==='allocation-changed'||scenario==='conflict-read-failure')&&saves.length===1||scenario==='revision-keeps-changing'){
        savedView.allocations[0].revision++;
        if(scenario==='allocation-changed')savedView.allocations[0].quantity=109;
        return route.fulfill({json:{status:'conflict'}});
      }
      if(!savedView.nominees.length){
        savedView.allocations[0].used=command.subjects.length;
        savedView.allocations[0].revision++;
        savedView.nominees=command.subjects.map((s,i)=>({id:`n${i}`,allocationId:'a',...s,needsSeat:true,review:false,name:s.childId?'Minore sintetico':view.people.find(p=>p.registrationId===s.registrationId).name}));
        for(const s of command.subjects)savedView.people.find(p=>p.registrationId===s.registrationId).assigned.push({planId:'p',childId:s.childId,needsSeat:true});
      }
      await route.fulfill({json:{status:(scenario==='lost-response'&&saves.length===1)||(scenario==='revision-conflict-lost'&&saves.length===2)?'unavailable':'saved'}});
    });
    await page.route('**/batch-test/read',async route=>{
      reads++;readStarted.release();await readGate.promise;
      await route.fulfill((scenario==='read-failure'||scenario==='conflict-read-failure')&&reads===1?{status:503,body:'unavailable'}:{json:savedView});
    });
    await page.goto('http://127.0.0.1:3196/leader-completion-check',{waitUntil:'networkidle'});
    await page.getByRole('radio').first().check();
    await page.getByLabel('Seleziona tutte le persone disponibili in questa pagina').check();
    await page.getByRole('button',{name:'Successivi',exact:true}).first().click();
    await page.getByLabel('Seleziona tutte le persone disponibili in questa pagina').check();
    await page.getByRole('button',{name:'Conferma assegnazione al settore',exact:true}).click();
    const modal=page.getByRole('dialog');
    assert.equal(await modal.getByRole('listitem').count(),103);
    await modal.getByRole('button',{name:'Conferma assegnazione al settore',exact:true}).click();await saveStarted.promise;
    // A programmatic second click must not queue another mutation either.
    await modal.locator('button').first().evaluate(el=>el.click());
    async function checkBusy(){
      assert.equal(await modal.getAttribute('aria-busy'),'true');
      assert.equal(await modal.getByRole('button',{name:'Annulla',exact:true}).isDisabled(),true);
      await page.keyboard.press('Escape');assert.ok(await modal.evaluate(el=>el.matches(':modal')));
      await modal.getByRole('status').filter({hasText:'Operazione in corso'}).waitFor();
      assert.ok(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
      assert.equal(saves.length,1);
    }
    await checkBusy();
    await page.screenshot({path:join(output,`${scenario}-saving.png`)});
    saveGate.release();
    if(scenario==='lost-response'){
      await modal.getByRole('button',{name:'Riprova la stessa operazione',exact:true}).click();
    }
    await readStarted.promise;
    if(scenario!=='lost-response')await checkBusy();
    assert.equal(await page.getByText('Modifica salvata.',{exact:true}).count(),0,'no success before refreshed view');
    readGate.release();
    if(scenario==='revision-conflict-lost'){
      await modal.getByRole('button',{name:'Riprova la stessa operazione',exact:true}).click();
    }
    if(scenario==='read-failure'){
      const refresh=modal.getByRole('button',{name:'Aggiorna disponibilità',exact:true});await refresh.waitFor();
      assert.equal(await modal.getByRole('button',{name:'Annulla',exact:true}).isDisabled(),true);
      await page.keyboard.press('Escape');assert.ok(await modal.evaluate(el=>el.matches(':modal')));
      await refresh.click();
    }
    await modal.waitFor({state:'detached'});
    const expected=['capacity','revision-keeps-changing','allocation-changed','conflict-read-failure'].includes(scenario)?0:103;
    assert.match(await page.getByRole('region',{name:'Posti ricevuti',exact:true}).innerText(),new RegExp(`Assegnati: ${expected}`));
    assert.equal(await page.getByRole('button',{name:'Revoca o annulla la scelta',exact:true}).count(),expected?100:0,'history updated when modal closes');
    if(expected){
      await page.getByRole('button',{name:'Successivi',exact:true}).last().click();
      assert.equal(await page.getByRole('button',{name:'Revoca o annulla la scelta',exact:true}).count(),3,'all 103 nominees in history');
      await page.getByText('Modifica salvata.',{exact:true}).waitFor();
    }else{
      await page.getByText(scenario==='capacity'?'Il settore scelto non ha abbastanza posti disponibili.':scenario==='conflict-read-failure'?'Impossibile caricare tutti i dati. Riprova.':'I posti ricevuti sono cambiati. Aggiorna e verifica prima di riprovare.',{exact:true}).waitFor();
      assert.equal(await page.getByRole('region',{name:'Biglietti da assegnare',exact:true}).getByRole('listitem').count(),103);
    }
    assert.equal(reads,scenario==='read-failure'||scenario.startsWith('revision-')?2:1);
    assert.equal(saves.length,scenario==='revision-conflict-lost'?3:scenario==='lost-response'||scenario==='revision-conflict'||scenario==='revision-keeps-changing'?2:1);
    if(scenario==='lost-response')assert.deepEqual(saves[0],saves[1],'retry reuses the exact request');
    if(scenario.startsWith('revision-conflict')){
      assert.equal(saves[1].revision,2);
      assert.notEqual(saves[0].requestId,saves[1].requestId);
      assert.deepEqual(saves[0].subjects,saves[1].subjects,'no selected person dropped');
      if(scenario==='revision-conflict-lost')assert.deepEqual(saves[1],saves[2],'uncertain retry uses the refreshed command');
    }
    assert.deepEqual(errors,[]);
    console.log(`PASS ${scenario}: modal lifecycle, 103 selected subjects, history/counts, safe retry`);
    await page.close();
  }
}catch(error){
  if(activePage&&!activePage.isClosed()){console.error(await activePage.locator('dialog').evaluateAll(els=>els.map(el=>({open:el.open,html:el.outerHTML.slice(-3000)}))));await activePage.screenshot({path:join(output,'failure.png')});}
  throw error;
}finally{
  await browser?.close();server.kill('SIGTERM');await new Promise(r=>server.on('exit',r));rmSync(dir,{recursive:true,force:true});
}
