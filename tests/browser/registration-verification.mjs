import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import QRCode from 'qrcode';
const hash=value=>createHash('sha256').update(value).digest('hex');
export async function checkRegistrationVerification({page,context,base,psql,calls,setActor}) {
 const green='F'.repeat(43),yellow='Y'.repeat(43),red='X'.repeat(43);
 psql(`insert into qr_tokens(registration_id,token_hash) values(fw(108),'${hash(yellow)}');`);
 const snapshot=()=>psql(`select jsonb_build_array(
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) from check_ins t),
 (select md5(coalesce(jsonb_agg(to_jsonb(t) order by request_id)::text,'')) from check_in_requests t),
 (select count(*) from audit_logs));`,true).trim();
 const before=snapshot(),start=calls.length;
 const eventId=psql('select fw(200);',true).trim();
 const command={duty:'registration_check',action:'inspect',lookup:{kind:'qr',value:green}};
 for(const action of ['enter','cancel','correct']) {
  const response=await context.request.post(base+'/api/forum-reception',{headers:{Origin:base},data:{eventId,operation:'scan',command:{...command,action}}});
  assert.equal(response.status(),400);assert.equal((await response.json()).status,'invalid_request');
 }
 setActor(12);
 const denied=await context.request.post(base+'/api/forum-reception',{headers:{Origin:base},data:{eventId,operation:'scan',command}});
 assert.equal((await denied.json()).status,'forbidden');setActor(8);
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/dashboard/accoglienza-forum-eventi');
 await page.getByRole('button',{name:/Computer ·/}).click();
 assert.equal(await page.getByRole('heading',{name:'Scegli l’incarico',exact:true}).locator('..').getByRole('button').first().innerText(),'Verifica iscrizione');
 await page.getByRole('button',{name:'Verifica iscrizione',exact:true}).click();
 assert.equal(await page.getByRole('heading',{name:'Prenota un posto',exact:true}).count(),0);
 await page.getByLabel('Codice partecipante',{exact:true}).fill('QQQ7');
 await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
 await page.locator('[data-registration-check][data-reception-tone="green"]').waitFor();
 await page.getByRole('heading',{name:'Synthetic 7 Queue',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:/Conferma ingresso|Rimuovi|Segna|Modifica presenze/}).count(),0);
 await page.screenshot({path:'/tmp/pace-registration-verification-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Chiudi scheda',exact:true}).click();
 await page.getByRole('button',{name:'Scanner USB',exact:true}).click();
 await page.getByLabel('Scanner USB',{exact:true}).focus();await page.keyboard.type(yellow,{delay:1});await page.keyboard.press('Enter');
 await page.locator('[data-registration-check][data-reception-tone="yellow"]').waitFor();
 await page.getByRole('heading',{name:'Synthetic 8 Queue',exact:true}).waitFor();
 await page.keyboard.type(red,{delay:1});await page.keyboard.press('Enter');
 await page.locator('[role="alert"][data-reception-tone="red"]').waitFor();
 assert.equal(await page.getByRole('heading',{name:'Synthetic 8 Queue',exact:true}).count(),0);
 await page.getByRole('button',{name:'Cambia modalità',exact:true}).click();
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:/Telefono ·/}).click();
 const images=await Promise.all([green,yellow,red].map(token=>QRCode.toDataURL(token,{width:640,margin:4})));
 await page.evaluate(async images=>{
  const decoded=await Promise.all(images.map(async src=>{const img=new Image();img.src=src;await img.decode();return img;}));
  window.verificationFrame=0;window.verificationStreams=0;
  navigator.mediaDevices.getUserMedia=async()=>{
   window.verificationStreams++;
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;const ctx=canvas.getContext('2d');
   const draw=()=>{ctx.fillStyle='white';ctx.fillRect(0,0,640,640);if(window.verificationFrame>=0)ctx.drawImage(decoded[window.verificationFrame],0,0);};
   draw();const stream=canvas.captureStream(10),timer=setInterval(draw,100);
   for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}
   return stream;
  };
 },images);
 await page.getByRole('button',{name:'Avvia fotocamera',exact:true}).click();
 await page.locator('[data-registration-check][data-reception-tone="green"]').waitFor();
 const greenReads=calls.filter(c=>c.name==='reception_registration_check'&&c.body.p_value===hash(green)).length;
 await page.waitForTimeout(1100);
 assert.equal(calls.filter(c=>c.name==='reception_registration_check'&&c.body.p_value===hash(green)).length,greenReads);
 await page.evaluate(()=>{window.verificationFrame=1;});
 await page.locator('[data-registration-check][data-reception-tone="yellow"]').waitFor();
 await page.waitForTimeout(400);
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 await page.screenshot({path:'/tmp/pace-registration-verification-mobile.png',fullPage:true});
 const header=page.locator('[data-camera-header]'),footer=page.locator('[data-camera-footer]');
 assert.equal(await header.evaluate(el=>el.scrollHeight<=el.clientHeight),true);
 assert.equal((await header.boundingBox()).height,(await footer.boundingBox()).height);
 assert.equal(await page.locator('[data-scanner-frame="peace"]').count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.evaluate(()=>{window.verificationFrame=2;});
 await page.locator('[role="alert"][data-reception-tone="red"]').waitFor();
 assert.equal(await page.getByRole('heading',{name:'Synthetic 8 Queue',exact:true}).count(),0);
 assert.equal(await page.evaluate(()=>window.verificationStreams),1);
 // A different valid QR immediately replaces an error without interaction.
 await page.evaluate(()=>{window.verificationFrame=0;});
 await page.locator('[data-registration-check][data-reception-tone="green"]').waitFor();
 assert.equal(snapshot(),before);
 assert.ok(calls.slice(start).every(c=>['has_panel_reception_duty','reception_duty_catalog','reception_registration_check'].includes(c.name)));
 console.log('PASS verification desktop/manual/USB/mobile camera: green/yellow/red, names, no writes or write controls, same-QR latch, consecutive QR, role denial, fixed branded frame');
}
