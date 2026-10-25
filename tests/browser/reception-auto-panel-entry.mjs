import assert from 'node:assert/strict';

export async function checkAutomaticPanelEntry({page,base,psql,calls,qrImage}) {
 const btn=name=>page.getByRole('button',{name,exact:true});
 const writes=()=>calls.filter(c=>c.name==='reception_panel_check_in'&&c.body.p_action==='enter');
 const count=()=>Number(psql('select count(*) from check_ins where registration_id=fw(107) and moment_id=fw(403) and cancelled_at is null;',true).trim());
 const reset=()=>psql('update check_ins set cancelled_at=now() where registration_id=fw(107) and moment_id=fw(403) and cancelled_at is null;');
 const open=async(phone=false)=>{
  await page.goto(base+'/dashboard/accoglienza-forum-eventi');
  await page.getByRole('button',{name:phone?/Telefono ·/:/Computer ·/}).click();
  await page.getByRole('button',{name:/^Morning A/}).click();
 };
 const manual=async()=>{await page.getByLabel('Codice partecipante',{exact:true}).fill('QQQ7');await btn('Leggi codice').click();};
 const saved=()=>page.getByText('✓ Ingresso confermato',{exact:true}).waitFor();
 const manualButton=async(disabled=true)=>{await btn('Conferma ingresso').waitFor();assert.equal(await btn('Conferma ingresso').isDisabled(),disabled);};
 // Ensure this person is booked at the intended Forum through the ordinary desk RPC.
 psql("select reception_desk(fw(200),fw(8),fw(403)::text,'code','QQQ7','book',fw(503),'{}',fw(9981));");
 reset();await open();
 const stats=page.getByRole('region',{name:'Statistiche dell’incarico'});
 await stats.getByText(/Entrati/).waitFor();const before=Number((await stats.innerText()).match(/(\d+) Entrati/)[1]);
 const writesBefore=writes().length;await manual();await saved();await manualButton();
 assert.equal(count(),1);assert.equal(writes().length,writesBefore+1);
 await page.waitForFunction(expected=>document.querySelector('[aria-label="Statistiche dell’incarico"]').textContent.includes(expected+' Entrati'),before+1);
 await page.screenshot({path:'/tmp/pace-auto-entry-desktop.png',fullPage:true});
 await btn('Chiudi scheda').click();await manual();await saved();assert.equal(writes().length,writesBefore+1,'already entered only inspected');
 // History and removal inspections must not undo an explicit removal.
 await btn('Rimuovi ingresso').click();await page.getByRole('dialog').getByRole('button',{name:'Conferma rimozione',exact:true}).click();
 await page.getByText('Ingresso non confermato',{exact:true}).waitFor();assert.equal(count(),0);
 await btn('Chiudi scheda').click();await btn('Apri Scheda').click();
 await manualButton(false);
 assert.equal(count(),0);assert.equal(writes().length,writesBefore+1);
 await btn('Conferma ingresso').click();await saved();assert.equal(count(),1);
 assert.equal(writes().length,writesBefore+2,'manual confirmation from history remains usable');
 reset();
 await btn('Chiudi scheda').click();await btn('Scanner USB').click();
 await page.getByLabel('Scanner USB',{exact:true}).focus();await page.keyboard.type('F'.repeat(43),{delay:1});await page.keyboard.press('Enter');
 await saved();assert.equal(count(),1);assert.equal(writes().length,writesBefore+3);await manualButton();
 // The first write is committed by SQL but its response is lost: retry must be identical.
 reset();await open();let first=true;
 await page.route('**/api/forum-reception',async route=>{
  const body=route.request().postDataJSON();
  if(body.operation!=='scan'||body.command.action!=='enter'||!first)return route.fallback();
  first=false;const response=await route.fetch();assert.equal((await response.json()).status,'valid');
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({status:'unavailable'})});
 });
 const retryStart=writes().length;await manual();await btn('Riprova la stessa operazione').waitFor();
 assert.equal(count(),1);assert.equal(await btn('Cambia incarico').isDisabled(),true);await manualButton();
 await btn('Riprova la stessa operazione').click();await saved();
 const retryWrites=writes().slice(retryStart);assert.equal(retryWrites.length,2);assert.deepEqual(retryWrites[0].body,retryWrites[1].body);assert.equal(count(),1);
 await page.unroute('**/api/forum-reception');
 // Real QR decoding, original API and SQL: readable automatic result, delayed dismissal and latch.
 for(const width of [320,390,844]) {
  reset();await page.setViewportSize({width,height:width===844?390:844});await open(true);
  await page.evaluate(image=>{
   window.syntheticCameraCalls=0;
   navigator.mediaDevices.getUserMedia=async()=>{
    window.syntheticCameraCalls++;
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
    const img=new Image();img.src=image;await img.decode();canvas.getContext('2d').drawImage(img,0,0);
    const stream=canvas.captureStream(10),timer=setInterval(()=>canvas.getContext('2d').drawImage(img,0,0),100);
    for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}return stream;
   };
  },qrImage);
  const start=writes().length;await btn('Avvia fotocamera').click();await saved();assert.equal(await btn('Segna entrata').count(),0,'existing compact view hides the completed action');assert.equal(count(),1);
  assert.equal(await page.locator('video').evaluate(v=>v.srcObject.getVideoTracks()[0].readyState),'live');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.waitForTimeout(2200);
  assert.equal(await page.locator('[data-camera-result]').evaluate(el=>getComputedStyle(el).opacity),'1');
  assert.equal(await page.locator('[data-camera-result]').evaluate(el=>el.inert),false);
  await page.screenshot({path:`/tmp/pace-auto-entry-${width}.png`,fullPage:true});
  await page.locator('[data-camera-result]').waitFor({state:'detached'});await page.waitForTimeout(1200);
  assert.equal(writes().length,start+1);assert.equal(await page.locator('[data-camera-result]').count(),0);
  await btn('Ferma fotocamera').click();await btn('Avvia fotocamera').click();await page.waitForTimeout(500);
  assert.equal(writes().length,start+1);assert.equal(await page.locator('[data-camera-result]').count(),0);
 }
 console.log('PASS automatic Forum entry: manual/USB/real camera → original HTTP → SQL, one entry, counters, button preserved and usable from history, history/removal read-only, exact lost-response retry, 320/390/844px, readable result/delayed dismissal/latch/restart');
}
