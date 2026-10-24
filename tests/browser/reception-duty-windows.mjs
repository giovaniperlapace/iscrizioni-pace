import assert from 'node:assert/strict';
export async function checkDutyWindows(browser,base) {
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'America/New_York'});
  const page=await context.newPage();
  const errors=[],calls=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/forum-reception',route=>{calls.push(route.request().url());return route.abort();});
  await page.clock.install({time:new Date('2026-10-26T12:29:59Z')});
  await page.clock.pauseAt(new Date('2026-10-26T12:29:59Z'));
  await page.goto(base+'/test-duty-windows');
  const computer=()=>page.getByRole('button',{name:/Computer ·/}).click();
  const scenario=async name=>{await page.getByLabel('Scenario di prova').selectOption(name);await computer();};
  await computer();
  await page.getByRole('button',{name:'Forum mattina Sala di prova',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Forum pomeriggio/}).count(),0);
  await page.getByLabel('Cerca incarico').fill('mattina');
  await page.clock.runFor(1000);
  await page.getByRole('button',{name:/Forum pomeriggio ore 17/}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Forum mattina/}).count(),0);
  assert.equal(await page.getByLabel('Cerca incarico').inputValue(),'');
  // New date: no Monday duties survive and the final ceremony replaces Tuesday morning.
  await scenario('tuesday');
  await page.getByRole('button',{name:/Forum martedì mattina/}).waitFor();
  await page.clock.runFor(1000);
  await page.getByRole('button',{name:/Cerimonia finale/}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Forum/}).count(),0);
  await scenario('sunday');
  await page.getByRole('button',{name:'Verifica iscrizione',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Inaugurazione/}).count(),0);
  await page.clock.runFor(1000);
  await page.getByRole('button',{name:/Inaugurazione/}).waitFor();
  await scenario('early');
  await page.getByRole('button',{name:'Verifica iscrizione',exact:true}).waitFor();
  // A suspended tab resumes after the boundary without having run its timer.
  await page.clock.setSystemTime(new Date(await page.evaluate(()=>Date.now())+1000));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  assert.equal(await page.getByRole('button',{name:/Forum mattina/}).count(),2);
  // An active station and its input survive the boundary; switching uses the new list.
  await scenario('monday');
  await page.getByRole('button',{name:'Forum mattina Sala di prova',exact:true}).click();
  await page.getByLabel('Codice partecipante',{exact:true}).fill('KEEP');
  await page.clock.runFor(1000);
  await page.getByText(/La fascia di questo incarico è terminata/).waitFor();
  assert.equal(await page.getByLabel('Codice partecipante',{exact:true}).inputValue(),'KEEP');
  await page.getByRole('button',{name:'Cambia incarico',exact:true}).click();
  await page.getByRole('button',{name:/Forum pomeriggio ore 17/}).waitFor();
  await scenario('ended');
  await page.getByRole('button',{name:'Verifica iscrizione',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:/Forum|Cerimonia|Inaugurazione/}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`/tmp/pace-duty-windows-${width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(calls,[]);
  await context.close();
 }
 console.log('PASS desktop/mobile timed chooser: 07:30, 13:30, Sunday 14:00, final ceremony, search reset, active input preserved, non-Rome device and no polling');
}
