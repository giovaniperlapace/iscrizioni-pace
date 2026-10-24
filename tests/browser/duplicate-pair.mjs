import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/giovaniperlapace/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base=process.argv[2];
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(base))throw Error('Local synthetic server only');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],reads=[],posts=[];let rsc=0,failRead=false,failSave=false,slow=false,holdRefresh=false;
  const heldRefreshes=[],dismissed=[];
  await page.route("**/*",route=>{if(holdRefresh && route.request().url().includes("_rsc="))heldRefreshes.push(route);else return route.fallback();});
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>errors.push(e.message));page.on('request',req=>{if(req.url().includes('_rsc='))rsc++;});
  const person=id=>({id,registrationId:id,participantId:`p${id.at(-1)}`,name:`Persona ${id.at(-1)}`,firstName:'Persona',lastName:id.at(-1),publicCode:`TEST-${id.at(-1)}`,email:`persona${id.at(-1)}@example.invalid`,children:[],tagIds:[],eventId:'synthetic',eventTitle:'Fixture',deletedAt:null,registrationStatus:'submitted',birthDate:null,phone:null,country:null,city:null,authUserId:null,place:'',currentGroupId:null,currentGroupName:null,currentGroupStatus:null,currentServiceId:null,currentServiceStatus:null});
  await page.route('**/dashboard/participants/data-quality/review?*',async route=>{
   const pair=new URL(route.request().url()).searchParams.get('pair');reads.push(pair);
   if(slow)await new Promise(r=>setTimeout(r,400));
   if(failRead){return route.fulfill({status:400,json:{error:'Errore di lettura fittizio'}});}
   const ids=pair.split(':');await route.fulfill({json:{left:person(ids[0]),right:person(ids[1]),catalog:{groups:[],services:[],tags:[]},canWrite:true,token:pair}});
  });
  await page.route('**/dashboard/participants/data-quality/api',async route=>{const body=route.request().postDataJSON();posts.push(body);if(!failSave){dismissed.push(body.token);await page.context().addCookies([{name:'synthetic-dismissed',value:JSON.stringify(dismissed),url:base}]);}await route.fulfill({status:failSave?422:200,json:failSave?{error:'Una delle due schede è cambiata. Chiudi e riapri il confronto prima di confermare.'}:{ok:true}});});
  await page.route('**/dashboard/participants/delete',async route=>{const form=await new Response(route.request().postDataBuffer(),{headers:{'Content-Type':route.request().headers()['content-type']}}).formData();posts.push(Object.fromEntries(form));await route.fulfill({json:{redirect:'/duplicate-pair-check?section=iscritti&view=duplicates&duplicatePage=2&managerSaved=deleted'}});});
  await page.goto(base+'/duplicate-pair-check?section=iscritti&view=duplicates&duplicatePage=2');
  await page.getByRole('link',{name:'Non sono duplicati',exact:true}).first().waitFor();
  // Hydration and local query navigation must not rerender the event list.
  await page.waitForFunction(()=>!!document.querySelector('a[href*="duplicatePair="]'));
  slow=true;const baseline=rsc,start=Date.now();
  await page.getByRole('link',{name:'Non sono duplicati',exact:true}).first().click();
  await page.getByRole('status').filter({hasText:'Caricamento delle due schede'}).waitFor();
  const opened=Date.now()-start;
  await page.getByRole('heading',{name:'Confronto schede',exact:true}).waitFor();slow=false;
  assert.equal(rsc,baseline,'opening reran server page');assert.ok(reads.length>=1&&reads.length<=2, 'bounded reads including Strict Mode abort/restart');assert.equal(new Set(reads).size,1);
  assert.equal(await page.getByRole('button',{name:'Conferma: non sono duplicati'}).isDisabled(),true);
  await page.getByLabel('Motivazione',{exact:true}).fill('Persone distinte, verifica fittizia');
  await page.getByRole('checkbox').check();failSave=true;
  await page.getByRole('button',{name:'Conferma: non sono duplicati'}).click();
  await page.getByRole('alert').filter({hasText:'Una delle due schede'}).waitFor();
  assert.equal(await page.locator('dialog textarea').inputValue(),'Persone distinte, verifica fittizia');
  assert.equal(await page.locator('tbody tr').count(),4,'failed save must keep both pairs');
  await page.getByText('Da verificare (2)',{exact:true}).waitFor();
  holdRefresh=true;failSave=false;await page.getByRole('button',{name:'Conferma: non sono duplicati'}).click();
  await page.locator('dialog').waitFor({state:'detached'});
  assert.equal(posts.at(-1).decision,'not_duplicate');assert.equal(posts.at(-1).confirm,true);
  assert.equal(new URL(page.url()).searchParams.get('duplicatePage'),'2');
  await page.waitForFunction(()=>document.querySelectorAll('tbody tr').length===2, null, {timeout:2000});
  await page.getByText('Da verificare (1)',{exact:true}).waitFor();
  await page.getByText('Esclusi (1)',{exact:true}).waitFor();
  await page.getByRole('heading',{name:'Possibili duplicati (1 coppia)',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:/Elimina questa iscrizione: Persona 2/}).count(),0);
  assert.equal(await page.getByRole('link',{name:/Confronta Persona 1 .* con Persona 3/}).count(),1,'other pair for same person must remain');
  assert.ok(heldRefreshes.length>0,'server refresh deliberately held');
  holdRefresh=false;await Promise.all(heldRefreshes.splice(0).map(route=>route.continue()));
  await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('tbody tr').count(),2,'canonical refresh must retain exclusion');
  // Both target IDs survive the fast deletion path; no other registration is submitted.
  await page.getByRole('link',{name:/Elimina questa iscrizione: Persona 3/}).first().click();
  await page.getByLabel('Motivazione dell’eliminazione').waitFor();
  assert.equal(await page.locator('input[name=registrationId]').inputValue(),'00000000-0000-0000-0000-000000000003');
  await page.getByLabel('Motivazione dell’eliminazione').fill('Duplicato fittizio');
  await page.getByRole('checkbox',{name:/Confermo l’eliminazione di Persona 3/}).check();
  await page.getByRole('button',{name:'Elimina iscrizione',exact:true}).click();
  await page.locator('dialog').waitFor({state:'detached'});
  const deletion=posts.at(-1);assert.equal(deletion.registrationId,'00000000-0000-0000-0000-000000000003');assert.equal(deletion.confirmLifecycle,'on');
  // Read failure offers retry; closing during a delayed read discards its result.
  failRead=true;await page.getByRole('link',{name:'Non sono duplicati',exact:true}).first().click();
  await page.getByRole('alert').filter({hasText:'Errore di lettura fittizio'}).waitFor();
  failRead=false;await page.getByRole('button',{name:'Ricarica confronto'}).click();
  await page.getByRole('heading',{name:'Confronto schede',exact:true}).waitFor();
  await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});
  slow=true;await page.getByRole('link',{name:'Non sono duplicati',exact:true}).first().click();
  await page.getByRole('status').filter({hasText:'Caricamento'}).waitFor();
  await page.getByRole('link',{name:'Chiudi confronto duplicati'}).click();
  await page.locator('dialog').waitFor({state:'detached'});await page.waitForTimeout(450);
  assert.equal(await page.locator('dialog').count(),0);slow=false;
  // Compare-only keeps the original read-only controls and fits the viewport.
  await page.getByRole('link',{name:/Confronta Persona 1 .* con Persona 3/}).click();
  await page.getByRole('heading',{name:'Confronto schede',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Conferma: non sono duplicati'}).count(),0);
  const bounds=await page.locator('dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
  await page.screenshot({path:`/tmp/duplicate-pair-${width}.png`});
  await page.keyboard.press('Escape');await page.locator('dialog').waitFor({state:'detached'});
  await page.getByRole('link',{name:'Non sono duplicati',exact:true}).first().click();
  holdRefresh=true;
  await page.getByLabel('Motivazione',{exact:true}).fill('Anche questa coppia è distinta');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Conferma: non sono duplicati'}).click();
  await page.locator('dialog').waitFor({state:'detached'});
  await page.getByText('Nessun caso in questa vista.',{exact:true}).waitFor();
  await page.getByText('Da verificare (0)',{exact:true}).waitFor();
  await page.getByText('Esclusi (2)',{exact:true}).waitFor();
  holdRefresh=false;await Promise.all(heldRefreshes.splice(0).map(route=>route.continue()));
  await page.reload();
  await page.getByText('Nessun caso in questa vista.',{exact:true}).waitFor();
  await page.getByText('Esclusi (2)',{exact:true}).waitFor();
  await page.goto(base+'/duplicate-pair-check?section=iscritti&view=duplicates&duplicateShow=dismissed');
  assert.equal(await page.locator('tbody tr').count(),4);
  assert.equal(await page.getByRole('link',{name:'Non sono duplicati',exact:true}).count(),0);
  // A later canonical recalculation can report the pair again; no persistent client blacklist.
  await page.context().clearCookies();
  await page.goto(base+'/duplicate-pair-check?section=iscritti&view=duplicates');
  await page.getByText('Da verificare (2)',{exact:true}).waitFor();
  assert.equal(await page.locator('tbody tr').count(),4);
  assert.deepEqual(errors,[]);console.log(`PASS browser ${width}px: modal ${opened}ms with delayed API, zero list reloads on open, immediate pair removal/counters while refresh is held, failure retains rows, shared-person pair survives, empty/excluded views, fresh snapshot, delete target, retry and layout`);
  await page.close();
 }
}finally{await browser.close();}
