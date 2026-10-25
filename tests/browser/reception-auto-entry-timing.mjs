import assert from 'node:assert/strict';

export async function checkAutomaticEntryTiming(browser,base) {
 const errors=[];
 const open=async({device='phone',mode='normal',width=390}={})=>{
  const page=await browser.newPage({viewport:{width,height:844}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/test-camera-recovery');
  await page.getByLabel('Incarico test',{exact:true}).selectOption('panel_entry');
  await page.getByLabel('Postazione test',{exact:true}).selectOption(device);
  await page.getByLabel('Scenario test',{exact:true}).selectOption(mode);
  await page.clock.install({time:new Date('2026-10-25T12:00:00Z')});
  await page.clock.pauseAt(new Date('2026-10-25T12:00:01Z'));
  const btn=name=>page.getByRole('button',{name,exact:true});
  const advance=ms=>page.clock.runFor(ms);
  const scan=async(letter)=>{
   if(device==='phone'){await btn('QR '+letter.toUpperCase()).click();await advance(100);}
   else {await page.getByLabel('Scanner USB',{exact:true}).focus();await page.keyboard.type(letter.repeat(43),{delay:1});await page.keyboard.press('Enter');}
  };
  if(device==='phone')await btn('Avvia fotocamera').click();
  else await btn('Scanner USB').click();
  const heading=name=>page.getByRole('heading',{name:name+' Prova',exact:true});
  const calls=()=>page.locator('[data-calls]').evaluate(el=>JSON.parse(el.textContent));
  const saved=()=>page.getByText('✓ Ingresso confermato',{exact:true}).waitFor();
  return {page,btn,advance,scan,heading,calls,saved};
 };
 // The confirmed card remains fully readable; the QR still in frame never repeats.
 for(const device of ['phone','computer'])for(const width of device==='phone'?[320,390,844]:[1360]){
  const t=await open({device,width});try{
   await t.scan('a');await t.saved();await t.advance(9000);
   assert.equal(await t.heading('Anna').isVisible(),true,'card remains for more than nine seconds');
   assert.equal(await t.heading('Anna').locator('..').evaluate(el=>getComputedStyle(el).opacity),'1');
   assert.equal(await t.heading('Anna').locator('..').evaluate(el=>el.inert),false);
   assert.equal(await t.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await t.page.screenshot({path:`/tmp/pace-auto-entry-ten-seconds-${device}-${width}.png`,fullPage:true});
   await t.advance(1100);assert.equal(await t.heading('Anna').count(),0);
   await t.advance(2000);assert.equal((await t.calls()).length,2,'same frame remains latched after dismissal');
  }finally{await t.page.close();}
 }
 // A different QR replaces the card immediately; A's timer cannot close B.
 for(const device of ['phone','computer']){
  const t=await open({device});try{
   await t.scan('a');await t.saved();await t.advance(9000);
   await t.scan('b');await t.heading('Bruno').waitFor();await t.saved();
   assert.equal(await t.heading('Anna').count(),0);assert.equal((await t.calls()).length,4);
   await t.advance(1500);assert.equal(await t.heading('Bruno').isVisible(),true,'old timeout cannot clear new QR');
   await t.advance(7500);assert.equal(await t.heading('Bruno').isVisible(),true);
   await t.advance(1100);assert.equal(await t.heading('Bruno').count(),0);
  }finally{await t.page.close();}
 }
 // The old timeout cannot discard an error, uncertain result or pending operation.
 for(const mode of ['pending-write','uncertain-write','invalid','family']){
  const t=await open();try{
   await t.scan('a');await t.saved();await t.advance(9000);
   await t.page.getByLabel('Scenario test',{exact:true}).selectOption(mode);await t.scan('b');
   if(mode==='uncertain-write')await t.btn('Riprova la stessa operazione').waitFor();
   else if(mode==='invalid')await t.page.getByRole('alert').filter({hasText:'Codice non valido'}).waitFor();
   else await t.heading('Bruno').waitFor();
   await t.advance(5000);
   if(mode==='invalid')assert.equal(await t.page.getByRole('alert').filter({hasText:'Codice non valido'}).count(),1);
   else assert.equal(await t.heading('Bruno').isVisible(),true);
   if(mode==='pending-write'||mode==='uncertain-write'){
    await t.page.getByLabel('Scenario test',{exact:true}).selectOption('normal');
    if(mode==='pending-write')await t.btn('Completa richiesta').click();else await t.btn('Riprova la stessa operazione').click();
    await t.saved();await t.advance(9000);assert.equal(await t.heading('Bruno').isVisible(),true);
    await t.advance(1100);assert.equal(await t.heading('Bruno').count(),0);
   }
  }finally{await t.page.close();}
 }
 const t=await open();try{
  await t.scan('a');await t.saved();await t.advance(9000);
  await t.btn('Rimuovi ingresso').click();await t.page.getByRole('dialog').waitFor();
  await t.advance(5000);assert.equal(await t.page.getByRole('dialog').count(),1);
  await t.page.keyboard.press('Escape');await t.advance(10000);
  assert.equal(await t.heading('Anna').isVisible(),true,'correction inspection cancels automatic dismissal');
  assert.equal((await t.calls()).filter(c=>c.action==='cancel').length,0);
 }finally{await t.page.close();}
 assert.deepEqual(errors,[]);
 console.log('PASS 10-second readable cards, immediate next QR on camera/USB, fresh timer per result, no stale timeout on pending/error/family/correction, exact retry, latch, 320/390/844/1360px');
}
