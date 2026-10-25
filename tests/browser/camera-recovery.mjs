import assert from 'node:assert/strict';

export async function checkCameraRecovery(browser, base) {
 const page = await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 const btn=name=>page.getByRole('button',{name,exact:true});
 const calls=()=>page.locator('[data-calls]').evaluate(el=>JSON.parse(el.textContent));
 const scenario=value=>page.getByLabel('Scenario test',{exact:true}).selectOption(value);
 const open=async(duty,mode)=>{
  await page.goto(base+'/test-camera-recovery');
  await page.getByLabel('Incarico test',{exact:true}).selectOption(duty);
  await scenario(mode);await btn('Avvia fotocamera').click();await btn('QR A').click();
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-calls]').textContent).length===1);
 };
 const suspend=async kind=>{
  if(kind==='button')await btn('Ferma fotocamera').click();
  else if(kind==='ended')await btn('Interrompi dispositivo').click();
  else await page.evaluate(kind=>{
   if(kind==='hidden') {Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));}
   else window.dispatchEvent(new Event('pagehide'));
  },kind);
  await btn('Avvia fotocamera').waitFor();
  if(kind==='hidden')await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 };
 const restart=async kind=>{
  const starts=Number(await page.locator('[data-starts]').textContent());
  await suspend(kind);
  assert.equal(await btn('Avvia fotocamera').isEnabled(),true,`restart allowed after ${kind}`);
  await btn('Avvia fotocamera').click();
  await page.waitForFunction(expected=>Number(document.querySelector('[data-starts]').textContent)===expected,starts+1);
 };
 try {
  // Every passive outcome must recover for every way a phone stops its camera.
  for(const [duty,modes] of [
   ['ceremony_entry',['missing-ticket','invalid','normal','entered','family']],
   ['panel_entry',['invalid','not-booked','wrong-forum','missing-event','normal','entered','family']],
   ['registration_check',['normal','invalid']],['event_entry',['normal']],
  ])for(const mode of modes){
   await open(duty,mode);
   if(mode==='family')await page.locator('input[name=receptionSubjects]').last().check();
   for(const kind of ['button','hidden','pagehide','ended']){
    await restart(kind);
    await page.waitForTimeout(150);
    assert.equal((await calls()).length,1,`${duty}/${mode}: restart preserves latch and never writes`);
    if(mode==='family')assert.equal(await page.locator('input[name=receptionSubjects]:checked').count(),1,'explicit child selection preserved');
   }
   // A retired camera cannot replace the card with a late decoder callback.
   await btn('Callback obsoleta').click();await page.waitForTimeout(150);
   assert.equal((await calls()).length,1,'stale source ignored');
   await scenario('normal');await btn('QR B').click();
   await page.getByRole('heading',{name:'Bruno Prova',exact:true}).waitFor();
   assert.equal((await calls()).length,2);
   assert.ok((await calls()).every(call=>call.action==='inspect'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  console.log('PASS camera restart: passive ceremony/Forum/verification/event outcomes × stop, hidden, pagehide, device end; latch, late callbacks, next QR, no writes');

  // A real lock still protects pending/uncertain reads and expired authorization.
  for(const mode of ['pending','uncertain','blocked']){
   await open('panel_entry',mode);
   await restart('hidden');await btn('QR B').click();await page.waitForTimeout(250);
   assert.equal((await calls()).length,1,mode+' cannot be replaced');
   if(mode==='pending'){await scenario('normal');await btn('Completa richiesta').click();}
   if(mode==='uncertain'){await scenario('normal');await btn('Riprova la stessa operazione').click();}
   if(mode!=='blocked')await page.getByRole('heading',{name:'Bruno Prova',exact:true}).waitFor();
   else await page.getByRole('link',{name:'Torna all’accesso'}).waitFor();
  }
  // Selection/correction survives backgrounding; no QR bypasses the dialog.
  await open('panel_entry','school');await btn('Registra ingressi').click();
  await page.locator('dialog[open]').waitFor();
  await suspend('hidden');
  assert.equal(await btn('Avvia fotocamera').isEnabled(),true);
  assert.equal((await calls()).length,1);assert.equal(await page.locator('dialog[open]').count(),1);
  await page.keyboard.press('Escape');await scenario('normal');await btn('QR B').click();await btn('Avvia fotocamera').click();
  await page.getByRole('heading',{name:'Bruno Prova',exact:true}).waitFor();

  await open('panel_entry','entered');await btn('Rimuovi ingresso').click();
  await page.locator('dialog[open]').waitFor();await suspend('pagehide');
  assert.equal(await btn('Avvia fotocamera').isEnabled(),true);
  assert.equal((await calls()).filter(call=>call.action==='cancel').length,0);
  await page.keyboard.press('Escape');await scenario('normal');await btn('QR B').click();await btn('Avvia fotocamera').click();
  await page.getByRole('heading',{name:'Bruno Prova',exact:true}).waitFor();

  for(const mode of ['pending-write','uncertain-write','conflict','capacity']){
   await open('panel_entry',mode);await btn('Segna entrata').click();
   await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-calls]').textContent).length===2);
   await restart('hidden');await btn('QR B').click();await page.waitForTimeout(250);
   if(mode==='pending-write'||mode==='uncertain-write'){
    assert.equal((await calls()).length,2,'in-flight/uncertain write preserved');
    await scenario('normal');
    if(mode==='pending-write')await btn('Completa richiesta').click();
    else await btn('Riprova la stessa operazione').click();
    await page.getByRole('heading',{name:'Bruno Prova',exact:true}).waitFor();
    const writes=(await calls()).filter(call=>call.action==='enter');
    assert.equal(writes.length,mode==='uncertain-write'?2:1);
    if(writes.length===2)assert.deepEqual(writes[0],writes[1],'same idempotent retry');
   }else{
    await page.getByRole('heading',{name:'Bruno Prova',exact:true}).waitFor();
    assert.equal((await calls()).filter(call=>call.action==='enter').length,1);
   }
  }
  console.log('PASS pending/uncertain reads and writes, same-request retry, authorization block, school selection, conflict and full Forum recovery');
  await page.setViewportSize({width:1360,height:1000});
  await open('ceremony_entry','missing-ticket');await restart('button');
  await scenario('denied');await suspend('button');await btn('Avvia fotocamera').click();
  await page.getByRole('alert').filter({hasText:'Fotocamera non autorizzata'}).waitFor();
  await scenario('normal');await btn('Avvia fotocamera').click();await btn('QR B').click();
  await page.getByRole('heading',{name:'Bruno Prova',exact:true}).waitFor();
  await page.screenshot({path:'/tmp/pace-camera-recovery-desktop.png',fullPage:true});
  assert.deepEqual(errors,[]);
 }finally{await page.close();}
}
