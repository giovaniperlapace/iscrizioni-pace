// Original page and HTTP endpoints -> synthetic Auth/PostgREST -> disposable SQL.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
const fw=n=>createHash('md5').update('forum-queue-'+n).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
const lit=v=>v==null?'null':`'${String(v).replaceAll("'","''")}'`;
export async function checkForumReception(psql,base='http://127.0.0.1:3198') {
 let actor=8,browser;const calls=[],unexpected=[],errors=[];
 const qrToken='F'.repeat(43);
 const {default:QRCode}=await import('qrcode');
 const qrImage=await QRCode.toDataURL(qrToken,{width:640,margin:4});
 psql(`insert into qr_tokens(registration_id,token_hash) values(fw(107),${lit(createHash('sha256').update(qrToken).digest('hex'))});
 update panel_waitlist set status='cancelled' where status in ('waiting','offered');
 select set_reception_duties(fw(200),fw(11),fw(8),array[fw(403)::text,fw(404)::text,'opening'],app.reception_duty_keys(fw(200),fw(8)));
 insert into check_ins(event_id,registration_id,checked_in_by,source) values(fw(200),fw(107),fw(10),'manual');`);
 const functions=new Set(['has_panel_reception_duty','reception_duty_catalog','reception_target_statistics','reception_desk','reception_forum_routing','reception_panel_check_in','reception_ceremony_check_in','set_reception_duties']);
 const adapter=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');const url=new URL(req.url,'http://127.0.0.1');
  try {
   if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:fw(actor),email:`queue-${actor}@example.invalid`,aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}));return;}
   if(url.pathname==='/rest/v1/events'){res.end(JSON.stringify({id:fw(200),title:'Synthetic event'}));return;}
   if(url.pathname==='/rest/v1/group_memberships'){res.end('[]');return;}
   if(url.pathname==='/rest/v1/event_user_roles'){res.end(psql(`select coalesce(jsonb_agg(jsonb_build_object('role',role,'event_id',event_id)),'[]') from event_user_roles where user_id=${lit(fw(actor))};`,true).trim());return;}
   if(url.pathname==='/rest/v1/profiles'){
    const id=url.searchParams.get('id')?.slice(3);
    res.end(psql(`select jsonb_build_object('id',id,'email',email,'full_name',full_name) from profiles where id=${lit(id)};`,true).trim());return;
   }
   if(url.pathname==='/rest/v1/audit_logs' && req.method==='POST'){
    let raw='';for await(const part of req)raw+=part;const row=JSON.parse(raw);
    psql(`insert into audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata) values(${lit(row.event_id)},${lit(row.actor_user_id)},${lit(row.action)},${lit(row.entity_table)},${lit(row.entity_id)},${lit(JSON.stringify(row.metadata))}::jsonb);`);
    res.statusCode=201;res.end('');return;
   }
   if(url.pathname==='/rest/v1/panel_reception_assignments'){
    const panel=url.searchParams.get('panel_id')?.slice(3),duty=url.searchParams.get('duty')?.slice(3);
    res.end(psql(`select coalesce((select jsonb_build_object('id',id) from panel_reception_assignments where user_id=${lit(fw(actor))} and event_id=fw(200) and panel_id=${lit(panel)} and duty=${lit(duty)}),'null');`,true).trim());return;
   }
   const name=url.pathname.split('/').at(-1);
   if(url.pathname.startsWith('/rest/v1/rpc/')&&functions.has(name)){
    let raw='';for await(const part of req)raw+=part;const body=raw?JSON.parse(raw):{};calls.push({name,body});
    assert.ok(Object.keys(body).every(key=>/^p_[a-z_]+$/.test(key)));
    const args=Object.entries(body).map(([key,value])=>`${key} => ${Array.isArray(value)?`array[${value.map(lit).join(',')}]::${['p_keys','p_expected'].includes(key)?'text':'uuid'}[]`:lit(value)}`);
    const role=['has_panel_reception_duty','reception_duty_catalog'].includes(name)?'authenticated':'service_role';
    res.end(psql(`begin;set local role ${role};set local "request.jwt.claim.sub"=${lit(fw(actor))};select to_jsonb(${name}(${args.join(',')}));commit;`,true).trim());return;
   }
   unexpected.push(url.pathname);res.statusCode=500;res.end(JSON.stringify({code:'UNKNOWN',message:'Unexpected synthetic endpoint'}));
  } catch(error){console.error('Adapter rejection',url.pathname,error.stderr?.toString()??error.message);res.statusCode=403;res.end(JSON.stringify({code:'42501',message:'Synthetic rejection'}));}
 });
 try {
  await new Promise(resolve=>adapter.listen(55490,'127.0.0.1',resolve));
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const context=await browser.newContext({viewport:{width:1360,height:1000}});
  const jwt=[{alg:'HS256',typ:'JWT'},{sub:fw(actor),exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.synthetic';
  const session={access_token:jwt,refresh_token:'synthetic',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:fw(actor),email:'queue-8@example.invalid'}};
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:base},{name:'iscrizioni_last_activity',value:String(Date.now()),url:base}]);
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const crossOrigin=await context.request.post(base+'/api/forum-reception',{headers:{Origin:'https://untrusted.invalid'},data:{operation:'statistics',eventId:fw(200),target:fw(403)}});
  assert.equal(crossOrigin.status(),403);
  const otherEvent=await context.request.post(base+'/api/forum-reception',{headers:{Origin:base},data:{operation:'statistics',eventId:fw(201),target:fw(403)}});
  assert.equal(otherEvent.status(),403);
  actor=11;
  await page.goto(base+'/test-forum-roles');
  await page.getByRole('button',{name:'Modifica incarico',exact:true}).click();
  await page.getByLabel('Seleziona tutto',{exact:true}).check();
  await page.getByRole('button',{name:'Salva incarico',exact:true}).click();
  await page.getByText('Tutti gli incarichi',{exact:true}).waitFor();
  assert.equal(psql('select cardinality(app.reception_duty_keys(fw(200),fw(8)));',true).trim(),'8');
  assert.equal(psql('select count(*) from event_user_roles where user_id=fw(8);',true).trim(),'0');
  await page.screenshot({path:'/tmp/pace-forum-events-roles.png',fullPage:true});
  await page.getByRole('button',{name:'Modifica incarico',exact:true}).click();
  await page.getByLabel('Seleziona tutto',{exact:true}).uncheck();
  await page.getByLabel(/Morning A/).check();await page.getByLabel(/Morning B/).check();await page.getByLabel('Cerimonia d’apertura',{exact:true}).check();
  await page.getByRole('button',{name:'Salva incarico',exact:true}).click();
  await page.getByText('Ruolo assegnato. Gli altri incarichi sono stati conservati.',{exact:true}).waitFor();
  assert.equal(psql('select cardinality(app.reception_duty_keys(fw(200),fw(8)));',true).trim(),'3');
  actor=8;
  await page.goto(base+'/dashboard/accoglienza-forum-eventi');
  await page.getByRole('button',{name:/Computer ·/}).click();
  assert.equal(await page.locator('video').count(),0);
  await page.getByLabel('Cerca incarico').fill('Morning A');
  await page.getByRole('button',{name:/Morning A/}).click();
  const sectionOrder=await page.evaluate(()=>{
    const mode=document.querySelector('[aria-label="Postazione e incarico"]');
    const title=document.querySelector('#reception-title');
    const stats=document.querySelector('[aria-label="Statistiche dell’incarico"]');
    return Boolean(mode.compareDocumentPosition(title)&Node.DOCUMENT_POSITION_FOLLOWING) && Boolean(title.compareDocumentPosition(stats)&Node.DOCUMENT_POSITION_FOLLOWING);
  });
  assert.equal(sectionOrder,true);
  assert.equal(await page.getByLabel("Incarico attivo",{exact:true}).getByLabel("Statistiche dell’incarico",{exact:true}).count(),1);
  assert.match(await page.getByRole('button',{name:'Cambia modalità',exact:true}).getAttribute('class'),/btn-secondary/);
  await page.getByLabel('Codice partecipante',{exact:true}).fill('QQQ7');
  await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
  await page.getByText(/Non risulta una prenotazione valida/).waitFor();
  assert.equal(psql('select count(*) from check_ins where registration_id=fw(107) and moment_id is not null;',true).trim(),'0');
  await page.getByRole('button',{name:'Verifica disponibilità'}).click();
  await page.getByLabel('Posto da prenotare').selectOption(fw(503));
  await page.getByRole('button',{name:'Conferma prenotazione',exact:true}).click();
  await page.getByText(/Prenotazione registrata/).waitFor();
  assert.equal(psql('select count(*) from check_ins where registration_id=fw(107) and moment_id is not null;',true).trim(),'0');
  await page.getByLabel('Codice partecipante',{exact:true}).fill('QQQ7');await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
  await page.getByRole('button',{name:'Conferma ingresso',exact:true}).click();
  await page.getByText('✓ Ingresso confermato',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Rimuovi ingresso',exact:true}).click();
  await page.getByRole('heading',{name:'Rimuovi ingresso',exact:true}).waitFor();
  await page.getByText('Confermi la rimozione dell’ingresso per queste persone?',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Annulla',exact:true}).click();

  assert.equal(psql('select count(*) from check_ins where registration_id=fw(107) and moment_id=fw(403) and cancelled_at is null;',true).trim(),'1');
  await page.screenshot({path:'/tmp/pace-forum-events-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Cambia incarico'}).click();
  await page.getByRole('button',{name:/Morning B/}).click();
  await page.getByLabel('Codice partecipante',{exact:true}).fill('QQQ7');await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
  await page.getByText(/Non è prenotato per questo Forum.*Morning A.*Room 3/).waitFor();
  assert.equal(psql('select count(*) from check_ins where registration_id=fw(107) and moment_id=fw(404);',true).trim(),'0');
  await page.getByRole('button',{name:'Cambia modalità'}).click();
  await page.evaluate(image=>{
   window.syntheticCameraCalls=0;
   navigator.mediaDevices.getUserMedia=async()=>{
    window.syntheticCameraCalls++;
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
    const img=new Image();img.src=image;await img.decode();canvas.getContext('2d').drawImage(img,0,0);
    const stream=canvas.captureStream(10);
    const timer=setInterval(()=>canvas.getContext('2d').drawImage(img,0,0),100);
    for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}
    return stream;
   };
  },qrImage);
  assert.equal(await page.evaluate(()=>window.syntheticCameraCalls),0);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:/Telefono ·/}).click();
  assert.equal(await page.getByRole('heading',{name:'Prenota un posto',exact:true}).count(),0);
  await page.getByRole('button',{name:'Avvia fotocamera',exact:true}).click();
  await page.getByText(/Non è prenotato per questo Forum.*Morning A/).waitFor();
  assert.ok(await page.evaluate(()=>window.syntheticCameraCalls)>0);
  assert.ok(calls.some(call=>call.name==='reception_panel_check_in' && call.body.p_lookup_kind==='qr'));
  const overlay=page.locator('[data-camera-overlay]');
  await overlay.getByText('Attenzione: leggi il messaggio sotto.').waitFor();
  assert.equal(await overlay.locator('[data-reception-tone]').getAttribute('data-reception-tone'),'yellow');
  const cameraCard=page.locator('[data-camera-result]');
  // Correct duty: inspect does not stop the stream or implicitly check in.
  await page.getByRole('button',{name:'Cambia incarico'}).click();
  await page.getByRole('button',{name:/Morning A/}).click();
  psql("update check_ins set cancelled_at=now() where registration_id=fw(107) and moment_id=fw(403) and cancelled_at is null;");
  await page.getByRole('button',{name:'Aggiorna conteggi'}).click();
  const frameBefore=await page.getByLabel('Anteprima fotocamera').boundingBox();
  await page.getByRole('button',{name:'Avvia fotocamera',exact:true}).click();
  await cameraCard.getByText('✓ Iscrizione al Forum verificata.',{exact:true}).waitFor();
  const cameraCalls=await page.evaluate(()=>window.syntheticCameraCalls);
  const video=page.getByLabel('Anteprima fotocamera');
  assert.equal(await video.isVisible(),true);
  assert.equal(await video.evaluate(el=>el.srcObject.getVideoTracks()[0].readyState),'live');
  assert.equal(psql('select count(*) from check_ins where registration_id=fw(107) and moment_id=fw(403) and cancelled_at is null;',true).trim(),'0');
  const stats=page.getByRole('region',{name:'Statistiche dell’incarico'});
  const enteredBefore=Number((await stats.innerText()).match(/(\d+) Entrati/)[1]);
  const {videoBox,overlayBox,cardBox}=await page.evaluate(()=>({
    videoBox:document.querySelector('video').getBoundingClientRect().toJSON(),
    overlayBox:document.querySelector('[data-camera-overlay]').getBoundingClientRect().toJSON(),
    cardBox:document.querySelector('[data-camera-result]').getBoundingClientRect().toJSON(),
  }));
  assert.ok(overlayBox.y>=videoBox.y && overlayBox.y+overlayBox.height<=videoBox.y+videoBox.height);
  assert.ok(cardBox.y>=videoBox.y+videoBox.height);
  assert.ok(Math.abs(frameBefore.height-videoBox.height)<1);
  assert.ok(overlayBox.height<80);
  await page.screenshot({path:'/tmp/pace-forum-camera-compact.png',fullPage:true});
  await cameraCard.getByRole('button',{name:'Segna entrata',exact:true}).click();
  await cameraCard.getByText('✓ Ingresso confermato',{exact:true}).waitFor();
  await page.waitForFunction(expected=>document.querySelector('[aria-label="Statistiche dell’incarico"]').textContent.includes(expected+' Entrati'),enteredBefore+1);
  assert.equal(await video.evaluate(el=>el.srcObject.getVideoTracks()[0].readyState),'live');
  assert.equal(await page.evaluate(()=>window.syntheticCameraCalls),cameraCalls);
  assert.equal(await page.getByRole('button',{name:'Scansiona un altro QR',exact:true}).count(),0);
  await page.waitForFunction(()=>{
    const overlay=document.querySelector('[data-camera-overlay]');
    const opacity=Number(getComputedStyle(overlay).opacity);
    return opacity>0 && opacity<0.8;
  });
  await page.screenshot({path:'/tmp/pace-forum-camera-overlay.png',fullPage:true});
  await page.getByRole('heading',{name:'Synthetic 7 Queue',exact:true}).waitFor({state:'detached',timeout:4000});
  assert.equal(await video.evaluate(el=>el.srcObject.getVideoTracks()[0].readyState),'live');
  assert.equal(await page.evaluate(()=>window.syntheticCameraCalls),cameraCalls);
  // An unchanged QR in the stream must not reopen the dismissed card.
  await page.waitForTimeout(1200);
  assert.equal(await page.getByRole('heading',{name:'Synthetic 7 Queue',exact:true}).count(),0);

  await page.getByRole('button',{name:'Cambia incarico'}).click();
  await page.getByRole('button',{name:/Morning B/}).click();
  await page.getByRole('button',{name:'Inserisci il codice manualmente'}).click();
  await page.getByLabel('Codice partecipante',{exact:true}).fill('QQQ7');await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
  await page.getByText(/Non è prenotato per questo Forum.*Morning A/).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'/tmp/pace-forum-events-phone.png',fullPage:true});
  // Revoked duty cannot be used from a page that was already open.
  psql(`select set_reception_duties(fw(200),fw(11),fw(8),array[fw(403)::text,'opening'],app.reception_duty_keys(fw(200),fw(8)));`);
  await page.getByLabel('Codice partecipante',{exact:true}).fill('QQQ7');await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
  await page.getByText(/Sessione scaduta o incarico non più autorizzato/).waitFor();
  // Training uses the same workstation but must never call an operational API.
  const operational=[];
  await page.route('**/api/forum-reception',route=>{operational.push(route.request().url());return route.abort();});
  actor=12;
  const denied=await context.request.get(base+'/dashboard/accoglienza-forum-eventi/collaudo',{maxRedirects:0});
  assert.equal(denied.status(),307);
  actor=11;
  await page.setViewportSize({width:1360,height:1000});
  await page.goto(base+'/dashboard/accoglienza-forum-eventi/collaudo');
  await page.getByRole('heading',{name:'Prova accoglienza forum ed eventi'}).waitFor();
  await page.getByRole('button',{name:/Computer ·/}).click();
  await page.getByRole('button',{name:'Forum 1 · Prova Sala A fittizia'}).click();
  for (const [code,tone] of [['F002','yellow'],['F008','red'],['F003','orange']]) {
    await page.getByLabel('Codice partecipante',{exact:true}).fill(code);
    await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
    await page.locator(`[role="alert"][data-reception-tone="${tone}"]`).waitFor();
  }
  await page.getByLabel('Codice partecipante',{exact:true}).fill('F009');
  await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'accoglienza generale non registrata'}).waitFor();
  await page.getByRole('button',{name:'Segna l’ingresso comunque',exact:true}).click();
  await page.getByText('✓ Ingresso confermato',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Chiudi scheda',exact:true}).click();
  await page.getByLabel('Codice partecipante',{exact:true}).fill('F003');
  await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
  await page.getByText(/Non risulta una prenotazione valida/).waitFor();
  await page.getByRole('button',{name:'Verifica disponibilità'}).click();
  await page.getByLabel('Posto da prenotare').selectOption({label:'Posti individuali di prova · 15 disponibili'});
  await page.getByRole('button',{name:'Conferma prenotazione',exact:true}).click();
  await page.getByText(/Prenotazione registrata/).waitFor();
  await page.getByLabel('Codice partecipante',{exact:true}).fill('F003');
  await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
  await page.getByRole('button',{name:'Conferma ingresso',exact:true}).click();
  await page.getByText('✓ Ingresso confermato',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Cambia incarico'}).click();
  await page.getByRole('button',{name:/Cerimonia d’apertura · Prova/}).click();
  await page.getByLabel('Codice partecipante',{exact:true}).fill('F006');
  await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
  await page.getByText(/Settore Blu/).waitFor();
  await page.screenshot({path:'/tmp/pace-forum-demo-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Chiudi scheda',exact:true}).click();
  await page.getByLabel('Codice partecipante',{exact:true}).fill('F007');
  await page.getByRole('button',{name:'Leggi codice',exact:true}).click();
  const noTicket=page.getByRole('alert').filter({hasText:'nessun biglietto valido'});
  await noTicket.waitFor();
  assert.match(await noTicket.getAttribute('class'),/bg-orange-100/);
  assert.equal(await page.getByRole('button',{name:'Segna l’ingresso comunque',exact:true}).count(),0);

  await page.getByRole('button',{name:'Ricomincia la prova'}).click();
  await page.setViewportSize({width:390,height:844});
  const demoQr='data:image/png;base64,'+readFileSync('public/collaudo-forum-eventi/F001.png').toString('base64');
  await page.evaluate(image=>{
   navigator.mediaDevices.getUserMedia=async()=>{
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=640;
    const img=new Image();img.src=image;await img.decode();canvas.getContext('2d').drawImage(img,0,0);
    const stream=canvas.captureStream(10),timer=setInterval(()=>canvas.getContext('2d').drawImage(img,0,0),100);
    for(const track of stream.getTracks()){const stop=track.stop.bind(track);track.stop=()=>{clearInterval(timer);stop();};}
    return stream;
   };
  },demoQr);
  await page.getByRole('button',{name:/Telefono ·/}).click();
  assert.equal(await page.locator('video').count(),0);
  await page.getByRole('button',{name:'Forum 1 · Prova Sala A fittizia'}).click();
  await page.getByRole('button',{name:'Avvia fotocamera',exact:true}).click();
  await page.getByRole('heading',{name:'Anna Prova',exact:true}).waitFor();
  await page.getByRole('button',{name:'Segna entrata',exact:true}).click();
  await page.getByText('✓ Ingresso confermato',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'/tmp/pace-forum-demo-phone.png',fullPage:true});
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('link',{name:'Scarica il foglio QR'}).click();
  const download=await downloadPromise;
  assert.equal(download.suggestedFilename(),'qr-prova-forum-eventi.html');
  assert.equal((readFileSync(await download.path(),'utf8').match(/data:image\/png;base64/g)||[]).length,9);
  assert.deepEqual(operational,[]);
  const gallery=await context.newPage();
  await gallery.goto(base+'/collaudo-forum-eventi/qr.html');
  assert.equal(await gallery.locator('img').count(),9);
  await gallery.setViewportSize({width:1200,height:1000});
  await gallery.screenshot({path:'/tmp/pace-forum-demo-qr.png',fullPage:true});
  console.log('PASS training QR camera, same desktop/mobile controls, booking then entry, ceremony seat, reset, HTML download, access gate and zero operational API calls');
  assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  console.log('PASS original desktop/mobile page → HTTP → scoped SQL; booking distinct from presence, wrong Forum, counts, camera QR decode, switching, revocation, no overflow');
 } finally {await browser?.close();await new Promise(resolve=>adapter.close(resolve));}
}
