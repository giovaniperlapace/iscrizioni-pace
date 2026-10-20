// Run only against an isolated copy without credentials; HTTP writes are simulated.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
assert.ok(!existsSync('.env.local'), 'Use an isolated copy without credentials');
const base=process.argv[2] ?? 'http://127.0.0.1:3193';
assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const saved=new Map();
for(const dashboard of ['manager','admin']) {
 const path=`app/dashboard/${dashboard}/page.tsx`; saved.set(path,readFileSync(path,'utf8'));
 writeFileSync(path,`import { ServerPaginationFixture } from '@/tests/browser/participants-server-fixture';
 export default function Page(props: { searchParams: Promise<Record<string,string>> }) { return <ServerPaginationFixture {...props} dashboard="${dashboard}" />; }`);
}
let browser;
mkdirSync('/tmp/pace-manager-browser',{recursive:true});
try {
 browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE});
 for (const mobile of [false,true]) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}});
  page.setDefaultTimeout(15000);
  const calls=[],errors=[]; let fail=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/auth/activity',r=>r.fulfill({json:{}}));
  await page.route('**/dashboard/attendance?*',r=>r.fulfill({json:{eventId:'event',updatedAt:null,schoolEntries:{},entries:{},totals:{people:0,adults:0,children:0,students:0,companions:0,schoolBookings:0}}}));
  await page.route('**/dashboard/participants/bulk-update',async r=>{
   calls.push(r.request().postDataJSON()); await new Promise(resolve=>setTimeout(resolve,120));
   await r.fulfill(fail?{status:422,json:{error:'Operazione non eseguita (prova).'}}:{json:{ok:true,count:calls.at(-1).field==='delete-tag'?8:calls.at(-1).registrationIds.length}});
  });
  const start=`${base}/dashboard/manager?section=iscritti&nav=mini&columns=name,group,tags&sort=name&direction=asc`;
  await page.goto(start); await page.getByLabel('Seleziona Anna Test 0',{exact:true}).waitFor();
  assert.equal(await page.locator('tbody input[aria-label^="Seleziona "]').count(),100);
  await page.getByLabel('Seleziona Anna Test 0',{exact:true}).check();
  await page.getByLabel('Seleziona Anna Test 1',{exact:true}).check();
  await page.getByRole('combobox',{name:'Valore da assegnare',exact:true}).selectOption('tag');
  await page.getByRole('button',{name:'Rivedi modifica',exact:true}).click();
  assert.match(await page.getByRole('region',{name:'Conferma modifica multipla'}).innerText(),/a 2 iscritti/);
  assert.equal(await page.getByLabel('Seleziona Anna Test 0',{exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Annulla',exact:true}).click(); assert.equal(calls.length,0);
  await page.getByRole('button',{name:'Rivedi modifica',exact:true}).click();
  await page.getByRole('button',{name:'Conferma modifica',exact:true}).click();
  await page.getByText('Modifica completata per 2 iscritti.',{exact:true}).first().waitFor();
  assert.equal(calls.length,1); assert.equal(calls[0].registrationIds.length,2); assert.equal(calls[0].field,'tags');
  await page.getByLabel('Seleziona tutti gli iscritti della pagina').check();
  await page.getByRole('combobox',{name:'Operazione',exact:true}).selectOption('group');
  await page.getByRole('combobox',{name:'Valore da assegnare',exact:true}).selectOption('group');
  fail=true;
  await page.getByRole('button',{name:'Rivedi modifica',exact:true}).click();
  await page.getByRole('button',{name:'Conferma modifica',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Operazione non eseguita'}).waitFor();
  assert.equal(calls[1].registrationIds.length,100);
  assert.equal(await page.locator('tbody input[aria-label^="Seleziona "]:checked').count(),100);
  await page.getByRole('button',{name:'Annulla',exact:true}).click(); fail=false;
  await page.getByRole('navigation',{name:'Pagine iscritti, inizio elenco'}).getByRole('button',{name:'Successiva'}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Pagine iscritti, inizio elenco"] select')?.value==='2');
  assert.equal(await page.locator('tbody input[aria-label^="Seleziona "]:checked').count(),0);
  await page.getByRole('navigation',{name:'Pagine iscritti, inizio elenco'}).getByRole('button',{name:'Precedente'}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Pagine iscritti, inizio elenco"] select')?.value==='1');
  assert.equal(await page.locator('tbody input[aria-label^="Seleziona "]:checked').count(),0,'returning to an old page must not resurrect a selection');
  const form=page.getByRole('form',{name:'Ricerca iscritti'});
  await form.locator('[name=attendanceYes]').selectOption('2026-10-25__morning');
  await form.locator('[name=attendanceNo]').selectOption('2026-10-25__afternoon');
  await form.getByRole('button',{name:'Cerca',exact:true}).click();
  await page.waitForFunction(()=>location.search.includes('attendanceNo=') && document.querySelector('[aria-label="Ricerca iscritti"]').getAttribute('aria-busy')==='false');
  assert.match(await page.getByRole('navigation',{name:'Pagine iscritti, inizio elenco'}).innerText(),/2[.\s]?503/);
  await page.getByText('Elimina un tag',{exact:true}).click();
  await page.getByRole('combobox',{name:'Tag da eliminare',exact:true}).selectOption('tag');
  await page.getByRole('button',{name:'Rivedi eliminazione',exact:true}).click();
  assert.match(await page.getByRole('region',{name:'Conferma modifica multipla'}).innerText(),/tutti i partecipanti dell’evento/);
  await page.getByRole('button',{name:'Conferma eliminazione tag',exact:true}).click();
  await page.getByText('Tag eliminato. Rimosse 8 assegnazioni.',{exact:true}).first().waitFor();
  assert.equal(calls.at(-1).field,'delete-tag');
  await page.screenshot({path:`/tmp/pace-manager-browser/${mobile?'mobile':'desktop'}.png`,fullPage:false});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'page must not overflow');
  await page.goto(`${start}&viewer=1`);
  await page.getByRole('form',{name:'Ricerca iscritti'}).waitFor();
  assert.equal(await page.getByRole('region',{name:'Modifiche multiple',exact:true}).count(),0);
  assert.equal(await page.locator('tbody input[aria-label^="Seleziona "]').count(),0);
  assert.deepEqual(errors,[]);
  await page.close(); console.log(`PASS ${mobile?'mobile':'desktop'} selection, confirmation, payload, error recovery, pagination, global filters, deletion and Viewer`);
 }
} finally { await browser?.close(); for(const [path,content] of saved) writeFileSync(path,content); }
