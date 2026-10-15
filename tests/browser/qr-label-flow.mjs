import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { QR_LABEL_SAMPLES } from '../../lib/qrcode/print-samples.ts';
import { renderQrLabelsHtml } from '../../lib/qrcode/print-label.ts';
const base=process.argv[2]??'http://127.0.0.1:3161';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const route='app/qr-label-check';assert.ok(!existsSync(route));mkdirSync(route);
writeFileSync(`${route}/page.tsx`,`import Fixture from '@/tests/browser/qr-label-fixture';import {renderQrLabelsHtml} from '@/lib/qrcode/print-label';import {QR_LABEL_SAMPLES} from '@/lib/qrcode/print-samples';export default async function Page(){const ids=[1,2,3,4].map(n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'));const documents:Record<string,string>={};for(const [i,sample] of QR_LABEL_SAMPLES.entries())documents[ids[i]]=await renderQrLabelsHtml([sample],'continuous-29x45');documents[ids.slice(0,2).join(',')]=await renderQrLabelsHtml(QR_LABEL_SAMPLES.slice(0,2),'continuous-29x45');return <Fixture documents={documents}/>;}`);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
let browser;
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext();
 await context.addInitScript(()=>{window.print=()=>{window.top.__labelPrints=(window.top.__labelPrints??0)+1;window.dispatchEvent(new Event('afterprint'));};});
 const page=await context.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/qr-label-check');
 await page.getByText('Persone: 5 · Etichette disponibili: 4 · Non stampabili: 1.',{exact:false}).waitFor();
 assert.equal(await page.locator('input[type=checkbox]:checked').count(),2);
 assert.equal(await page.locator('details[open]').count(),0);
 assert.equal(await page.getByRole('button',{name:'Stampa i QR del gruppo',exact:true}).isEnabled(),false);
 await page.getByLabel('Ho controllato la stampante, la carta e le impostazioni di stampa.',{exact:true}).check();
 await page.getByRole('button',{name:'Stampa i QR del gruppo',exact:true}).click();
 await page.waitForFunction(()=>window.__labelPrints===1);
 await page.getByText('Controlla le etichette uscite dalla stampante, poi conferma quelle corrette.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Conferma etichetta',exact:true}).count(),3);
 assert.equal(await page.locator('iframe').count(),0);
 const row=page.locator('li').filter({hasText:'Ada Mori'});
 await row.getByRole('button',{name:'Conferma etichetta',exact:true}).click();
 await row.getByText('Etichetta confermata',{exact:true}).waitFor();
 const other=page.locator('li').filter({hasText:'Alessandra Francesca'});
 await other.getByRole('button',{name:'Ristampa etichetta QR',exact:true}).click();
 await page.waitForFunction(()=>window.__labelPrints===2);
 await page.getByRole('button',{name:'Stampa i QR del gruppo',exact:true}).waitFor();
 await other.getByText('Controlla l’etichetta',{exact:true}).waitFor();
 assert.equal(await row.getByRole('button',{name:'Conferma etichetta',exact:true}).count(),0);
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'/tmp/pace-admin-label-mobile.png',fullPage:true});
 const calls=await page.evaluate(()=>window.__labelCommands);
 assert.equal(calls.filter(c=>c==='print').length,1);assert.equal(calls.filter(c=>c==='reprint').length,1);assert.equal(calls.filter(c=>c==='verify').length,1);
 assert.deepEqual(errors,[]);
 // Headless PDF checks actual CSS pagination/geometry, never a printer job.
 const paper=await context.newPage();const html=await renderQrLabelsHtml(QR_LABEL_SAMPLES,'continuous-29x45');
 await paper.setContent(html);await paper.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 await paper.pdf({path:'/tmp/pace-continuous-4-labels.pdf',preferCSSPageSize:true,printBackground:true});
 await paper.emulateMedia({media:'print'});
 for(const article of await paper.locator('article').all()) {
  const box=await article.boundingBox();assert.ok(box.height<171 && box.height>165);
 }
 console.log('PASS Admin label UI: preflight, one multipage command, no physical auto-confirmation, selective reprint, mobile, cleanup, four-page PDF');
}finally{if(browser)await browser.close();rmSync(route,{recursive:true,force:true});rmSync('.next/dev/types/app/qr-label-check',{recursive:true,force:true});}
