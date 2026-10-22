// Original component + server action + disposable PostgreSQL. Never production.
import {mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2],root=process.argv[3],socket=process.env.CEREMONY_TEST_SOCKET;
assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);assert.match(socket,/^\/.*\/pace-opening-/);
const route=`${root}/app/ceremony-seats-check`;assert.ok(!existsSync(route));mkdirSync(route);
writeFileSync(`${route}/db.ts`, `import {execFileSync} from 'node:child_process';
const args=${JSON.stringify(['-h',socket,'-p','55484','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-tAq'])};
export function query(sql:string){return JSON.parse(execFileSync('/opt/homebrew/opt/postgresql@17/bin/psql',args,{input:sql,encoding:'utf8',maxBuffer:8*1024*1024}).trim());}
export const desk=()=>query("set role service_role;select get_ceremony_seats_desk(f(1),f(31),'opening');");`);
writeFileSync(`${route}/actions.ts`, `"use server";
import {desk,query} from './db';import {parseDeskCommand,type DeskCommand} from '@/lib/ceremonies/seats-desk';
export async function command(c:DeskCommand){if(!parseDeskCommand(c))throw Error('invalid');const quote=(x:unknown)=>"'"+String(x).replaceAll("'","''")+"'";const result=query('set role service_role;select assign_ceremony_seats(f(1),f(31),'+quote(c.planId)+','+c.revision+','+quote(c.requestId)+','+quote(JSON.stringify(c.data))+'::jsonb);');return {...result,desk:desk()};}`);
writeFileSync(`${route}/page.tsx`, `import Fixture from '@/tests/browser/ceremony-seats-desk-fixture';import {desk,query} from './db';import {command} from './actions';export const dynamic='force-dynamic';export default function Page(){const people=query("select jsonb_agg(jsonb_build_object('registrationId',r.id,'name',p.first_name||' '||p.last_name,'code',p.public_code,'place','Test','group','Delegazione prova','priority',false,'attendance','Presenza da comunicare','children',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',first_name||' '||last_name) order by position) from registration_children where registration_id=r.id),'[]'))) from registrations r join participants p on p.id=r.participant_id where r.id in(f(10),f(11));");return <Fixture initial={desk()} people={people} command={command}/>;}`);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);let browser;
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/ceremony-seats-check`,{waitUntil:'networkidle'});
 assert.equal(await page.getByText('Preparazione e quote',{exact:true}).count(),0);
 const map=page.getByRole('region',{name:'Scegli posti'}); // section with aria-label has region role
 await map.getByLabel('Settore',{exact:true}).first().selectOption({label:'A1 · 100 posti ancora disponibili'});
 await page.getByRole('button',{name:/^A1 · Fila A-b1-r01 · Posto 1 ·/}).click();
 await page.getByRole('button',{name:/^A1 · Fila A-b1-r01 · Posto 2 ·/}).click();
 await page.getByRole('checkbox',{name:'Seleziona Adult Test',exact:true}).check();
 await page.getByRole('checkbox',{name:'Seleziona Child one Test',exact:true}).check();
 await page.getByRole('button',{name:'Verifica e assegna',exact:true}).click();
 await page.getByRole('button',{name:'Conferma assegnazione',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Assegnazione salvata.'}).waitFor();
 assert.equal(await page.getByRole('checkbox',{name:'Seleziona Adult Test',exact:true}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:/^A1 · Fila A-b1-r01 · Posto 1 ·/}).isDisabled(),true);

 await page.getByRole('button',{name:'Parti dalle persone',exact:true}).click();
 await page.getByRole('checkbox',{name:'Seleziona Other Test',exact:true}).check();
 await map.getByLabel('Settore',{exact:true}).first().selectOption({label:'F · 400 posti ancora disponibili'});
 await page.getByRole('button',{name:'Verifica e assegna',exact:true}).click();await page.getByRole('button',{name:'Conferma assegnazione',exact:true}).click();

 await page.getByRole('checkbox',{name:'Seleziona Other Test',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('[aria-label="Seleziona Other Test"]').disabled);
 await page.getByLabel('Destinatari',{exact:true}).selectOption('group');
 await page.getByLabel('Gruppo',{exact:true}).selectOption('11111111-1111-4111-8111-111111111111');
 await page.getByLabel('Quantità di posti',{exact:true}).fill('3');
 await page.getByRole('button',{name:'Verifica e assegna',exact:true}).click();await page.getByRole('button',{name:'Conferma assegnazione',exact:true}).click();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('option')).some(o=>o.textContent==='F · 396 posti ancora disponibili'));
 await page.getByRole('status').filter({hasText:'Assegnazione salvata.'}).waitFor();
 await page.setViewportSize({width:390,height:844});
 await page.getByLabel('Destinatari',{exact:true}).selectOption('assign');
 await map.getByLabel('Settore',{exact:true}).first().selectOption({label:'A · 110 posti ancora disponibili'});
 await page.getByRole('button',{name:/^Blocco A-b2 /}).click();
 assert.equal(await page.getByRole('button',{name:/^A · Fila A-b2-r01 · Posto 1 ·/}).isDisabled(),true);
 assert.equal(await page.getByRole('button',{name:/^A · Fila A-b2-r09 · Posto 1 ·/}).isEnabled(),true);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:'/tmp/pace-ceremony-desk/mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS browser original UI → server action → disposable SQL: family, person-first F, delegation, protocol, mobile, no client errors');
}catch(error){if(browser){const p=browser.contexts()[0]?.pages()[0];if(p){writeFileSync('/tmp/pace-ceremony-desk/browser-failure.txt',await p.locator('body').innerText());await p.screenshot({path:'/tmp/pace-ceremony-desk/failure.png',fullPage:true});}}throw error;}finally{await browser?.close();rmSync(route,{recursive:true,force:true});}
