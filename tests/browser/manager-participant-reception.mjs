// Synthetic manager table -> original participant Server Actions -> local PostgreSQL.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { encryptQrToken } from '../../lib/qrcode/secure-token.ts';
import { registrationQrPreview } from '../../lib/qrcode/registration-qr.ts';
const f=n=>createHash('md5').update(String(n)).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
const literal=v=>v==null?'null':`'${String(v).replaceAll("'","''")}'`;
export async function checkManagerParticipantReception(psql,base='http://127.0.0.1:3194') {
 assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
 let actor=31,browser;const calls=[];
 const token='m'.repeat(43),encrypted=encryptQrToken(token);
 psql(`insert into participants(id,first_name,last_name,public_code) values(f(99502),'Ada','Mori','MP01');insert into registrations(id,event_id,participant_id,status) values(f(99501),f(1),f(99502),'confirmed');insert into qr_tokens(registration_id,token_hash,token_encrypted) values(f(99501),${literal(createHash('sha256').update(token).digest('hex'))},${literal(encrypted)});`);
 const preview=await registrationQrPreview({status:'active',expires_at:null,token_encrypted:encrypted},{first_name:'Ada',last_name:'Mori',public_code:'MP01'});
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:f(actor),email:'manager@example.invalid',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}));return;}
  if(url.pathname==='/rest/v1/event_user_roles'){assert.equal(url.searchParams.get('user_id'),`eq.${f(actor)}`);res.end(psql(`select coalesce(jsonb_agg(jsonb_build_object('role',role,'event_id',event_id)),'[]') from event_user_roles where user_id=${literal(f(actor))};`).trim());return;}
  if(url.pathname==='/rest/v1/events'){res.end(JSON.stringify({id:f(1),starts_on:'2026-10-25',ends_on:'2026-10-27'}));return;}
  if(url.pathname==='/rest/v1/registrations'){res.end(JSON.stringify({event_id:f(1),deleted_at:null}));return;}
  if(url.pathname==='/rest/v1/event_attendance_choices'){res.end('[]');return;}
  if(url.pathname==='/rest/v1/group_memberships'){res.end('[]');return;}
  if(url.pathname==='/rest/v1/rpc/has_panel_reception_duty'){res.end('false');return;}
  const name=url.pathname.split('/').at(-1);
  const allowed={get_operational_demographics:['p_registration_id','p_actor_user_id'],get_operational_association:['p_registration_id','p_actor_user_id'],get_operational_accessibility:['p_registration_id','p_actor_user_id'],participant_reception_check_in:['p_event_id','p_actor_user_id','p_registration_id','p_code','p_action','p_request_id','p_subject_ids','p_expected_revision','p_reason'],participant_qr_label_queue:['p_event','p_actor','p_registration','p_action','p_ids','p_snapshot','p_request','p_profile','p_outcome']};
  if(url.pathname.startsWith('/rest/v1/rpc/')&&allowed[name]){
   let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);assert.equal(body.p_actor??body.p_actor_user_id,f(actor));calls.push({actor,name,action:body.p_action});
   const args=allowed[name].map(key=>Array.isArray(body[key])?`array[${body[key].map(literal).join(',')}]::uuid[]`:literal(body[key]));
   try{res.end(psql(`begin;set local role service_role;select ${name}(${args.join(',')});commit;`).trim());}catch{res.statusCode=403;res.end(JSON.stringify({code:'42501',message:'Synthetic permission failure'}));}return;
  }
  res.statusCode=404;res.end(JSON.stringify({message:`Unexpected synthetic endpoint: ${url.pathname}`}));
 });
 try{
  await new Promise(r=>server.listen(55486,'127.0.0.1',r));const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for(const role of [31,33,32]){
   actor=role;const context=await browser.newContext({viewport:{width:role===33?390:1280,height:900}});
   await context.addInitScript(()=>{window.print=()=>{window.top.__prints=(window.top.__prints??0)+1;window.dispatchEvent(new Event('afterprint'));};});
   const jwt=[{alg:'HS256',typ:'JWT'},{sub:f(actor),exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.synthetic';
   const session={access_token:jwt,refresh_token:'synthetic',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:f(actor),email:'manager@example.invalid'}};
   await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:base},{name:'iscrizioni_last_activity',value:String(Date.now()),url:base}]);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/dashboard/participants/qr?*',route=>route.fulfill({json:{qr:preview}}));
   await page.route('**/dashboard/attendance?*',route=>{
    const entries=JSON.parse(psql(`select coalesce(jsonb_object_agg(registration_id::text||':'||coalesce(child_id::text,'adult'),checked_in_at),'{}') from check_ins where registration_id=f(99501) and cancelled_at is null;`).trim());
    return route.fulfill({json:{eventId:f(1),updatedAt:new Date().toISOString(),entries,schoolEntries:{},totals:{adults:0,children:0,people:0,students:0,companions:0,schoolBookings:0}}});
   });
   const before=calls.length;await page.goto(base+'/dashboard/manager?section=iscritti');await page.getByRole('link',{name:'Ada Mori',exact:true}).click();await page.getByRole('heading',{name:'Scheda partecipante',exact:true}).waitFor();
   const btn=name=>page.getByRole('button',{name,exact:true});
   if(role===32){assert.equal(await btn('Conferma partecipazione').count(),0);assert.equal(await btn('Stampa etichetta QR').count(),0);assert.equal(calls.length,before);}
   else{
    await btn('Conferma partecipazione').waitFor();assert.equal(psql('select count(*) from check_ins where registration_id=f(99501) and cancelled_at is null;').trim(),'0');
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Scarica immagine: Ada Mori',exact:true}).click()]);assert.equal(readFileSync(await download.path()).subarray(1,4).toString(),'PNG');
    await btn('Stampa etichetta QR').click();await page.waitForFunction(()=>window.__prints===1);assert.equal(psql('select count(*) from check_ins where registration_id=f(99501) and cancelled_at is null;').trim(),'0');
    await btn('Conferma partecipazione').dblclick();await page.getByText('✓ Partecipazione confermata',{exact:true}).waitFor();await page.locator('tbody').getByText(/Partecipazione confermata/).waitFor();assert.equal(psql('select count(*) from check_ins where registration_id=f(99501) and cancelled_at is null;').trim(),'1');
    await btn('Rimuovi presenza').click();await btn('Conferma rimozione').waitFor();await btn('Mantieni presenze').click();assert.equal(psql('select count(*) from check_ins where registration_id=f(99501) and cancelled_at is null;').trim(),'1');
    await btn('Rimuovi presenza').click();await btn('Conferma rimozione').click();await page.getByRole('dialog').getByText('Partecipazione non confermata',{exact:true}).waitFor();await page.locator('tbody').getByText('Partecipazione non confermata',{exact:true}).waitFor();assert.equal(psql('select count(*) from check_ins where registration_id=f(99501) and cancelled_at is null;').trim(),'0');
    assert.equal(await page.evaluate(()=>window.__prints),1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:`/tmp/pace-manager-participant-${role}.png`,fullPage:true});
    if(role===31){psql("delete from event_user_roles where user_id=f(31) and role='manager';");const prior=calls.length;await btn('Conferma partecipazione').click();await page.getByRole('alert').filter({hasText:/Sessione scaduta|incarico/}).waitFor();assert.equal(calls.length,prior);psql("insert into event_user_roles(user_id,event_id,role) values(f(31),f(1),'manager');");}
   }
   assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS original Manager participant table/actions -> PostgreSQL: Manager-only, Admin, Viewer exclusion, name click, separate print/presence, explicit removal, download, desktop/mobile and live revocation');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
}
