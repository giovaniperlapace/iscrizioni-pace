// Original controls and print renderer with synthetic identities and simulated print.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
export async function runReceptionChecks({ phone = false, base = process.argv[2] ?? 'http://127.0.0.1:3188' } = {}) {
 assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
 const route='app/reception-simple-check'; assert.ok(!existsSync(route)); mkdirSync(route);
 writeFileSync(`${route}/page.tsx`, `import Fixture from '@/tests/browser/usb-reception-fixture';import {renderQrLabelsHtml} from '@/lib/qrcode/print-label';import {QR_LABEL_SAMPLES} from '@/lib/qrcode/print-samples';export default async function Page(){const ids=[1,2,3].map(n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'));const documents:Record<string,string>={};for(let mask=1;mask<8;mask++){const positions=[0,1,2].filter(i=>mask&(1<<i));documents[positions.map(i=>ids[i]).join(',')]=await renderQrLabelsHtml(positions.map(i=>QR_LABEL_SAMPLES[i]),'continuous-29x45');}return <Fixture workstation={${phone}} documents={documents}/>;}`);
 const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright'); let browser;
 try {
  browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:900}});
  await context.addInitScript(()=>{window.print=()=>{window.top.__prints=(window.top.__prints??0)+1;window.dispatchEvent(new Event('afterprint'));};});
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const btn=name=>page.getByRole('button',{name,exact:true}).filter({visible:true}).first();
  const log=async kind=>JSON.parse(await page.locator(`[data-${kind}]`).textContent());
  const scenario=async name=>page.getByLabel('Scenario sintetico').selectOption(name);
  const open=async()=>{await page.goto(base+'/reception-simple-check');if(phone){await page.getByRole('button',{name:/^Telefono ·/}).click();await btn('Avvia fotocamera').click();}else await page.getByText('Scanner USB pronto · leggi un QR code',{exact:true}).waitFor();};
  const scan=async(group=false)=>{if(phone)await btn(group?'QR gruppo':'QR singolo').click();else{await page.keyboard.type(group?'G:'+'g'.repeat(43):'a'.repeat(43),{delay:2});await page.keyboard.press('Enter');}};
  const single=()=>btn('Registra presenza').waitFor().catch(async error=>{console.log(await page.locator('body').innerText(),errors,await log('calls'));throw error;});
  const group=()=>page.getByRole('dialog').getByRole('heading',{name:'Gruppo sintetico'}).waitFor();
  const choose=async indices=>{for(const i of indices)await page.locator('input[name=receptionSubjects]').nth(i).check();};
  const saved=()=>page.getByText('✓ Presenza registrata',{exact:true}).first().waitFor();
  const noPrint=async()=>{assert.deepEqual(await log('prints'),[]);assert.equal(await page.getByRole('button',{name:/Stampa|badge/i}).count(),0);assert.equal(await page.locator('iframe').count(),0);};
  await open();await scan();await single();assert.equal((await log('writes')).length,0);assert.equal(await page.locator('dialog[open]').count(),0);
  if(phone){assert.equal(await page.locator('video').isVisible(),false);await noPrint();}
  await scan(true);await page.waitForTimeout(200);assert.equal((await log('calls')).length,1);
  await btn('Registra presenza').dblclick();await saved();assert.equal((await log('writes')).length,1);assert.equal(await page.locator('dialog[open]').count(),0);
  await btn('Modifica presenze').click();await page.locator('input[name=presentSubjects]').uncheck();assert.equal(await btn('Salva presenze').isDisabled(),true);
  await page.locator('input[name=confirmCorrection]').check();await btn('Salva presenze').click();await single();assert.equal((await log('writes')).at(-1).action,'cancel');
  await page.screenshot({path:`/tmp/pace-simple-${phone?'phone':'usb'}-single.png`,fullPage:true});
  if(phone)await btn('Nessun QR').click();await btn('Passa al prossimo codice').click();await scan(true);await group();
  assert.equal(await page.locator('input[name=receptionSubjects]').count(),3);assert.equal(await page.getByRole('dialog').getByText('Ada Mori',{exact:true}).count(),1);
  assert.equal((await log('writes')).length,2);await choose([0,2]);
  await btn(phone?'Registra presenze':'Registra presenze e stampa QR').click();
  if(phone){await page.getByText('✓ Ingresso registrato.',{exact:true}).waitFor();await noPrint();}else{await page.getByText('Comando di stampa inviato per 2 etichette.',{exact:true}).waitFor();assert.deepEqual((await log('prints')).find(c=>c.action==='request').ids,(await log('writes')).at(-1).subjectIds);assert.equal(await page.evaluate(()=>window.__prints),1);}
  assert.equal((await log('writes')).length,3);assert.equal((await log('writes')).at(-1).subjectIds.length,2);
  assert.equal(await page.locator('input[name=receptionSubjects]:checked').count(),2);
  await page.screenshot({path:`/tmp/pace-simple-${phone?'phone':'usb'}-group.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);await btn(phone?'Gestisci presenze':'Gestisci presenze e QR').click();assert.equal(await page.locator('input[name=receptionSubjects]:checked').count(),2);
  await btn('Modifica presenze').click();await page.locator('input[name=presentSubjects]').first().waitFor();assert.equal(await page.locator('input[name=presentSubjects]').count(),3);await page.keyboard.press('Escape');
  console.log('PASS single direct registration, double click, correction, one group roster, shared selection, retained selection and layout');
  await open();await scenario('write-uncertain');await scan();await single();await btn('Registra presenza').click();await btn('Riprova la stessa operazione').waitFor();
  await page.keyboard.press('Escape');await scan(true);assert.equal((await log('calls')).length,2);await btn('Riprova la stessa operazione').click();await saved();const writes=await log('writes');assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);
  await open();await scenario('inspect-uncertain');await scan();await btn('Riprova la stessa operazione').click();await single();assert.deepEqual((await log('calls')).map(c=>c.action),['inspect','inspect']);
  await open();await scenario('forbidden');await scan();await page.getByText(/Sessione scaduta o incarico/).waitFor();assert.equal(await btn('Registra presenza').count(),0);assert.equal(await btn('Stampa etichetta QR').count(),0);
  console.log('PASS uncertain exact-request retry and revoked access');
  if(!phone){
   await open();await scan(true);await group();await choose([1]);await scenario('conflict');await btn('Registra presenze e stampa QR').click();await page.getByText(/Il gruppo o le presenze sono cambiati/).waitFor();assert.equal((await log('prints')).filter(c=>c.action==='request').length,0);
   await open();await scan(true);await group();await choose([0,1]);await scenario('write-uncertain');await btn('Registra presenze e stampa QR').click();await btn('Riprova la stessa operazione').waitFor();assert.equal((await log('prints')).filter(c=>c.action==='request').length,0);await btn('Riprova la stessa operazione').click();await page.getByText(/✓ Richiesta già elaborata/).waitFor();await btn('Stampa i QR del gruppo').click();await page.getByText('Comando di stampa inviato per 2 etichette.',{exact:true}).waitFor();assert.deepEqual((await log('writes'))[0],(await log('writes'))[1]);
   await open();await scan(true);await group();await choose([0,2]);await scenario('print-request-error');await btn('Registra presenze e stampa QR').dblclick();await page.getByText(/Non è stato possibile avviare la stampa/).waitFor();assert.equal((await log('writes')).length,1);assert.equal(await page.locator('input[name=receptionSubjects]:checked').count(),2);await scenario('normal');await btn('Stampa i QR del gruppo').click();await page.getByText('Comando di stampa inviato per 2 etichette.',{exact:true}).waitFor();assert.equal((await log('writes')).length,1);
   await open();await scan();await single();await btn('Stampa etichetta QR').click();await page.getByText('Comando di stampa inviato.',{exact:true}).waitFor();assert.equal((await log('writes')).length,0);
   await btn('Passa al prossimo codice').click();await page.keyboard.type('f'.repeat(43));await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Presenze della famiglia'}).waitFor();await choose([1]);await btn('Registra presenze e stampa QR').click();await page.getByText('Comando di stampa inviato.',{exact:true}).waitFor();assert.equal((await log('writes')).at(-1).subjectIds[0].endsWith('2'),true);assert.equal((await log('prints')).filter(c=>c.action==='request').at(-1).ids[0].endsWith('1'),true);
   await open();await scenario('print-error');await scan(true);await group();await page.getByText(/Non è stato possibile avviare la stampa/).waitFor();await choose([0]);await scenario('normal');await btn('Stampa i QR del gruppo').click();await page.getByText('Comando di stampa inviato.',{exact:true}).waitFor();assert.equal((await log('writes')).length,0);
   await open();await scenario('group-minor');await scan(true);await group();await choose([1,2]);await btn('Registra presenze e stampa QR').click();await page.getByText('Comando di stampa inviato.',{exact:true}).waitFor();assert.equal((await log('writes')).at(-1).subjectIds.length,2);assert.equal((await log('prints')).find(c=>c.action==='request').ids.length,1);
   await open();await page.keyboard.type('s'.repeat(43));await page.keyboard.press('Enter');await btn('Registra presenze').click();await page.locator('input[name=students]').fill('18');await page.locator('input[name=companions]').fill('2');await scan();assert.equal((await log('writes')).length,0);await btn('Registra ingresso').click();await page.getByText('Presenti: 18 studenti e 2 accompagnatori',{exact:true}).waitFor();assert.equal((await log('writes')).length,1);
   console.log('PASS combined conflict prevents print, uncertain presence retry, print-only retry after saved presence, single print-only and minor using parent QR');
  }else{
   await open();await scan();await single();await btn('Cambia modalità').click();await page.waitForFunction(()=>{const s=JSON.parse(document.querySelector('[data-camera]').textContent);return s.started===s.stopped;});await page.getByRole('button',{name:/^Computer ·/}).click();await page.getByText('Scanner USB pronto · leggi un QR code',{exact:true}).waitFor();
   await open();await btn('Ferma fotocamera').click();await scenario('camera-denied');await btn('Avvia fotocamera').click();await page.getByText(/Fotocamera non autorizzata/).waitFor();await btn('Inserisci il codice manualmente').click();await page.getByRole('textbox').fill('T001');await btn('Leggi codice').click();await single();await noPrint();
   console.log('PASS phone has no print requests, releases camera on mode change, manual fallback after denied camera');
  }
  assert.equal(await page.locator('iframe').count(),0);assert.deepEqual(errors,[]);
 }finally{await browser?.close();rmSync(route,{recursive:true,force:true});rmSync('.next/dev/types/app/reception-simple-check',{recursive:true,force:true});}
}
