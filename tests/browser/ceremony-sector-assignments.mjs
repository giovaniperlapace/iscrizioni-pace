// Original components and HTTP reads, canonical RPCs on disposable PostgreSQL.
import {mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const [base,root]=process.argv.slice(2),socket=process.env.CEREMONY_TEST_SOCKET;
assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);assert.match(socket,/^\/.*\/pace-opening-/);
const route=`${root}/app/ceremony-sector-check`;assert.ok(!existsSync(route));mkdirSync(route);mkdirSync(`${route}/read`);mkdirSync(`${route}/leader`);
const args=['-h',socket,'-p','55484','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tAq'];
const query=sql=>JSON.parse(execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',args,{input:sql,encoding:'utf8'}).trim());
writeFileSync(`${route}/db.ts`, `import {execFileSync} from 'node:child_process';const args=${JSON.stringify(args)};export const quote=(x:unknown)=>x===null?'null':"'"+String(x).replaceAll("'","''")+"'";export function query(sql:string){return JSON.parse(execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',args,{input:sql,encoding:'utf8',maxBuffer:8*1024*1024}).trim());}export const desk=()=>query("set role service_role;select get_ceremony_seats_desk(f(1),f(31),'opening');");`);
writeFileSync(`${route}/actions.ts`, `'use server';import {desk,query,quote} from './db';import {parseDeskCommand,type DeskCommand} from '@/lib/ceremonies/seats-desk';import {parseLeaderBatch,type LeaderBatchCommand} from '@/lib/ceremonies/sector-desk';import {parsePairTicketCommand,type PairTicketCommand} from '@/lib/ceremonies/leader-tickets';
export async function save(c:DeskCommand){if(!parseDeskCommand(c))throw Error('invalid');return query('set role service_role;select assign_ceremony_seats(f(1),f(31),'+quote(c.planId)+','+c.revision+','+quote(c.requestId)+','+quote(JSON.stringify(c.data))+'::jsonb);');}
export async function many(c:LeaderBatchCommand){if(!parseLeaderBatch(c))throw Error('invalid');return query('set role service_role;select assign_ceremony_group_members(f(1),f(36),'+quote(c.allocationId)+','+c.revision+','+quote(c.requestId)+','+quote(JSON.stringify(c.subjects))+'::jsonb);');}
export async function pair(c:PairTicketCommand){if(!parsePairTicketCommand(c))throw Error('invalid');return query('set role service_role;select pair_ceremony_group_ticket(f(1),f(36),'+[c.allocationId,c.revision,c.requestId,c.action,c.seatId,c.registrationId,c.childId,c.nomineeId].map(quote).join(',')+');');}
export async function refresh(){return query('set role service_role;select get_ceremony_leader_tickets(f(1),f(36));');}
export async function revoke(c:import('@/lib/ceremonies/assignment-history').RevokeAssignment){const {parseRevokeAssignment}=await import('@/lib/ceremonies/assignment-history');if(!parseRevokeAssignment(c))throw Error('invalid');return query('set role service_role;select revoke_ceremony_assignment(f(1),f(31),'+[c.planId,c.revision,c.requestId,c.kind,c.id].map(quote).join(',')+');');}
`);
writeFileSync(`${route}/read/route.ts`, `import {NextRequest,NextResponse} from 'next/server';import {query,desk,quote} from '../db';import {parseSectorDirectoryQuery} from '@/lib/ceremonies/sector-desk';export async function GET(req:NextRequest){const p=req.nextUrl.searchParams;const q=parseSectorDirectoryQuery({planId:p.get('planId'),groupId:p.get('groupId')||null,withoutGroup:p.get('withoutGroup')==='true',search:p.get('search')??'',page:Number(p.get('page')??1)});if(!q)return NextResponse.json({status:'invalid'},{status:400});const d=query('set role service_role;select get_ceremony_sector_directory(f(1),f(31),'+[q.planId,q.groupId,q.search,q.page,q.withoutGroup].map(quote).join(',')+');');const r=NextResponse.json({status:'loaded',desk:desk(),directory:d},{headers:{'Cache-Control':'private, no-store'}});r.cookies.set('synthetic-refresh',String(Date.now()),{httpOnly:true});return r;}`);
writeFileSync(`${route}/fixture.tsx`,`'use client';import {useState} from 'react';import {CeremonySectorWorkspace} from '@/app/dashboard/ceremony-sector-workspace';import {save,revoke} from './actions';import type {SeatsDesk} from '@/lib/ceremonies/seats-desk';export default function Fixture({desk}:{desk:SeatsDesk}){const [lose,setLose]=useState(false);const [loseRevoke,setLoseRevoke]=useState(false);return <main className="mx-auto max-w-7xl p-4"><button onClick={()=>setLose(true)}>Simula risposta persa</button><button onClick={()=>setLoseRevoke(true)}>Simula revoca persa</button><CeremonySectorWorkspace initialDesk={desk} save={async c=>{const r=await save(c);if(lose){setLose(false);throw Error('lost response');}return r;}} revoke={async c=>{const r=await revoke(c);if(loseRevoke){setLoseRevoke(false);throw Error('lost revoke');}return r;}}/></main>;}`);
writeFileSync(`${route}/page.tsx`,`import Fixture from './fixture';import {desk} from './db';export const dynamic='force-dynamic';export default function Page(){return <Fixture desk={desk()}/>;}`);
writeFileSync(`${route}/leader/page.tsx`,`import {CeremonyLeaderSectors} from '@/app/dashboard/ceremony-leader-sectors';import {refresh,pair,many} from '../actions';export const dynamic='force-dynamic';export default async function Page({searchParams}:{searchParams:Promise<{locale?:string}>}){const {locale}=await searchParams;return <main className="mx-auto max-w-5xl p-4"><CeremonyLeaderSectors locale={(locale??'it') as 'it'} initialView={await refresh()} save={pair} saveMany={many} refresh={refresh}/></main>;}`);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);let browser;
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));let reads=0;
 await page.route('**/dashboard/ceremonies/sectors?**',route=>{reads++;return route.continue({url:route.request().url().replace('/dashboard/ceremonies/sectors','/ceremony-sector-check/read')});});
 await page.goto(base+'/ceremony-sector-check',{waitUntil:'networkidle'});
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1100});
  assert.equal(await page.locator('svg[data-sector="F"] rect').count(),400);
  for(const [sector,total] of [['A',400],['A1',100],['A2',100],['B',600],['C',600],['D',600],['E',740]])assert.equal(await page.locator(`svg[data-sector="${sector}"] rect`).count(),total);
  assert.doesNotMatch(await page.locator('main').innerText(),/\b(?:Blocco \d|Fila \d|Sedia \d|B[56])\b/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'map has no page overflow');
  await page.getByRole('button',{name:/^Settore A ·/}).click();
  const modal=page.getByRole('dialog');await modal.getByLabel('Cerca tra tutti i partecipanti').waitFor();
  await page.waitForFunction(()=>document.querySelector('[role="status"]')?.textContent!=='Caricamento persone…');
  await modal.getByText('Presenza confermata',{exact:true}).first().waitFor();await modal.getByText('Assenza dichiarata',{exact:true}).first().waitFor();await modal.getByText('Presenza da comunicare',{exact:true}).first().waitFor();
  assert.ok(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'modal has no overflow');
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
 }
 await page.setViewportSize({width:1440,height:1100});
 await page.getByRole('button',{name:'Simula revoca persa'}).click();
 await page.setViewportSize({width:390,height:844});
 // A family is shown in full even when the search matches only the adult.
 query("select pair_test('revoke',null,null,null,(select id from ceremony_nominees where child_id=f(40) and revoked_at is null));");
 const family=query("select jsonb_build_object('name',p.first_name||' '||p.last_name,'children',(select jsonb_agg(first_name||' '||last_name) from registration_children where registration_id=f(10))) from participants p join registrations r on r.participant_id=p.id where r.id=f(10);");
 await page.getByRole('button',{name:/^Settore C ·/}).click();
 let familyModal=page.getByRole('dialog');await familyModal.getByLabel('Cerca tra tutti i partecipanti').fill(family.name);await familyModal.getByRole('button',{name:'Cerca',exact:true}).click();
 await familyModal.getByLabel('Seleziona '+family.name,{exact:true}).check();
 await familyModal.getByText(/1 \+ 2 posti \(3 in totale\)/).waitFor();
 assert.equal(await familyModal.getByRole('button',{name:'Verifica e assegna'}).count(),0);
 for(const child of family.children)await familyModal.getByRole('region',{name:'Riepilogo persona'}).getByText(child,{exact:true}).waitFor();
 await familyModal.getByRole('button',{name:'Conferma assegnazione',exact:true}).click();
 await familyModal.getByText('Assegnazione salvata.',{exact:true}).waitFor();
 await familyModal.getByText('3 posti assegnati nominalmente',{exact:true}).click();
 assert.ok(await familyModal.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'family modal mobile has no overflow');
 await page.screenshot({path:'/tmp/pace-ceremony-modal-family-mobile.png'});
 assert.equal(query("select to_json(count(*)) from ceremony_nominees n join ceremony_allocations a on a.id=n.allocation_id where n.registration_id=f(10) and n.revoked_at is null and a.group_id is null;"),3);
 await familyModal.getByText('Nessun posto assegnato a gruppi in questo settore.',{exact:true}).waitFor();
 // Revocations are individual, preserve siblings, and can be replayed after an uncertain response.
 for(const name of [family.name,...family.children]){
  await familyModal.getByRole('button',{name:'Revoca '+name,exact:true}).click();
  await familyModal.getByRole('button',{name:'Conferma revoca',exact:true}).click();
  if(name===family.name)await familyModal.getByRole('button',{name:'Riprova la stessa revoca'}).click();
  await familyModal.getByText('Assegnazione revocata.',{exact:true}).waitFor();
  await familyModal.getByRole('button',{name:'Aggiorna',exact:true}).waitFor({state:'visible'});
 }
 await familyModal.getByRole('button',{name:'Chiudi',exact:true}).click();
 await page.getByRole('button',{name:/^Settore C ·/}).click();familyModal=page.getByRole('dialog');
 assert.equal(await familyModal.getByLabel('Cerca tra tutti i partecipanti').inputValue(),'');
 assert.equal(await familyModal.getByRole('region',{name:'Riepilogo persona'}).count(),0);
 await familyModal.getByRole('button',{name:'Chiudi',exact:true}).click();
 // Closing a pending search invalidates its late response even after another sector opens.
 let releaseSearch;const gate=new Promise(resolve=>{releaseSearch=resolve;});let startedSearch;
 const started=new Promise(resolve=>{startedSearch=resolve;});
 await page.route('**/dashboard/ceremonies/sectors?**search=Member+099**',async route=>{
  const response=await route.fetch({url:route.request().url().replace('/dashboard/ceremonies/sectors','/ceremony-sector-check/read')});startedSearch();await gate;await route.fulfill({response});
 });
 await page.getByRole('button',{name:/^Settore C ·/}).click();familyModal=page.getByRole('dialog');
 await familyModal.getByLabel('Cerca tra tutti i partecipanti').fill('Member 099');await familyModal.getByRole('button',{name:'Cerca',exact:true}).click();await started;
 await familyModal.getByRole('button',{name:'Chiudi',exact:true}).click();
 await page.getByRole('button',{name:/^Settore D ·/}).click();familyModal=page.getByRole('dialog');
 await familyModal.getByText('Presenza confermata',{exact:true}).first().waitFor();
 const lateResponse=page.waitForResponse(r=>r.url().includes('search=Member+099'));releaseSearch();await lateResponse;
 assert.equal(await familyModal.getByLabel('Cerca tra tutti i partecipanti').inputValue(),'');
 await familyModal.getByText('Presenza confermata',{exact:true}).first().waitFor();
 await familyModal.getByRole('button',{name:'Chiudi',exact:true}).click();
 await page.setViewportSize({width:1440,height:1100});
 async function reserve(sector,quantity,lose=false){if(lose)await page.getByRole('button',{name:'Simula risposta persa'}).click();await page.getByRole('button',{name:new RegExp('^Settore '+sector+' ·')}).click();const modal=page.getByRole('dialog');await modal.getByLabel('Modalità di assegnazione').selectOption('group');await modal.getByLabel('Gruppo',{exact:true}).selectOption({label:'Gruppo cento'});await modal.getByLabel('Quantità di posti').fill(String(quantity));await modal.getByRole('button',{name:'Conferma assegnazione',exact:true}).click();if(lose){await modal.getByRole('button',{name:'Riprova la stessa assegnazione'}).click();}await modal.getByText('Assegnazione salvata.',{exact:true}).waitFor();await modal.getByRole('button',{name:'Chiudi',exact:true}).click();}
 await reserve('A',20,true);await reserve('B',80);
 assert.equal(query("select to_json(sum(quantity)) from ceremony_allocations where group_id=f(7810) and revoked_at is null;"),100);
 await page.getByRole('button',{name:/^Settore A ·/}).click();let modal=page.getByRole('dialog');await modal.getByLabel('Cerca tra tutti i partecipanti').fill('Member 001');await modal.getByRole('button',{name:'Cerca',exact:true}).click();await modal.getByLabel('Seleziona Synthetic Member 001',{exact:true}).check();await modal.getByRole('button',{name:'Conferma assegnazione',exact:true}).click();await modal.getByText('Assegnazione salvata.',{exact:true}).waitFor();await modal.getByRole('button',{name:'Chiudi',exact:true}).click();
 assert.equal(query("select to_json(sum(quantity)) from ceremony_allocations where group_id=f(7810) and revoked_at is null;"),100);
 // A nominal member does not consume or create a group allocation.
 assert.equal(query("select to_json(count(*)) from ceremony_nominees n join ceremony_allocations a on a.id=n.allocation_id where n.registration_id=f(81001) and n.revoked_at is null and a.group_id is null;"),1);
 await page.getByRole('button',{name:/^Settore A ·/}).click();modal=page.getByRole('dialog');
 assert.equal(await modal.getByLabel('Cerca tra tutti i partecipanti').inputValue(),'');
 await modal.getByText('1 posto assegnato nominalmente',{exact:true}).click();
 await modal.getByRole('region',{name:'Assegnazioni del settore'}).scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/pace-ceremony-modal-assignments-desktop.png'});
 await modal.getByRole('button',{name:'Revoca Synthetic Member 001',exact:true}).click();
 await modal.getByRole('button',{name:'Conferma revoca',exact:true}).click();
 await modal.getByText('Assegnazione revocata.',{exact:true}).waitFor();
 await modal.getByRole('button',{name:'Chiudi',exact:true}).click();
 query("insert into event_attendance_choices(registration_id,day,day_part,choice) values(f(81100),'2026-10-25','afternoon','yes'),(f(81002),'2026-10-25','morning','yes');select '{}'::json;");
 const leader=await browser.newPage({viewport:{width:390,height:844}});leader.on('pageerror',e=>errors.push(e.message));await leader.goto(base+'/ceremony-sector-check/leader',{waitUntil:'networkidle'});
 await leader.getByRole('radio',{name:'Inaugurazione · Gruppo cento · Settore A',exact:true}).check();
 const people=leader.getByRole('region',{name:'2. Scegli le persone',exact:true});
 assert.equal(await people.getByRole('article').nth(1).getAttribute('aria-label'),'Synthetic Member 100');
 assert.equal(await people.getByRole('article').first().getByRole('checkbox').getAttribute('aria-label'),'Seleziona Synthetic Member 001');
 await people.getByRole('article').first().getByText('Presenza confermata',{exact:true}).waitFor();
 await people.getByRole('article',{name:'Synthetic Member 002',exact:true}).getByText('Assenza dichiarata',{exact:true}).waitFor();
 await people.getByRole('article',{name:'Synthetic Member 003',exact:true}).getByText('Presenza da comunicare',{exact:true}).waitFor();
 await leader.getByLabel('Cerca nome o codice').fill('Member 00');
 assert.equal(await people.getByRole('article').first().getAttribute('aria-label'),'Synthetic Member 001');
 await leader.getByLabel('Cerca nome o codice').fill('');
 await leader.getByLabel('Seleziona Synthetic Member 003',{exact:true}).check();
 await leader.getByRole('region',{name:'Biglietti da assegnare',exact:true}).getByRole('button',{name:'Rimuovi Synthetic Member 003',exact:true}).click();
 assert.equal(await leader.getByLabel('Seleziona Synthetic Member 003',{exact:true}).isChecked(),false);
 for(let i=1;i<=20;i++)await leader.getByLabel(`Seleziona Synthetic Member ${String(i).padStart(3,'0')}`,{exact:true}).check();
 for(const width of [390,1440]){
  await leader.setViewportSize({width,height:width===390?844:1100});
  const recipients=leader.getByRole('region',{name:'Biglietti da assegnare',exact:true});
  await recipients.scrollIntoViewIfNeeded();
  assert.ok(await leader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await recipients.getByRole('listitem').count(),20);
  await leader.screenshot({path:`/tmp/pace-leader-recipients-${width}.png`});
  await leader.getByRole('group',{name:'1. Scegli i posti ricevuti',exact:true}).scrollIntoViewIfNeeded();
  await leader.screenshot({path:`/tmp/pace-leader-sectors-${width}.png`});
 }
 await leader.getByRole('button',{name:'Conferma assegnazione al settore',exact:true}).click();await leader.getByRole('dialog').getByRole('button',{name:'Conferma assegnazione al settore',exact:true}).click();await leader.getByText('Modifica salvata.',{exact:true}).waitFor();
 await leader.getByRole('radio',{name:'Inaugurazione · Gruppo cento · Settore B',exact:true}).check();await leader.getByLabel('Seleziona tutte le persone disponibili in questa pagina').check();await leader.getByRole('button',{name:'Conferma assegnazione al settore',exact:true}).click();await leader.getByRole('dialog').getByRole('button',{name:'Conferma assegnazione al settore',exact:true}).click();
 await leader.waitForFunction(()=>document.querySelector('[aria-label="Posti ricevuti"]')?.textContent?.includes('Assegnati: 80'));
 assert.equal(query("select to_json(count(*)) from ceremony_nominees n join ceremony_allocations a on a.id=n.allocation_id where a.group_id=f(7810) and n.revoked_at is null;"),100);
 assert.equal(query("select to_json(count(*)) from ceremony_seat_claims where released_at is null;"),0);
 assert.ok(await leader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 // Independent refresh sees leader changes and retains the 20/80 sector capacity.
 await page.getByRole('button',{name:'Aggiorna disponibilità'}).click();await page.getByRole('button',{name:/^Settore A · 90 posti/}).waitFor();
 for(const locale of ['en','fr','de','es','nl','uk']){await leader.goto(base+'/ceremony-sector-check/leader?locale='+locale,{waitUntil:'networkidle'});assert.ok(await leader.locator('h1').innerText());await leader.getByRole('radio').first().check();assert.ok(await leader.getByRole('checkbox').count()>0);assert.ok(await leader.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.deepEqual(errors,[]);assert.ok(reads<60,'no polling');
 await page.screenshot({path:'/tmp/pace-sector-manager-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/pace-sector-manager-mobile.png',fullPage:true});
 console.log('PASS browser: both maps, 400 F squares, no internal chair labels, desktop/mobile dialog, all attendance states, explicit groups, lost-response retry, direct family separate from reserves, one-click assignment, in-modal revocations, cleared reopening, leader 20/80 split, seven languages and no polling');
}catch(error){for(const context of browser?.contexts()??[])for(const page of context.pages()){await page.screenshot({path:'/tmp/pace-sector-failure.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(-4000));}throw error;}finally{await browser?.close();rmSync(route,{recursive:true,force:true});}
