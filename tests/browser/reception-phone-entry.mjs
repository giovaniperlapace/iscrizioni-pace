import assert from 'node:assert/strict';

export async function checkPhoneEntry({browser,context,base,errors}) {
 const devices=[
  ['iphone','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'],
  ['android','Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'],
 ];
 for(const [name,userAgent] of devices) {
  const mobile=await browser.newContext({userAgent,isMobile:true,hasTouch:true,viewport:{width:390,height:844}});
  try {
   await mobile.addCookies(await context.cookies());
   const page=await mobile.newPage();
   page.setDefaultTimeout(15_000);
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   await page.goto(base+'/dashboard/accoglienza-forum-eventi');
   await page.getByRole('heading',{name:'Scegli l’incarico',exact:true}).waitFor();
   assert.equal(await page.getByRole('heading',{name:'Scegli la postazione',exact:true}).count(),0);
   assert.equal(await page.getByLabel('Cerca incarico').count(),0);
   assert.equal(await page.getByRole('link',{name:'Prova con QR fittizi',exact:true}).count(),0);
   assert.equal(await page.locator('video').count(),0);
   assert.equal(await page.getByRole('heading',{name:'Scegli l’incarico',exact:true}).locator('..').getByRole('button').first().innerText(),'Verifica iscrizione');
   await page.screenshot({path:`/tmp/pace-reception-${name}-duties.png`,fullPage:true});
   await page.getByRole('button',{name:'Verifica iscrizione',exact:true}).click();
   await page.getByRole('button',{name:'Avvia fotocamera',exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:/Cambia modalità|Cambia postazione|Computer ·|Telefono ·/}).count(),0);
   await page.getByRole('button',{name:'Inserisci il codice manualmente',exact:true}).click();
   await page.getByLabel('Codice partecipante',{exact:true}).fill('QQQ7');
   await page.setViewportSize({width:844,height:390});
   assert.equal(await page.getByLabel('Codice partecipante',{exact:true}).inputValue(),'QQQ7');
   await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
   await page.locator('[data-registration-check][data-reception-tone="green"]').waitFor();
   await page.getByRole('heading',{name:'Synthetic 7 Queue',exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:/Conferma ingresso|Rimuovi|Segna|Modifica presenze/}).count(),0);
   await page.getByRole('button',{name:'Cambia incarico',exact:true}).click();
   await page.getByRole('heading',{name:'Scegli l’incarico',exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'Cambia postazione',exact:true}).count(),0);
   await page.getByRole('button',{name:/Morning A/}).click();
   await page.getByRole('button',{name:'Avvia fotocamera',exact:true}).waitFor();
   assert.equal(await page.getByRole('heading',{name:'Prenota un posto',exact:true}).count(),0);
   await page.setViewportSize({width:390,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:`/tmp/pace-reception-${name}-scanner.png`,fullPage:true});
   const retired=await mobile.request.get(base+'/dashboard/accoglienza-forum-eventi/collaudo',{maxRedirects:0});
   assert.equal(retired.status(),307);
   assert.equal(retired.headers().location,'/dashboard/accoglienza-forum-eventi');
  } finally {
   for(const page of mobile.pages()) await page.unrouteAll({behavior:'ignoreErrors'});
   await mobile.close();
  }
 }
 console.log('PASS iPhone/Android server entry: direct duty list, no search/demo/mode switch, verification first/read-only/manual fallback, rotation preserves state, change duty, retired URL redirect');
}
