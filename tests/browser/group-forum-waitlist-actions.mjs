// Real page, Server Actions and availability route against disposable PostgreSQL.
// Only Auth/PostgREST transport is synthetic. No email provider is contacted.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
const fw=n=>createHash('md5').update('forum-queue-'+n).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
export async function checkGroupForumServerActions(psql,base='http://127.0.0.1:3164') {
 assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
 // Reuse the deterministic fixture setup, before any test actions.
 psql(readFileSync('tests/sql/group-panel-waitlist.sql','utf8').split("select set_config('request.jwt.claim.sub'")[0]+'commit;');
 const calls=[];
 const literal=v=>`'${String(v).replaceAll("'","''")}'`;
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');const url=new URL(req.url,'http://127.0.0.1');calls.push(url.pathname);
  if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:fw(9),email:'queue-9@example.invalid',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}));return;}
  if(url.pathname==='/rest/v1/events'){res.end(JSON.stringify({id:fw(200),title:'Synthetic event'}));return;}
  if(url.pathname==='/rest/v1/group_memberships'){res.end(JSON.stringify([{role:'capogruppo',groups:{event_id:fw(200)}}]));return;}
  if(url.pathname==='/rest/v1/event_user_roles'){res.end('[]');return;}
  if(!url.pathname.startsWith('/rest/v1/rpc/')){res.statusCode=500;res.end(JSON.stringify({message:'Unexpected synthetic endpoint'}));return;}
  const name=url.pathname.split('/').at(-1);let input='';for await(const chunk of req)input+=chunk;const body=input?JSON.parse(input):{};
  let expr;
  if(name==='get_panel_release_mode')expr='to_jsonb(get_panel_release_mode())';
  else if(name==='has_panel_reception_duty')expr='to_jsonb(false)';
  else if(name==='get_group_panel_booking_view')expr=`get_group_panel_booking_view(${literal(body.p_event_id)},${body.p_section_id?literal(body.p_section_id):'null'})`;
  else if(name==='set_group_panel_waitlist')expr=`set_group_panel_waitlist(${literal(body.p_event_id)},${literal(body.p_section_id)},${literal(body.p_registration_id)},${literal(body.p_intent)},${literal(body.p_locale)})`;
  else if(name==='set_group_panel_booking')expr=`set_group_panel_booking(${literal(body.p_event_id)},${literal(body.p_section_id)},${literal(body.p_registration_id)},${body.p_booked?'true':'false'})`;
  else {res.statusCode=500;res.end(JSON.stringify({message:'Unexpected synthetic RPC',code:'UNKNOWN'}));return;}
  try {res.end(psql(`begin;set local role authenticated;set local "request.jwt.claim.sub"=${literal(fw(9))};select ${expr};commit;`,true).trim());}
  catch(e) {console.error('Synthetic RPC failed',name,String(e.stderr).slice(0,350));res.statusCode=400;res.end(JSON.stringify({message:'Synthetic RPC rejected',code:'42501'}));}
 });
 let browser;
 try {
  await new Promise(resolve=>server.listen(55485,'127.0.0.1',resolve));
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const context=await browser.newContext({viewport:{width:1400,height:1050}});
  const jwt=[{alg:'HS256',typ:'JWT'},{sub:fw(9),exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.synthetic';
  const session={access_token:jwt,refresh_token:'synthetic',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:fw(9),email:'queue-9@example.invalid'}};
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:base},{name:'iscrizioni_last_activity',value:String(Date.now()),url:base}]);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.clock.install();
  await page.goto(base+'/dashboard/capogruppo/panel?section='+fw(507));
  await page.getByRole('heading',{name:'Iscrizioni ai forum'}).waitFor();
  const person=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:/Synthetic 4 Queue/})});
  const click=async(label)=>{const response=page.waitForResponse(r=>!!r.request().headers()['next-action']);await person.getByRole('button',{name:label}).click();await response;};
  const joined=page.waitForResponse(r=>!!r.request().headers()['next-action']);
  await person.getByRole('button',{name:/Metti in lista d’attesa/}).evaluate(button=>{button.click();button.click();});await joined;
  assert.equal(calls.filter(name=>name==='/rest/v1/rpc/set_group_panel_waitlist').length,1);
  await person.getByRole('button',{name:/Rimuovi dalla lista d’attesa/}).waitFor();
  assert.match(psql(`select status from panel_waitlist where registration_id=fw(104) and panel_id=fw(407) and status='waiting';`,true),/waiting/);
  // The leader can book a different forum while this request waits.
  psql(`select set_config('request.jwt.claim.sub',fw(9)::text,false);select set_group_panel_booking(fw(200),fw(508),fw(104),true);update panel_seat_sections set capacity=2 where id=fw(507);select app.advance_panel_waitlist(fw(507),true);`);
  // Five-minute refresh uses the real route and preserves the current filter.
  await page.getByRole('searchbox').fill('Synthetic 4');
  const refreshed=page.waitForResponse(r=>r.url().includes('/panel/availability?'));
  await page.clock.fastForward(300000);await refreshed;
  await person.getByRole('button',{name:/Conferma il posto/}).waitFor();
  assert.equal(await page.getByRole('searchbox').inputValue(),'Synthetic 4');
  assert.match(await person.innerText(),/sostituisce.*stessa fascia/);
  await page.screenshot({path:'/tmp/pace-group-forum-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'/tmp/pace-group-forum-mobile.png',fullPage:true});
  await page.clock.setSystemTime(new Date(Date.now()+31*60*1000));await page.clock.fastForward(1000);
  assert.ok(await person.getByRole('button',{name:/Conferma il posto/}).isDisabled());
  await page.clock.setSystemTime(new Date());await page.clock.fastForward(1000);
  await click(/Conferma il posto/);
  await person.getByRole('button',{name:/Disiscrivi/}).waitFor();
  assert.equal(psql(`select choice from moment_attendance_choices where registration_id=fw(104) and moment_id=fw(408);`,true).trim(),'no');
  assert.equal(psql(`select choice from moment_attendance_choices where registration_id=fw(104) and moment_id=fw(407);`,true).trim(),'yes');
  await click(/Disiscrivi/);
  await person.getByRole('button',{name:/Iscrivi:/}).waitFor();
  await click(/Iscrivi:/);
  await person.getByRole('button',{name:/Disiscrivi/}).waitFor();
  // Recover from a temporary read failure through the existing manual refresh.
  await page.route('**/panel/availability?*',route=>route.fulfill({status:500,contentType:'application/json',body:'{}'}),{times:1});
  await page.clock.fastForward(300000);
  await page.locator('main').getByRole('alert').waitFor();
  assert.ok(await person.getByRole('button',{name:/Disiscrivi/}).isDisabled());
  await page.getByRole('button',{name:'Aggiorna disponibilità',exact:true}).click();
  await page.locator('main').getByRole('alert').waitFor({state:'detached'});
  assert.ok(await person.getByRole('button',{name:/Disiscrivi/}).isEnabled());
  for(const locale of ['it','en','fr','de','es','nl','uk']) {
    await context.addCookies([{name:'iscrizioni_locale',value:locale,url:base}]);
    await page.goto(base+'/dashboard/capogruppo/panel?section='+fw(507));
    await page.locator('tbody tr').first().waitFor();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.equal(await page.locator('tbody tr').count(),5);
  }
  // Revocation is reflected by the polling endpoint; the browser removes all participants.
  psql(`delete from group_memberships where user_id=fw(9) and group_id=fw(700);`);
  const denied=page.waitForResponse(r=>r.url().includes('/panel/availability?'));
  await page.clock.fastForward(300000);await denied;
  await page.locator('main').getByRole('alert').waitFor();await page.locator('tbody').waitFor({state:'detached'});
  assert.ok(calls.includes('/rest/v1/set_group_panel_waitlist')||calls.includes('/rest/v1/rpc/set_group_panel_waitlist'));
  assert.deepEqual(errors,[]);
  console.log('PASS original group page -> Server Actions -> PostgreSQL -> queue/offer/atomic swap/booking/cancellation; real five-minute route, retained filter, desktop/mobile, seven languages, duplicate click, deadline, refresh recovery, revocation');
 } finally {
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
  // Group fixture is disposable, and subsequent individual tests expect no extra pending offers.
  psql(`update panel_waitlist set status='cancelled' where panel_id=fw(407) and status in ('waiting','offered');update participants set auth_user_id=fw(4) where id=fw(24);delete from registration_children where registration_id=fw(104) and first_name='Child' and last_name='Queue';`);
 }
}
