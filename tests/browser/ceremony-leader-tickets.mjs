// Original leader UI and canonical RPCs against disposable PostgreSQL only.
import {mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2],root=process.argv[3],socket=process.env.CEREMONY_TEST_SOCKET;
assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);assert.match(socket,/^\/.*\/pace-opening-/);
const route=`${root}/app/ceremony-leader-check`;assert.ok(!existsSync(route));mkdirSync(route);
const args=['-h',socket,'-p','55484','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tAq'];
writeFileSync(`${route}/actions.ts`, `'use server';
import {execFileSync} from 'node:child_process';import {parsePairTicketCommand,type PairTicketCommand} from '@/lib/ceremonies/leader-tickets';
function query(sql:string){return JSON.parse(execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',${JSON.stringify(args)},{input:sql,encoding:'utf8',maxBuffer:8*1024*1024}).trim());}
export async function read(){return query("set role service_role;select get_ceremony_leader_tickets(f(1),f(36));");}
export async function command(input:PairTicketCommand){const c=parsePairTicketCommand(input);if(!c)throw Error('invalid');const q=(x:unknown)=>x===null?'null':"'"+String(x).replaceAll("'","''")+"'";return query('set role service_role;select pair_ceremony_group_ticket(f(1),f(36),'+[c.allocationId,c.revision,c.requestId,c.action,c.seatId,c.registrationId,c.childId,c.nomineeId].map(q).join(',')+');');}`);
writeFileSync(`${route}/fixture.tsx`, `'use client';import {useRef,useState} from 'react';import {CeremonyLeaderTickets} from '@/app/dashboard/ceremony-leader-tickets';import type {LeaderTickets} from '@/lib/ceremonies/leader-tickets';import {command,read} from './actions';export default function Fixture({view}:{view:LeaderTickets}){const fail=useRef(false);const [reads,setReads]=useState(0);return <main className="app-page mx-auto max-w-6xl p-4"><button onClick={()=>{fail.current=true;}}>Simula risposta persa</button><span data-testid="reads">{reads}</span><CeremonyLeaderTickets initialView={view} locale="it" save={async c=>{const result=await command(c);if(fail.current){fail.current=false;throw Error('synthetic lost response');}return result;}} refresh={async()=>{setReads(x=>x+1);return read();}}/></main>;}`);
writeFileSync(`${route}/page.tsx`, `import Fixture from './fixture';import {read} from './actions';export const dynamic='force-dynamic';export default async function Page(){return <Fixture view={await read()}/>;}`);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);let browser;
try {
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/ceremony-leader-check`,{waitUntil:'networkidle'});
 assert.equal(await page.getByText('PALCO',{exact:true}).count(),0);assert.equal(await page.getByRole('link',{name:/Mappa/}).count(),0);
 const allocation=page.getByLabel('Dotazione',{exact:true});
 await allocation.selectOption({label:'Inaugurazione · Leader group · B'});
 const tickets=page.getByRole('region',{name:'Biglietti del gruppo'}),people=page.getByLabel('Scegli la persona',{exact:true}),decisions=page.getByRole('region',{name:'Assegnazioni e scelte registrate'});
 assert.equal(await tickets.getByRole('article').count(),3);assert.equal(await people.getByRole('article').count(),100);
 assert.equal(await page.getByRole('article',{name:'Other Test',exact:true}).count(),0);
 const first=tickets.getByRole('article',{name:'Settore B · Blocco 1 · Fila 1 · Sedia 1',exact:true});
 async function choose(){await first.getByRole('button',{name:'Abbina',exact:true}).click();}
 async function pair(name){await people.getByLabel('Cerca nome o codice',{exact:true}).fill(name);await people.getByRole('article',{name,exact:true}).getByRole('button',{name:'Abbina',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Conferma abbinamento',exact:true}).click();}
 async function remove(name){await decisions.getByRole('article',{name,exact:true}).getByRole('button',{name:'Annulla abbinamento',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Conferma revoca',exact:true}).click();await page.getByRole('status').filter({hasText:'Modifica salvata.'}).waitFor();}
 await choose();await pair('Synthetic Member 105');await page.getByRole('status').filter({hasText:'Modifica salvata.'}).waitFor();
 assert.match(await first.innerText(),/Abbinato a Synthetic Member 105/);
 await decisions.getByRole('article',{name:'Synthetic Member 105',exact:true}).getByRole('button',{name:'Annulla abbinamento',exact:true}).click();
 await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.match(await first.innerText(),/Abbinato a/);
 await remove('Synthetic Member 105');await first.getByRole('button',{name:'Abbina',exact:true}).waitFor();
 // Lost response after COMMIT: no second assignment, stable request retry.
 await page.getByRole('button',{name:'Simula risposta persa'}).click();await choose();await pair('Adult Test');
 await page.getByRole('button',{name:'Riprova la stessa operazione'}).click();await page.getByRole('status').filter({hasText:'Modifica salvata.'}).waitFor();
 assert.equal(await decisions.getByRole('article',{name:'Adult Test',exact:true}).count(),1);await remove('Adult Test');
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:width===390?844:1100});await page.emulateMedia({reducedMotion:'reduce'});
  await choose();await pair('Child one Test');await page.getByRole('status').filter({hasText:'Modifica salvata.'}).waitFor();
  assert.match(await first.innerText(),/Abbinato a Child one Test/);
  await tickets.scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/pace-leader-${width}.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await remove('Child one Test');
 }
 await allocation.selectOption({label:'Inaugurazione · Leader group · F'});
 await tickets.getByRole('button',{name:'Abbina',exact:true}).click();await pair('Child one Test');await page.getByRole('status').filter({hasText:'Modifica salvata.'}).waitFor();
 assert.equal(await tickets.getByRole('button',{name:'Abbina',exact:true}).isDisabled(),true);
 await people.getByLabel('Cerca nome o codice',{exact:true}).fill('Child two Test');
 await people.getByRole('article',{name:'Child two Test',exact:true}).getByRole('button',{name:'Non serve un posto',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Conferma abbinamento',exact:true}).click();await page.getByRole('status').filter({hasText:'Modifica salvata.'}).waitFor();
 assert.match(await decisions.getByRole('article',{name:'Child two Test',exact:true}).innerText(),/Nessun posto richiesto/);
 await remove('Child two Test');await remove('Child one Test');
 const before=await page.getByTestId('reads').innerText();await page.waitForTimeout(1500);assert.equal(await page.getByTestId('reads').innerText(),before,'no background reload');
 await page.getByRole('button',{name:'Aggiorna disponibilità',exact:true}).click();await page.waitForFunction(v=>document.querySelector('[data-testid="reads"]').textContent===String(Number(v)+1),before);
 assert.deepEqual(errors,[]);
 console.log('PASS original leader UI → RPC → temporary SQL: reserved tickets only, global search beyond 100, adult/child, F/no-seat, cancel/Escape, response-loss retry, desktop/mobile, no map or polling');
}finally{await browser?.close();rmSync(route,{recursive:true,force:true});}
