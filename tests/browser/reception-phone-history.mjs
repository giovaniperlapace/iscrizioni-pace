import assert from 'node:assert/strict';

export async function checkPhoneHistory({browser,context,base,psql,calls,errors}) {
 psql("select reception_desk(fw(200),fw(8),fw(403)::text,'code','QQQ7','book',fw(503),'{}',fw(9981));");
 for(const [name,userAgent] of [
  ['iphone','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'],
  ['android','Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'],
 ]) {
  const mobile=await browser.newContext({userAgent,isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
  let release;
  try {
   await mobile.addCookies(await context.cookies());
   const page=await mobile.newPage();page.setDefaultTimeout(15000);
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   const prior=base+'/test-duty-windows?navigation-test='+name;
   const station=base+'/dashboard/accoglienza-forum-eventi';
   const chooser=()=>page.getByRole('heading',{name:'Scegli l’incarico',exact:true}).waitFor();
   const select=async(title='Verifica iscrizione')=>{
    await page.waitForLoadState('networkidle');
    await page.getByRole('button',{name:title,exact:true}).click();
    await page.getByRole('button',{name:'Avvia fotocamera',exact:true}).waitFor();
   };
   await page.goto(prior);await page.goto(station);await chooser();
   const length=await page.evaluate(()=>history.length);
   for(let repeat=0;repeat<3;repeat++){
    await select();assert.equal(await page.evaluate(()=>history.length),length+1);
    await page.goBack();await chooser();assert.equal(page.url(),station);
    await page.goForward();await page.getByRole('button',{name:'Avvia fotocamera',exact:true}).waitFor();
    await page.getByRole('button',{name:'Cambia incarico',exact:true}).click();await chooser();
   }
   await page.goBack();await page.waitForURL(prior);
   await page.goForward();await chooser();
   await select();await page.reload();
   await page.getByRole('button',{name:'Avvia fotocamera',exact:true}).waitFor();
   await page.goBack();await chooser();
   // Manual result remains a normal navigable view, including invalid QR.
   await select();await page.getByRole('button',{name:'Inserisci il codice manualmente',exact:true}).click();
   await page.getByLabel('Codice partecipante',{exact:true}).fill('ZZZZ');
   await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
   await page.getByRole('button',{name:'Cambia incarico',exact:true}).waitFor();
   await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.textContent==='Cambia incarico').disabled);
   await page.goBack();await chooser();
   // A definite revocation has no operation to finish and must not trap Back.
   await select();await page.getByRole('button',{name:'Inserisci il codice manualmente',exact:true}).click();
   const revoked=async route=>{
    if(route.request().postDataJSON().operation==='scan')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'forbidden'})});
    return route.fallback();
   };
   await page.route('**/api/forum-reception',revoked);
   await page.getByLabel('Codice partecipante',{exact:true}).fill('QQQ7');
   await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
   await page.getByText(/Sessione scaduta o incarico non più autorizzato/).waitFor();
   await page.goBack();await chooser();
   await page.unroute('**/api/forum-reception',revoked);
   // Leaving an active camera stops its stream and does not leave the route.
   await page.evaluate(()=>{
    window.historyCameraTracks=[];
    navigator.mediaDevices.getUserMedia=async()=>{
     const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
     const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,320,320);
     const stream=canvas.captureStream(10);window.historyCameraTracks.push(...stream.getTracks());return stream;
    };
   });
   await select();await page.getByRole('button',{name:'Avvia fotocamera',exact:true}).click();
   await page.getByRole('button',{name:'Ferma fotocamera',exact:true}).waitFor();
   await page.waitForFunction(()=>window.historyCameraTracks.length===1);
   await page.goBack();await chooser();
   assert.equal(await page.evaluate(()=>window.historyCameraTracks.every(t=>t.readyState==='ended')),true);
   // Pending and uncertain writes retain the exact command/receipt across Back.
   psql('update check_ins set cancelled_at=now() where registration_id=fw(107) and moment_id=fw(403) and cancelled_at is null;');
   await page.getByRole('button',{name:/^Morning A/}).click();
   await page.getByRole('button',{name:'Inserisci il codice manualmente',exact:true}).click();
   await page.getByLabel('Codice partecipante',{exact:true}).fill('QQQ7');
   let first=true;
   await page.route('**/api/forum-reception',async route=>{
    const body=route.request().postDataJSON();
    if(body.operation!=='scan' || body.command.action!=='enter' || !first) return route.fallback();
    first=false;
    const response=await route.fetch();assert.equal((await response.json()).status,'valid');
    await new Promise(resolve=>{release=resolve;});
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'unavailable'})});
   });
   const writesBefore=calls.filter(c=>c.name==='reception_panel_check_in'&&c.body.p_action==='enter').length;
   await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
   await page.waitForFunction(()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Cambia incarico').disabled);
   await page.goBack();
   await page.waitForFunction(()=>!!history.state?.paceReceptionDuty?.key);
   assert.equal(await page.getByRole('heading',{name:'Scegli l’incarico',exact:true}).count(),0);
   for(let attempt=0;!release && attempt<1500;attempt++) await new Promise(resolve=>setTimeout(resolve,10));
   assert.ok(release);release();
   await page.getByRole('button',{name:'Riprova la stessa operazione',exact:true}).waitFor();
   await page.goBack();await page.waitForFunction(()=>!!history.state?.paceReceptionDuty?.key);
   await page.getByRole('button',{name:'Riprova la stessa operazione',exact:true}).click();
   await page.getByText('✓ Ingresso confermato',{exact:true}).waitFor();
   const writes=calls.filter(c=>c.name==='reception_panel_check_in'&&c.body.p_action==='enter').slice(writesBefore);
   assert.equal(writes.length,2);assert.deepEqual(writes[0].body,writes[1].body);
   assert.equal(psql('select count(*) from check_ins where registration_id=fw(107) and moment_id=fw(403) and cancelled_at is null;',true).trim(),'1');
   await page.getByRole('button',{name:'Rimuovi ingresso',exact:true}).click();
   await page.getByRole('dialog').waitFor();
   await page.goBack();await page.waitForFunction(()=>!!history.state?.paceReceptionDuty?.key);
   await page.getByRole('dialog').getByRole('button',{name:'Annulla',exact:true}).click();
   await page.goBack();await chooser();
   await page.screenshot({path:`/tmp/pace-phone-history-${name}.png`,fullPage:true});
   // Forward cannot restore a duty after its availability window has ended.
   await page.clock.install();
   await page.clock.fastForward(6*60*60*1000);
   await page.goForward();await chooser();
   assert.equal(await page.locator('video').count(),0);
   console.log(`PASS ${name}: native Back/Forward/reload, chooser then prior page, repeated button navigation, invalid QR/revocation, camera cleanup, confirmation and pending/uncertain exact retry and expired duty`);
  } finally {
   release?.();
   for(const page of mobile.pages())await page.unrouteAll({behavior:'ignoreErrors'});
   await mobile.close();
  }
 }
 // Desktop selection continues to use its existing local state/history.
 const desktop=await context.newPage();
 try {
  await desktop.goto(base+'/dashboard/accoglienza-forum-eventi');
  await desktop.getByRole('button',{name:/Computer ·/}).click();
  const length=await desktop.evaluate(()=>history.length);
  await desktop.getByRole('button',{name:'Verifica iscrizione',exact:true}).click();
  assert.equal(await desktop.evaluate(()=>history.length),length);
  await desktop.getByRole('button',{name:'Cambia incarico',exact:true}).click();
  await desktop.getByRole('heading',{name:'Scegli l’incarico',exact:true}).waitFor();
 } finally {await desktop.close();}
}
