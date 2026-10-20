import {mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const route='app/explicit-forum-children-check';assert.ok(!existsSync(route));mkdirSync(route);
writeFileSync(`${route}/page.tsx`,`import Fixture from '@/tests/browser/explicit-forum-children-fixture';
import {normalizeLocale} from '@/lib/i18n/config';
export default async function Page({searchParams}:{searchParams:Promise<{locale?:string}>}) {const p=await searchParams;return <Fixture locale={normalizeLocale(p.locale)??'it'} />;}`);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');let browser;
try {
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  await page.goto('http://localhost:3137/explicit-forum-children-check');
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Forum sintetico 1',exact:true})});
  await card.getByRole('checkbox').first().waitFor();
  assert.equal(await card.getByRole('checkbox',{checked:true}).count(),0);
  await card.getByRole('button',{name:'Iscriviti al Forum',exact:true}).waitFor();
  await card.getByRole('checkbox',{name:'Minore Uno'}).check();
  assert.match(await card.innerText(),/2 posti/);
  await card.getByRole('button',{name:'Mettiti in coda per questo Forum',exact:true}).waitFor();
  await card.getByRole('checkbox',{name:'Minore Uno'}).uncheck();
  await card.getByRole('button',{name:'Iscriviti al Forum',exact:true}).waitFor();
  const selected=page.locator('article').filter({has:page.getByRole('heading',{name:'Forum sintetico 6',exact:true})});
  assert.equal(await selected.getByRole('checkbox',{checked:true}).count(),1);
  assert.ok(await selected.getByRole('checkbox').first().isDisabled());
  const conflict=page.locator('article').filter({has:page.getByRole('heading',{name:'Forum sintetico 5',exact:true})});
  assert.ok(await conflict.getByRole('button').isDisabled());
  await conflict.getByRole('checkbox',{name:'Minore Uno'}).check();
  assert.ok(await conflict.getByRole('button',{name:'Mettiti in coda per questo Forum'}).isEnabled());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/forum-children-participant-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Switch view'}).click();
  const row=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:/Adulto Test/})});
  assert.equal(await row.getByRole('checkbox',{checked:true}).count(),0);
  await row.getByRole('checkbox',{name:'Minore Due'}).check();
  await row.getByRole('button',{name:/Metti in lista d’attesa/}).waitFor();
  await row.getByRole('checkbox',{name:'Minore Due'}).uncheck();
  await row.getByRole('button',{name:/Iscrivi/}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/forum-children-group-${width}.png`,fullPage:true});
  console.log('PASS',width,'adult-only default, named child choice, seat/queue update, locked confirmed selection, both surfaces, no horizontal page overflow');
 }
 for(const locale of ['it','en','fr','de','es','nl','uk']) {
  await page.setViewportSize({width:390,height:1000});
  await page.goto('http://localhost:3137/explicit-forum-children-check?locale='+locale);
  await page.getByRole('checkbox',{name:'Minore Uno'}).first().waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'Switch view'}).click();
  await page.getByRole('checkbox',{name:'Minore Uno'}).first().waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 console.log('PASS both surfaces in seven languages at 390px');
 assert.deepEqual(errors,[]);
}finally{await browser?.close();rmSync(route,{recursive:true,force:true});}
