// Original page/actions -> local Auth/PostgREST adapter -> disposable PostgreSQL.
// Only synthetic identities; browser printing is simulated.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { encryptQrToken } from '../../lib/qrcode/secure-token.ts';

const f=n=>createHash('md5').update(String(n)).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
const literal=value=>value==null?'null':`'${String(value).replaceAll("'","''")}'`;
export async function checkReceptionRoleAccess(psql,base='http://127.0.0.1:3194') {
 assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
 let actor=30, browser;
 const rpcCalls=[];
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:f(actor),email:'reception@example.invalid',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}));return;}
  if(url.pathname==='/rest/v1/event_user_roles'){
   assert.equal(url.searchParams.get('user_id'),`eq.${f(actor)}`);
   res.end(psql(`select coalesce(jsonb_agg(jsonb_build_object('role',role,'event_id',event_id)),'[]') from event_user_roles where user_id=${literal(f(actor))};`).trim());return;
  }
  if(url.pathname==='/rest/v1/events'){res.end(psql(`select jsonb_build_object('id',id) from events where is_current;`).trim());return;}
  if(url.pathname==='/rest/v1/group_memberships'){res.end('[]');return;}
  if(url.pathname==='/rest/v1/rpc/has_panel_reception_duty'){res.end('false');return;}
  if(url.pathname==='/rest/v1/rpc/my_panel_reception_duties'){res.end('[]');return;}
  if(url.pathname==='/rest/v1/rpc/reception_ready'){
   res.end(psql(`begin;set local role authenticated;set local "request.jwt.claim.sub"=${literal(f(actor))};select to_jsonb(reception_ready());commit;`).trim());return;
  }
  const name=url.pathname.split('/').at(-1);
  const allowed={reception_event_check_in:['p_duty','p_event_id','p_actor_user_id','p_lookup_kind','p_lookup','p_action','p_request_id','p_subject_ids','p_students','p_companions','p_expected_revision','p_reason'],
   qr_label_queue:['p_event','p_actor','p_action','p_group','p_registration','p_ids','p_snapshot','p_request','p_profile','p_outcome']};
  if(url.pathname.startsWith('/rest/v1/rpc/')&&allowed[name]){
   let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);
   assert.equal(body.p_actor??body.p_actor_user_id,f(actor));
   rpcCalls.push({actor,name,action:body.p_action});
   const args=allowed[name].map(key=>Array.isArray(body[key])?`array[${body[key].map(literal).join(',')}]::uuid[]`:literal(body[key]));
   try{res.end(psql(`begin;set local role service_role;select ${name}(${args.join(',')});commit;`).trim());}
   catch{res.statusCode=403;res.end(JSON.stringify({code:'42501',message:'Synthetic permission failure'}));}return;
  }
  res.statusCode=404;res.end(JSON.stringify({message:'Unexpected synthetic endpoint'}));
 });
 try{
  await new Promise(resolve=>server.listen(55486,'127.0.0.1',resolve));
  psql(`insert into event_user_roles(user_id,event_id,role) values(f(31),f(1),'accoglienza');`);
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for(const role of [30,31,33]){
   actor=role;
   const token=String(role).padEnd(43,'a');
   const hash=createHash('sha256').update(token).digest('hex');
   const reg=98600+role;
   psql(`insert into participants(id,first_name,last_name,public_code) values(f(${reg+100}),'Operatore','Test ${role}','R${role}X');
    insert into registrations(id,event_id,participant_id,status) values(f(${reg}),f(1),f(${reg+100}),'confirmed');
    insert into qr_tokens(registration_id,token_hash,token_encrypted) values(f(${reg}),${literal(hash)},${literal(encryptQrToken(token))});`);
   const context=await browser.newContext({viewport:{width:role===31?390:1280,height:900}});
   await context.addInitScript(()=>{window.print=()=>{window.top.__prints=(window.top.__prints??0)+1;window.dispatchEvent(new Event('afterprint'));};});
   const jwt=[{alg:'HS256',typ:'JWT'},{sub:f(actor),exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.synthetic';
   const session={access_token:jwt,refresh_token:'synthetic',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:f(actor),email:'reception@example.invalid'}};
   await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:base},{name:'iscrizioni_last_activity',value:String(Date.now()),url:base}]);
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+'/dashboard/accoglienza');
   await page.getByRole('button',{name:/^Computer ·/}).click();
   if(role===31)await page.getByRole('tab',{name:'Dashboard manager',exact:true}).waitFor();
   await page.keyboard.type(token,{delay:2});await page.keyboard.press('Enter');
   await page.getByRole('button',{name:'Conferma partecipazione',exact:true}).waitFor();
   assert.equal(psql(`select count(*) from check_ins where registration_id=f(${reg});`).trim(),'0');
   await page.getByRole('button',{name:'Stampa etichetta QR',exact:true}).click();
   await page.waitForFunction(()=>window.__prints===1);
   assert.equal(psql(`select count(*) from check_ins where registration_id=f(${reg});`).trim(),'0');
   await page.getByRole('button',{name:'Conferma partecipazione',exact:true}).click();
   await page.getByText('✓ Partecipazione confermata',{exact:true}).first().waitFor();
   assert.equal(psql(`select count(*) from check_ins where registration_id=f(${reg}) and cancelled_at is null;`).trim(),'1');
   assert.equal(await page.evaluate(()=>window.__prints),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:`/tmp/pace-reception-access-${role}.png`,fullPage:true});
   if(role!==31){
    await page.getByRole('button',{name:'Rimuovi presenza',exact:true}).click();
    await page.getByRole('button',{name:'Conferma rimozione',exact:true}).click();
    await page.getByText('Partecipazione non confermata',{exact:true}).waitFor();
    assert.equal(psql(`select count(*) from check_ins where registration_id=f(${reg}) and cancelled_at is null;`).trim(),'0');
    assert.equal(psql(`select count(*) from check_ins where registration_id=f(${reg}) and cancelled_at is not null;`).trim(),'1');
    const before=rpcCalls.length;
    await page.keyboard.type(token,{delay:2});await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'Conferma partecipazione',exact:true}).waitFor();
    assert.deepEqual(rpcCalls.slice(before).filter(c=>c.name==='reception_event_check_in').map(c=>c.action),['inspect']);
    assert.equal(psql(`select count(*) from check_ins where registration_id=f(${reg}) and cancelled_at is null;`).trim(),'0');
   }
   if(role===31){
    psql(`delete from event_user_roles where user_id=f(31) and role='accoglienza';`);
    const before=rpcCalls.length;
    await page.getByRole('button',{name:'Rimuovi presenza',exact:true}).click();
    await page.getByText(/Sessione scaduta o incarico/).first().waitFor();
    assert.equal(rpcCalls.length,before,'Revocation must block before the privileged RPC');
   }
   if(role!==31){await page.goto(base+'/dashboard/accoglienza/collaudo');await page.getByRole('heading',{name:'Collaudo etichette QR',exact:true}).waitFor();}
   assert.deepEqual(errors,[]);
   await context.close();
  }
  console.log('PASS actual reception page/actions -> PostgreSQL: Accoglienza, Manager+Accoglienza, Admin, desktop/mobile, separate print/presence, explicit removal, direct rescan, live revocation and calibration');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
}
