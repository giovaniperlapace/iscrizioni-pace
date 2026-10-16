import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,rmSync,existsSync,readFileSync} from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:3186';assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const route='app/leader-group-qr-check';assert.ok(!existsSync(route));mkdirSync(route);
writeFileSync(`${route}/page.tsx`,`import Fixture from '@/tests/browser/leader-group-qr-fixture';import {renderQrDataUrl} from '@/lib/qrcode/render';export default async function Page(){return <Fixture images={await Promise.all(['a','b'].map(x=>renderQrDataUrl('G:'+x.repeat(43))))}/>;}`);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');let browser;
try {
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
 for(const scenario of ['unavailable','revoked']){
  await page.getByLabel('Scenario',{exact:true}).selectOption(scenario);await button(0).click();await page.locator('dialog [role=alert]').waitFor();
  assert.equal(await page.locator('dialog img, dialog a[download]').count(),0);const beforeRetry=(await calls()).length;await page.getByRole('button',{name:'Mostra QR',exact:true}).click();await page.locator('dialog [role=alert]').waitFor();assert.equal((await calls()).length,beforeRetry+1);await page.keyboard.press('Escape');
 }
 await page.getByLabel('Scenario',{exact:true}).selectOption('slow');const before=(await calls()).length;await button(0).evaluate(element=>{element.click();element.click();});assert.equal(await button(0).getAttribute('aria-busy'),'true');assert.equal(await button(0).getAttribute('data-button-progress'),'true');await page.locator('dialog img').waitFor();assert.equal((await calls()).length,before+1);await page.keyboard.press('Escape');
 await page.getByLabel('Scenario',{exact:true}).selectOption('active');
 for(const locale of ['it','en','fr','de','es','nl','uk']){
  await page.locator('main').getByLabel('Lingua',{exact:true}).selectOption(locale);await open(0);assert.equal(await page.locator('dialog img').getAttribute('src'),imageA);assert.equal(await page.locator('dialog button, dialog a, dialog input').count(),2);await page.keyboard.press('Escape');
 }
 await page.locator('main').getByLabel('Lingua',{exact:true}).selectOption('it');await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/pace-group-qr-buttons-mobile.png'});await open(0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.ok(await page.locator('dialog img').evaluate(el=>el.getBoundingClientRect().width>=230));await page.screenshot({path:'/tmp/pace-group-qr-mobile.png'});await page.keyboard.press('Escape');
 assert.ok((await calls()).every(call=>call.action==='get'));
 assert.deepEqual(errors,[]);console.log('PASS error/revoked states, double click, seven languages, mobile and only get requests, no management controls');
} finally {await browser?.close();rmSync(route,{recursive:true,force:true});rmSync('.next/dev/types/app/leader-group-qr-check',{recursive:true,force:true});}
