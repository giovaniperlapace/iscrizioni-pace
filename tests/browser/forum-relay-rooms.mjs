// Original components/actions; synthetic Auth transport and disposable PostgreSQL only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {createServer} from 'node:http';
import {FORUM_RELAY_ROOMS} from '../../lib/events/assisi-2026-relay-rooms.ts';
import {FORUM_RELAY_COPY,relayDirections} from '../../lib/panels/relay-copy.ts';
const fw=n=>createHash('md5').update('forum-queue-'+n).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
const event='d302dff4-f08d-4040-8d83-9ec2042a73d5';
const room=FORUM_RELAY_ROOMS[0];
export async function checkRelayServerActions(psql,concurrent,base='http://127.0.0.1:3164') {
 assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
 const seed=readFileSync('tests/sql/forum-relay-rooms.sql','utf8').split('create temp table relay_original_queue')[0]
  .replace('\\i supabase/migrations/20261023101000_assisi_relay_programme.sql',()=>readFileSync('supabase/migrations/20261023101000_assisi_relay_programme.sql','utf8')).replaceAll('\\i supabase/migrations/20261023102000_forum_waitlist_extend_active_offers.sql',()=>readFileSync('supabase/migrations/20261023102000_forum_waitlist_extend_active_offers.sql','utf8')).replace(/^\\echo .*$/gm,'');
 psql(seed+`insert into groups(id,event_id,name) values(fw(7800),'${event}','Relay synthetic group');
 insert into group_memberships(group_id,user_id) values(fw(7800),fw(7007));
 insert into participant_group_assignments(registration_id,group_id,status,is_current) values(fw(7204),fw(7800),'confirmed',true),(fw(7205),fw(7800),'confirmed',true);
 update panel_waitlist set notification_user_id=fw(7007),notification_kind='leader',notification_locale='it' where registration_id=fw(7204) and panel_id='${room.sourceId}';
 update participants set auth_user_id=null where id=fw(7104);
 select activate_panel_relay_rooms('${event}');update panel_seat_sections set capacity=2 where id='${room.sectionId}';
 select app.advance_panel_waitlist('${room.sectionId}',true);commit;`);
 const route='app/forum-relay-check';assert.ok(!existsSync(route));mkdirSync(route);
 writeFileSync(`${route}/page.tsx`, `import {ParticipantPanelBookings} from '@/app/dashboard/partecipante/participant-panel-bookings';
 import {GroupPanelBookings} from '@/app/dashboard/capogruppo/panel/panel-bookings';
 import {PublicPanelProgram} from '@/app/public-panel-program';
 import {getMessages} from '@/lib/i18n/messages';
 import {getPublicPanelProgram} from '@/lib/panels/public-program';
 import {normalizeLocale} from '@/lib/i18n/config';
 import {createSupabaseServerClient} from '@/lib/supabase/server';
 export default async function Fixture({searchParams}:{searchParams:Promise<{view?:string,locale?:string}>}){const q=await searchParams;const locale=normalizeLocale(q.locale)??'it';const db=await createSupabaseServerClient();
 if(q.view==='home') return <PublicPanelProgram locale={locale} panels={await getPublicPanelProgram(db)} copy={getMessages(locale).panelProgram}/>;
 if(q.view==='group'){const {data,error}=await db.rpc('get_group_panel_booking_view',{p_event_id:'${event}',p_section_id:'${room.sectionId}'});if(error)throw new Error('Synthetic group read failed');return <main className="mx-auto max-w-6xl p-5"><GroupPanelBookings locale={locale} sectionId="${room.sectionId}" view={data}/></main>;}
 const {data,error}=await db.rpc('get_participant_panel_catalog',{p_registration_id:'${fw(7202)}'});if(error)throw new Error('Synthetic read failed');
 return <main className="mx-auto max-w-6xl p-5"><ParticipantPanelBookings locale={locale} registrationId="${fw(7202)}" rows={data??[]}/></main>;}`);
 let viewer=fw(7002);const calls=[];const literal=v=>`'${String(v).replaceAll("'","''")}'`;
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');const url=new URL(req.url,'http://127.0.0.1');calls.push(url.pathname);
  if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:viewer,email:'relay@example.invalid',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}));return;}
  if(url.pathname==='/rest/v1/events'){res.end(JSON.stringify({id:event,title:'Synthetic relay event'}));return;}
  if(url.pathname==='/rest/v1/group_memberships'){res.end(JSON.stringify(viewer===fw(7007)?[{role:'capogruppo',groups:{event_id:event}}]:[]));return;}
  if(url.pathname==='/rest/v1/event_user_roles'){res.end('[]');return;}
  if(!url.pathname.startsWith('/rest/v1/rpc/')){res.end('[]');return;}
  const name=url.pathname.split('/').at(-1);let input='';for await(const chunk of req)input+=chunk;const b=input?JSON.parse(input):{};let expr;
  if(name==='get_panel_release_mode')expr='to_jsonb(get_panel_release_mode())';
  else if(name==='has_panel_reception_duty')expr='to_jsonb(false)';
  else if(name==='get_participant_panel_catalog')expr=`(select coalesce(jsonb_agg(x),'[]'::jsonb) from get_participant_panel_catalog(${literal(b.p_registration_id)}) x)`;
  else if(name==='get_public_panel_program_with_seats')expr=`(select coalesce(jsonb_agg(x),'[]'::jsonb) from get_public_panel_program_with_seats() x)`;
  else if(name==='get_group_panel_booking_view')expr=`get_group_panel_booking_view(${literal(b.p_event_id)},${b.p_section_id?literal(b.p_section_id):'null'})`;
  else if(name==='set_panel_family_booking')expr=`set_panel_family_booking(${literal(b.p_registration_id)},${b.p_panel_id?literal(b.p_panel_id):'null'},${literal(b.p_section_id)},${literal(b.p_intent)},array[${(b.p_child_ids??[]).map(literal).join(',')}]::uuid[],${b.p_as_leader?'true':'false'},${literal(b.p_locale??'it')})`;
  else {res.statusCode=500;res.end(JSON.stringify({message:'Unknown synthetic RPC',code:'UNKNOWN'}));return;}
  try {res.end(psql(`begin${name.startsWith('get_')?' read only':''};set local role authenticated;set local "request.jwt.claim.sub"=${literal(viewer)};select ${expr};commit;`,true).trim());}
  catch(e) {console.error('Synthetic RPC failed',name,String(e.stderr).slice(0,300));res.statusCode=400;res.end(JSON.stringify({message:'Synthetic RPC rejected',code:'P0001'}));}
 });
 let browser;
 try {
  await new Promise(resolve=>server.listen(55485,'127.0.0.1',resolve));
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const setSession=async()=>{const jwt=[{alg:'HS256',typ:'JWT'},{sub:viewer,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.synthetic';
   const session={access_token:jwt,refresh_token:'synthetic',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:viewer,email:'relay@example.invalid'}};
   await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:base},{name:'iscrizioni_last_activity',value:String(Date.now()),url:base}]);};
  await setSession();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('Browser console:',m.text().slice(0,500));});
  await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const target=page.locator('article').filter({has:page.locator(`input[name=panelId][value="${room.id}"]`)});
  for(const locale of ['it','en','fr','de','es','nl','uk']) {
   await page.goto(base+'/forum-relay-check?locale='+locale);await target.waitFor();
   assert.ok((await target.innerText()).includes('FORUM 3 - Synthetic content'));
   assert.ok((await target.innerText()).includes(room.address));
   assert.ok((await target.innerText()).includes(relayDirections(locale,room.parking)));
   const accept=target.getByRole('button',{name:FORUM_RELAY_COPY[locale].accept,exact:true});assert.ok(await accept.isDisabled());
   await page.waitForLoadState('networkidle');
   await target.getByRole('checkbox',{name:FORUM_RELAY_COPY[locale].consent}).check();await page.waitForFunction(el=>!el.disabled,await accept.elementHandle(),{timeout:5000}).catch(async e=>{console.log('DIAGNOSTIC',locale,errors,await target.locator('input').evaluateAll(xs=>xs.map(x=>({name:x.name,type:x.type,checked:x.checked,disabled:x.disabled}))),await target.innerText());await page.screenshot({path:'/tmp/relay-browser-failure.png',fullPage:true});throw e;});
   await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),locale);
  }
  await page.goto(base+'/forum-relay-check');await target.waitFor();
  await target.getByRole('checkbox',{name:FORUM_RELAY_COPY.it.consent}).check();
  await page.screenshot({path:'/tmp/relay-participant-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/relay-participant-desktop.png',fullPage:true});
  const acceptance=page.waitForResponse(r=>!!r.request().headers()['next-action']);await target.getByRole('button',{name:FORUM_RELAY_COPY.it.accept,exact:true}).click();await acceptance;
  assert.equal(psql(`select choice from moment_attendance_choices where registration_id=fw(7202) and moment_id='${room.id}';`,true).trim(),'yes');
  assert.equal(psql(`select status from panel_waitlist where registration_id=fw(7202) and panel_id='${room.sourceId}';`,true).trim(),'waiting');
  console.log('PASS original participant UI, explicit Italian consent in seven languages, mobile/desktop, authenticated acceptance and preserved main queue');
  psql(`update panel_seat_sections set capacity=3 where id=fw(7600);select app.advance_panel_waitlist(fw(7600),true);
   select set_config('request.jwt.claim.sub',fw(7002)::text,false);select set_panel_family_booking(fw(7202),'${room.sourceId}',fw(7600),'accept',array[fw(7301)]);
   select app.advance_panel_waitlist('${room.sectionId}',true);`);
  viewer=fw(7007);await setSession();
  for(const locale of ['it','en','fr','de','es','nl','uk']) {
   await page.goto(base+'/forum-relay-check?view=group&locale='+locale);
   const row=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:/Relay Synthetic 4/})});await row.waitFor();
   assert.ok(await row.getByRole('button',{name:new RegExp(FORUM_RELAY_COPY[locale].accept)}).isDisabled());
   await row.getByRole('checkbox',{name:FORUM_RELAY_COPY[locale].consent}).check();
   await page.waitForFunction(el=>!el.disabled,await row.getByRole('button',{name:new RegExp(FORUM_RELAY_COPY[locale].accept)}).elementHandle());
   await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),locale);
  }
  await page.goto(base+'/forum-relay-check?view=group');
  const row=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:/Relay Synthetic 4/})});
  await row.getByRole('checkbox',{name:FORUM_RELAY_COPY.it.consent}).check();
  await page.screenshot({path:'/tmp/relay-group-mobile.png',fullPage:true});
  const groupAcceptance=page.waitForResponse(r=>!!r.request().headers()['next-action']);await row.getByRole('button',{name:/Accetta la sala collegata/}).click();await groupAcceptance;
  assert.equal(psql(`select choice from moment_attendance_choices where registration_id=fw(7204) and moment_id='${room.id}';`,true).trim(),'yes');
  assert.equal(psql(`select status from panel_waitlist where registration_id=fw(7204) and panel_id='${room.sourceId}';`,true).trim(),'waiting');
  console.log('PASS original leader UI and action, no personal account required, seven languages, mobile consent and preserved source queue');
  await page.goto(base+'/forum-relay-check?view=home');
  await page.getByRole('heading',{name:new RegExp('FORUM 1 — SALA COLLEGATA')}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/relay-home-mobile.png',fullPage:true});
  // Six duplicate accepts on independent connections must not duplicate or consume another seat.
  const results=await Promise.all(Array.from({length:6},()=>concurrent(`select set_config('request.jwt.claim.sub',fw(7007)::text,false);set role authenticated;select set_panel_family_booking(fw(7204),'${room.id}','${room.sectionId}','accept','{}',true);`)));
  assert.ok(results.every(v=>v.includes('booked')));
  assert.equal(psql(`select count(*) from moment_attendance_choices where registration_id=fw(7204) and moment_id='${room.id}' and choice='yes';`,true).trim(),'1');
  assert.deepEqual(errors,[]);
  console.log('PASS relay home Italian-only copy, priority CTA, and six simultaneous acceptance retries with one booking');
 } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));rmSync(route,{recursive:true,force:true});}
}
