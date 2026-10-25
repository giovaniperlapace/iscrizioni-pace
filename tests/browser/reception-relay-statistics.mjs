import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export async function checkRelayStatistics({page,context,base,psql,calls,qrImage}) {
 psql('begin;'+readFileSync('tests/sql/reception-relay-seed.sql','utf8')+`select reception_desk(fw(200),fw(8),fw(403)::text,'code','QQQ7','book',fw(503),'{}',fw(9980));commit;`);
 const panel=page.getByRole('region',{name:'Disponibilità sale collegate'});
 const refresh=page.getByRole('button',{name:'Aggiorna conteggi',exact:true});
 const assertOrder=async()=>assert.equal(await page.evaluate(()=>{
  const relay=document.querySelector('[aria-label="Disponibilità sale collegate"]');
  const action=[...document.querySelectorAll('button')].find(b=>/Conferma ingresso|Segna entrata/.test(b.textContent));
  const recent=[...document.querySelectorAll('summary')].find(b=>b.textContent.includes('Ultime letture'));
  return !!action && !!relay && !!recent && !!(action.compareDocumentPosition(relay)&Node.DOCUMENT_POSITION_FOLLOWING) && !!(relay.compareDocumentPosition(recent)&Node.DOCUMENT_POSITION_FOLLOWING);
 }),true);
 await page.goto(base+'/dashboard/accoglienza-forum-eventi');
 await page.getByRole('button',{name:/Computer ·/}).click();
 await page.getByRole('button',{name:/^Morning A/}).click();
 await panel.getByText('5',{exact:true}).waitFor();
 await panel.getByText('7 entrati / 5 prenotazioni',{exact:true}).waitFor();
 const primary=await page.getByRole('region',{name:'Statistiche dell’incarico'}).innerText();
 await page.getByLabel('Codice partecipante',{exact:true}).fill('QQQ7');
 await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
 await page.getByRole('button',{name:'Conferma ingresso',exact:true}).waitFor();
 await assertOrder();
 await page.screenshot({path:'/tmp/pace-relay-desktop.png',fullPage:true});
 psql('update check_ins set student_count=9 where school_booking_id=fw(9975);');
 await refresh.click();await panel.getByText('0',{exact:true}).waitFor();
 await panel.getByText('Capienza raggiunta',{exact:true}).waitFor();
 await panel.getByText('12 entrati / 5 prenotazioni',{exact:true}).waitFor();
 assert.equal(await page.getByRole('region',{name:'Statistiche dell’incarico'}).innerText(),primary);
 await assertOrder();
 // Secondary RPC fails; the source statistics and selected person stay usable.
 psql('revoke execute on function reception_relay_room_statistics(uuid,uuid,uuid) from service_role;');
 await refresh.click();await panel.getByRole('alert').waitFor();
 assert.equal(await panel.getByText('0',{exact:true}).count(),0);
 assert.equal(await page.getByRole('region',{name:'Statistiche dell’incarico'}).innerText(),primary);
 await assertOrder();
 psql('grant execute on function reception_relay_room_statistics(uuid,uuid,uuid) to service_role;update check_ins set student_count=4 where school_booking_id=fw(9975);');
 await refresh.click();await panel.getByText('5',{exact:true}).waitFor();
 // Save automatically refreshes both summaries without merging their counts.
 const before=calls.filter(x=>x.name==='reception_relay_room_statistics').length;
 await page.getByRole('button',{name:'Conferma ingresso',exact:true}).click();
 await page.getByText('✓ Ingresso confermato',{exact:true}).waitFor();
 await panel.getByText('5',{exact:true}).waitFor();
 assert.ok(calls.filter(x=>x.name==='reception_relay_room_statistics').length>before);
 await page.getByRole('button',{name:'Cambia incarico',exact:true}).click();
 await page.getByRole('button',{name:/^Morning B/}).click();
 await page.getByRole('region',{name:'Statistiche dell’incarico'}).getByText(/Iscritti/).waitFor();
 assert.equal(await panel.count(),0);
 await page.getByRole('button',{name:'Cambia incarico',exact:true}).click();
 await page.getByRole('button',{name:/^Collegamento Morning A/}).click();
 await page.getByRole('region',{name:'Statistiche dell’incarico'}).getByText(/Iscritti/).waitFor();
 assert.equal(await panel.count(),0);
 // Phone camera reads a real generated QR through the original decoder and API.
 await page.goto(base+'/dashboard/accoglienza-forum-eventi');
 await page.evaluate(image=>{
  window.syntheticCameraCalls=0;
  navigator.mediaDevices.getUserMedia=async()=>{
   window.syntheticCameraCalls++;
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
   const img=new Image();img.src=image;await img.decode();
   canvas.getContext('2d').drawImage(img,0,0);const stream=canvas.captureStream(10);
   const timer=setInterval(()=>canvas.getContext('2d').drawImage(img,0,0),100);
   for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}
   return stream;
  };
 },qrImage);
 psql('update check_ins set cancelled_at=now() where registration_id=fw(107) and moment_id=fw(403) and cancelled_at is null;');
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:/Telefono ·/}).click();
 await page.getByRole('button',{name:/^Morning A/}).click();
 await page.getByRole('button',{name:'Avvia fotocamera',exact:true}).click();
 await page.getByRole('button',{name:'Segna entrata',exact:true}).waitFor();
 await panel.getByText('5',{exact:true}).waitFor();
 await assertOrder();
 const cameraCalls=await page.evaluate(()=>window.syntheticCameraCalls);
 await refresh.click();await panel.getByText('5',{exact:true}).waitFor();
 await assertOrder();
 assert.equal(await page.evaluate(()=>window.syntheticCameraCalls),cameraCalls);
 assert.equal(await page.locator('video').evaluate(el=>el.srcObject.getVideoTracks()[0].readyState),'live');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/pace-relay-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Ferma fotocamera',exact:true}).click();
 await page.getByRole('button',{name:'Avvia fotocamera',exact:true}).click();
 await assertOrder();
 // Browser HTTP scope guards, no remote identities or operative data.
 for(const data of [{operation:'statistics',eventId:'00000000-0000-4000-8000-000000000000',target:'opening'}]){
  assert.equal((await context.request.post(base+'/api/forum-reception',{headers:{Origin:base},data})).status(),403);
 }
 console.log('PASS relay UI below full result/actions, desktop/mobile camera → original API → SQL, independent source counts, full/error/retry, automatic refresh and camera restart');
}
