import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,rmSync,existsSync,readFileSync} from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:3186';assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.ok(!existsSync('.env.local'),'Use an isolated copy without real credentials');
const actionPath='app/dashboard/capogruppo/qr-gruppo/actions.ts',originalAction=readFileSync(actionPath,'utf8');
const labelPath='app/dashboard/participants/qr/labels/actions.ts',originalLabels=readFileSync(labelPath,'utf8');
const route='app/leader-group-qr-check';assert.ok(!existsSync(route));mkdirSync(route);
writeFileSync(`${route}/page.tsx`,`import Fixture from '@/tests/browser/leader-group-qr-fixture';import {renderQrDataUrl} from '@/lib/qrcode/render';export default async function Page({searchParams}:{searchParams:Promise<Record<string,string>>}){return <Fixture printing={(await searchParams).printing==='1'} http={(await searchParams).http==='1'} images={await Promise.all(['a','b'].map(x=>renderQrDataUrl('G:'+x.repeat(43))))}/>;}`);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');let browser;
try {
 writeFileSync(actionPath,`"use server";
import {cookies} from 'next/headers';import {renderQrDataUrl} from '@/lib/qrcode/render';
export async function groupReceptionQr(groupId:string,action:"get"):Promise<{status:"active";image:string}|{status:"revoked"|"unavailable"}>{
 (await cookies()).set('synthetic-group-session',String(Date.now()));
 if(action!=="get")throw new Error('Unexpected mutation');
 return {status:'active',image:await renderQrDataUrl('G:'+(groupId.endsWith('1')?'a':'b').repeat(43))};
}`);
 writeFileSync(labelPath,`"use server";
import {cookies} from 'next/headers';
export async function qrLabelCommand(input:unknown){
 const c=input as {action:string;ids?:string[];requestId:string};
 (await cookies()).set('synthetic-label-session',String(Date.now()));
 await new Promise(resolve=>setTimeout(resolve,600));
 if(c.action==='request')return {status:'document' as const,requestId:c.requestId,html:'<html data-qr-label="29x45"><head></head><body>'+JSON.stringify(c.ids)+'</body></html>'};
 return {status:'queue' as const,snapshot:'a'.repeat(64),items:[1,2,3].map(i=>({registrationId:'00000000-0000-4000-8000-00000000000'+i,name:['Ada Mori','Bruno Test','Carla Test'][i-1],code:'TEST'+i,reason:i===3?'cancelled':null,state:'pending' as const,attempts:0,outcome:null,changed:false}))};
}`);
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const calls=async()=>JSON.parse(await page.locator('[data-calls]').textContent());
 const button=i=>page.locator('article button[aria-haspopup=dialog]').nth(i);
 const open=async i=>{await button(i).click();await page.locator('dialog img').waitFor();};
 await page.goto(base+'/leader-group-qr-check');await button(0).waitFor();assert.deepEqual(await calls(),[]);
 await open(0);assert.equal((await calls()).length,1);assert.equal((await calls())[0].action,'get');
 assert.equal((await calls())[0].id,'00000000-0000-4000-8000-000000000001');
 await page.locator('dialog').getByRole('heading',{name:'Anziani - Torrenova',exact:true}).waitFor();assert.equal(await page.locator('dialog input[type=checkbox]').count(),0);
 const imageA=await page.locator('dialog img').getAttribute('src');
 const beforeDownload=(await calls()).length;
 const pendingDownload=page.waitForEvent('download');await page.getByRole('link',{name:'Scarica QR',exact:true}).click();const download=await pendingDownload;
 assert.equal(download.suggestedFilename(),'qr-gruppo-Anziani-Torrenova.png');assert.deepEqual(readFileSync(await download.path()),Buffer.from(imageA.split(',')[1],'base64'));
 assert.equal((await calls()).length,beforeDownload,'Download must reuse the displayed QR without another request');
 assert.equal(await page.locator('dialog a, dialog input, dialog button').count(),2);
 await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});assert.equal(await button(0).evaluate(el=>el===document.activeElement),true);
 await open(1);assert.notEqual(await page.locator('dialog img').getAttribute('src'),imageA);assert.equal((await calls()).at(-1).id,'00000000-0000-4000-8000-000000000002');
 assert.equal(await page.locator('dialog a[download]').getAttribute('download'),'qr-gruppo-Група-Київ-École.png');
 await page.getByRole('button',{name:'Chiudi',exact:true}).click();
 console.log('PASS one-click selected group QR, no initial requests, distinct group images, read-only dialog, unchanged PNG download and focus/Escape');
 for(const scenario of ['unavailable','revoked','invalid-image']){
  await page.getByLabel('Scenario',{exact:true}).selectOption(scenario);await button(0).click();await page.locator('dialog [role=alert]').waitFor();
  assert.equal(await page.locator('dialog img, dialog a[download]').count(),0);const beforeRetry=(await calls()).length;await page.getByRole('button',{name:'Mostra QR',exact:true}).click();await page.locator('dialog [role=alert]').waitFor();assert.equal((await calls()).length,beforeRetry+1);await page.keyboard.press('Escape');
 }
 await page.getByLabel('Scenario',{exact:true}).selectOption('slow');const before=(await calls()).length;await button(0).evaluate(element=>{element.click();element.click();});assert.equal(await button(0).getAttribute('aria-busy'),'true');assert.equal(await button(0).getAttribute('data-button-progress'),'true');const loadingBox=await page.locator('dialog').boundingBox();const closeBox=await page.locator('dialog button').boundingBox();
 assert.equal(await page.locator('dialog a[download],dialog img,dialog h3').count(),0,'Only the loading state is revealed');
 await page.locator('dialog img').waitFor();assert.equal((await calls()).length,before+1);
 assert.deepEqual(await page.locator('dialog').boundingBox(),loadingBox);assert.deepEqual(await page.locator('dialog button').boundingBox(),closeBox);
 assert.ok(await page.locator('dialog img').evaluate(img=>img.complete&&img.naturalWidth>0));await page.keyboard.press('Escape');
 await page.getByLabel('Scenario',{exact:true}).selectOption('active');
 for(const locale of ['it','en','fr','de','es','nl','uk']){
  await page.locator('main').getByLabel('Lingua',{exact:true}).selectOption(locale);await open(0);assert.equal(await page.locator('dialog img').getAttribute('src'),imageA);assert.equal(await page.locator('dialog button, dialog a, dialog input').count(),2);await page.keyboard.press('Escape');
 }
 await page.locator('main').getByLabel('Lingua',{exact:true}).selectOption('it');await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/pace-group-qr-buttons-mobile.png'});await open(0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.ok(await page.locator('dialog img').evaluate(el=>el.getBoundingClientRect().width>=230));await page.screenshot({path:'/tmp/pace-group-qr-mobile.png'});await page.keyboard.press('Escape');
 assert.ok((await calls()).every(call=>call.action==='get'));
 // Exercise the default HTTP path with session cookies refreshed by the server.
 for(const width of [1280,390]) {
  await page.setViewportSize({width,height:844});
  let requests=0,actions=0;
  const observe=r=>{if(r.url().endsWith('/dashboard/groups/qr'))requests++;if(r.headers()['next-action'])actions++;};
  page.on('request',observe);await page.goto(base+'/leader-group-qr-check?http=1');await button(0).waitFor();assert.equal(requests,0);
  await button(0).scrollIntoViewIfNeeded();await page.waitForTimeout(350);const y=await page.evaluate(()=>scrollY);assert.ok(y>500);
  await open(0);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>scrollY),y);assert.equal(requests,1);assert.equal(actions,0);
  assert.equal(await page.locator('dialog img').getAttribute('src'),imageA);await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>scrollY),y);assert.equal(await button(0).evaluate(el=>el===document.activeElement),true);page.off('request',observe);
 }
 // Unified modal: both reads settle before reveal, explicit selection and simulated printing.
 await page.addInitScript(()=>{window.print=()=>{window.top.__prints=(window.top.__prints??0)+1;window.dispatchEvent(new Event('afterprint'));};});
 for (const width of [1280,390]) {
  await page.setViewportSize({width,height:844});
  const mutations=[];let reads=0;
  const observe=r=>{if(r.headers()['next-action'])mutations.push(r.postData());else if(r.url().endsWith('/dashboard/groups/qr'))reads++;};
  page.on('request',observe);
  await page.goto(base+'/leader-group-qr-check?http=1&printing=1');await button(0).waitFor();assert.equal(reads,0);
  await button(0).scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);await button(0).click();
  await page.locator('dialog [role=status]').waitFor();assert.equal(await page.locator('dialog img,dialog input').count(),0);
  await page.getByRole('heading',{name:'QR dei partecipanti',exact:true}).waitFor();assert.equal(reads,2);assert.equal(mutations.length,0);
  assert.equal(await page.evaluate(()=>scrollY),y);
  const printButton=page.getByRole('button',{name:'Stampa i QR selezionati',exact:true});
  assert.equal(await printButton.isDisabled(),true);assert.equal(await page.locator('dialog input:checked').count(),0);
  assert.equal(await page.getByLabel('Carla Test · TEST3',{exact:true}).isDisabled(),true);
  await page.getByLabel('Ada Mori · TEST1',{exact:true}).check();await page.getByLabel('Bruno Test · TEST2',{exact:true}).check();await page.getByLabel('Ada Mori · TEST1',{exact:true}).uncheck();
  await printButton.click();assert.equal(await page.getByRole('button',{name:'Chiudi',exact:true}).isDisabled(),true);
  await page.getByText('Comando di stampa inviato.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.__prints),1);assert.ok(mutations.some(body=>body.includes('00000000-0000-4000-8000-000000000002')));
  assert.ok(mutations.every(body=>!body.includes('00000000-0000-4000-8000-000000000003')));
  assert.equal(await page.getByLabel('Bruno Test · TEST2',{exact:true}).isChecked(),true);
  assert.equal(await page.getByLabel('Ada Mori · TEST1',{exact:true}).isChecked(),false);
  await page.screenshot({path:'/tmp/pace-unified-qr-'+width+'.png'});await page.keyboard.press('Escape');
  page.off('request',observe);
 }
 await page.goto(base+'/leader-group-qr-check?http=1&printing=1');
 const denyLabels=async route=>{if(route.request().postDataJSON()?.kind==='labels')await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'forbidden'})});else await route.continue();};
 await page.route('**/dashboard/groups/qr',denyLabels);await open(0);
 await page.getByText('Non sei autorizzato a stampare questi QR. Verifica il tuo accesso.',{exact:true}).waitFor();
 assert.equal(await page.locator('dialog input').count(),0);assert.equal(await page.locator('dialog a[download]').count(),1);
 await page.unroute('**/dashboard/groups/qr',denyLabels);await page.getByRole('button',{name:'Riprova caricamento elenco',exact:true}).click();
 await page.getByLabel('Bruno Test · TEST2',{exact:true}).waitFor();assert.equal(await page.locator('dialog input:checked').count(),0);
 assert.equal(await page.getByRole('button',{name:'Stampa i QR selezionati',exact:true}).isDisabled(),true);await page.keyboard.press('Escape');
 console.log('PASS unified group QR/selected labels, no prefetch, atomic reveal, HTTP reads, empty selection, disabled invalid QR, selection preserved and simulated print');
 // Bounded image/request preparation, retry and stale result isolation.
 await page.goto(base+'/leader-group-qr-check');await page.clock.install();
 await page.getByLabel('Scenario',{exact:true}).selectOption('timeout');await button(0).click();
 await page.locator('dialog [role=status]').waitFor();await page.clock.fastForward(26_000);await page.locator('dialog [role=alert]').waitFor();
 assert.equal(await page.locator('dialog a[download],dialog img').count(),0);await page.keyboard.press('Escape');
 await page.getByLabel('Scenario',{exact:true}).selectOption('active');await open(1);const latest=await page.locator('dialog img').getAttribute('src');
 await page.clock.fastForward(5_000);assert.equal(await page.locator('dialog img').getAttribute('src'),latest);await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('PASS stable loading/reveal, decoded image, timeout/stale results, refreshed session without navigation/scroll, error/revoked states, double click, seven languages and mobile');
} finally {writeFileSync(labelPath,originalLabels);writeFileSync(actionPath,originalAction);await browser?.close();rmSync(route,{recursive:true,force:true});rmSync('.next/dev/types/app/leader-group-qr-check',{recursive:true,force:true});}
