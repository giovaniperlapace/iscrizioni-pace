// Browser UI, synthetic response transport and virtual time; no remote account/database/email.
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://127.0.0.1:3164';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const route='app/forum-waitlist-check'; assert.ok(!existsSync(route)); mkdirSync(route);
writeFileSync(`${route}/page.tsx`,`export { default } from '@/tests/browser/forum-waitlist-fixture';`);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright'); let browser;
try {
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1400,height:1000}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let reads=0, state='available', responseRows=[];
 await page.route('**/dashboard/partecipante/forum-availability?*',async route=>{
  reads++;
  await route.fulfill({status:state==='forbidden'?403:200,contentType:'application/json',body:JSON.stringify({rows:responseRows})});
 });
 // Prevent any accidental remote service access from the browser fixture.
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1'&&url.hostname!=='localhost') return route.abort();return route.fallback();});
 await page.clock.install(); await page.goto(base+'/forum-waitlist-check');
 await page.getByRole('heading',{name:'Scegli i tuoi forum'}).waitFor();
 assert.equal(reads,0);
 const full=page.locator('article').filter({has:page.getByRole('heading',{name:'Forum sintetico 2',exact:true})});
 assert.ok(await full.getByRole('button',{name:'Mettiti in coda per questo Forum',exact:true}).isEnabled());
 const queued=page.locator('article').filter({has:page.getByRole('heading',{name:'Forum sintetico 3',exact:true})});
 assert.match(await queued.innerText(),/Posizione in coda: 2/);
 const offered=page.locator('article').filter({has:page.getByRole('heading',{name:'Forum sintetico 4',exact:true})});
 assert.match(await offered.innerText(),/automaticamente.*stessa fascia/);
 assert.ok(await offered.getByRole('button',{name:'Conferma iscrizione a questo Forum',exact:true}).isEnabled());
 assert.ok(await offered.getByRole('button',{name:'Esci dalla coda',exact:true}).isEnabled());
 const conflict=page.locator('article').filter({has:page.getByRole('heading',{name:'Forum sintetico 5',exact:true})});
 assert.ok(await conflict.getByRole('button').isDisabled());
 assert.match(await page.locator('main').innerText(),/anche quello delle 17/);
 await page.screenshot({path:'/tmp/pace-forum-queue-desktop.png',fullPage:true});
 responseRows=await page.locator('article').evaluateAll(articles=>articles.map((a,i)=>({
  panel_id:a.id.replace('forum-','').replace(/-section-\d+$/,''),section_id:`section-${i}`,
  title:a.querySelector('h4').textContent,audience_name:'Iscritti',description:null,starts_at:'2026-10-26T16:00:00+01:00',ends_at:'2026-10-26T18:00:00+01:00',
  location_name:'Sala sintetica',location_address:null,booking_status:'available',party_size:1,
 })));
 await page.clock.fastForward(299000); assert.equal(reads,0);
 await page.clock.fastForward(1000); await full.getByRole('button',{name:'Iscriviti al Forum',exact:true}).waitFor();
 assert.equal(reads,1); assert.equal(await full.getByRole('button',{name:'Mettiti in coda per questo Forum'}).count(),0);
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'/tmp/pace-forum-queue-mobile.png',fullPage:true});
 state='forbidden'; await page.clock.fastForward(300000); await page.getByRole('alert').waitFor();
 assert.equal(await page.locator('article').count(),0);
 for(const locale of ['it','en','fr','de','es','nl','uk']) {
  await page.goto(base+'/forum-waitlist-check?locale='+locale); await page.locator('article').first().waitFor();
  assert.equal(await page.locator('input[name=intent][value=join]').count(),1);
  assert.equal(await page.locator('input[name=intent][value=accept]').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,text:e.textContent.slice(0,80),width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right,classes:e.className})))));
 }
 await page.goto(base+'/forum-waitlist-check?view=home');
 await page.getByRole('link',{name:/Mettiti in coda per questo Forum/}).waitFor();
 assert.match(await page.getByRole('link',{name:/Mettiti in coda per questo Forum/}).getAttribute('href'),/^\/forum\//);
 assert.deepEqual(errors,[]);
 console.log('PASS real Forum cards: FIFO states, deadline/swap warning, queue enabled despite same-slot booking, five-minute button refresh, revoked access, seven languages, mobile and full Forum home CTA');
} finally {
 if(browser) await browser.close(); rmSync(route,{recursive:true,force:true});
 rmSync('.next/dev/types/app/forum-waitlist-check',{recursive:true,force:true});
}
