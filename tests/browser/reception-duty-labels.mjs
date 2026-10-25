import assert from 'node:assert/strict';
export async function checkReceptionDutyLabels(browser,base) {
 const labels=[1,3,9,10,18,19].map(number=>`Collegata F${number} · Il titolo completo del Forum trasmesso in collegamento dalla sala principale`);
 for(const width of [320,360,390,844]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:true,hasTouch:true});
  try {
   const page=await context.newPage();const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/forum-reception',()=>{throw Error('Fixture must not request live data');});
   await page.goto(base+'/test-duty-labels');
   await page.waitForLoadState('networkidle');
   for(const label of [...labels,'Forum principale con un titolo molto lungo che non deve nascondere i dati degli ingressi','Cerimonia di apertura con titolo esteso']){
    await page.getByRole('button',{name:new RegExp('^'+label)}).click();
    await page.getByRole('region',{name:'Statistiche dell’incarico'}).getByText('156',{exact:true}).waitFor();
    const title=page.locator('[data-camera-header] h2');assert.equal(await title.innerText(),label);
    const boxes=await page.locator('[data-camera-header]').evaluate(header=>{
     const bounds=header.getBoundingClientRect();
     const inside=el=>{const r=el.getBoundingClientRect();return r.top>=bounds.top && r.bottom<=bounds.bottom+1 && r.left>=bounds.left && r.right<=bounds.right+1;};
     const heading=header.querySelector('h2');
     return {height:bounds.height,scrollHeight:header.scrollHeight,clientHeight:header.clientHeight,
      visible:[...header.querySelectorAll('h2,p,button')].every(inside),
      titleUncut:heading.scrollWidth<=heading.clientWidth,
      horizontal:document.documentElement.scrollWidth<=innerWidth,
      footer:document.querySelector('[data-camera-footer]').getBoundingClientRect().height};
    });
    assert.equal(boxes.visible,true,`${width}: ${label} must keep every counter/button inside header`);
    assert.equal(boxes.scrollHeight,boxes.clientHeight,`${width}: no hidden scrolling for data`);
    assert.equal(boxes.height,boxes.footer);assert.equal(boxes.height,80);assert.equal(boxes.horizontal,true);
    assert.equal(await title.getAttribute("title"),label);
    const stats=page.getByRole('region',{name:'Statistiche dell’incarico'});
    if(labels.includes(label)){assert.match(await stats.innerText(),/\d+ entrati \/\s*156 prenotazioni/);assert.doesNotMatch(await stats.innerText(),/Iscritti/);}
    const before=await stats.innerText();
    await stats.getByRole('button',{name:'Aggiorna conteggi',exact:true}).click();
    await page.waitForFunction(old=>document.querySelector('[aria-label="Statistiche dell’incarico"]').innerText!==old,before);
    if(width===320 && [labels[0],labels[4]].includes(label))await page.screenshot({path:`/tmp/pace-short-${label.includes('Domus')?'domus':'serafico'}.png`,fullPage:true});
    // Manual view keeps the same compact internal name and both counters.
    await page.getByRole('button',{name:'Inserisci il codice manualmente',exact:true}).click();
    await page.getByRole('heading',{name:label,exact:true}).waitFor();
    await page.getByRole('button',{name:'Cambia incarico',exact:true}).click();
    await page.getByRole('heading',{name:'Scegli l’incarico',exact:true}).waitFor();
   }
   assert.deepEqual(errors,[]);
  } finally {await context.close();}
 }
 console.log('PASS six short relay labels plus long main/ceremony titles: 320/360/390/844px, source Forum titles, visible counters/refresh, symmetric 80px bands, manual and duty changes');
}
