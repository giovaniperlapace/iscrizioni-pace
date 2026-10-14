// Real Server Actions against disposable PostgreSQL through a synthetic Supabase transport.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {createServer} from 'node:http';
const fw=n=>createHash('md5').update('forum-queue-'+n).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
export async function checkForumServerActions(psql,base='http://127.0.0.1:3164') {
 assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
 const route='app/forum-waitlist-action-check';assert.ok(!existsSync(route));mkdirSync(route);
 writeFileSync(`${route}/page.tsx`, `import {ParticipantPanelBookings} from '@/app/dashboard/partecipante/participant-panel-bookings';
 import {createSupabaseServerClient} from '@/lib/supabase/server';
 export default async function Fixture(){const db=await createSupabaseServerClient();const {data,error}=await db.rpc('get_participant_panel_catalog',{p_registration_id:'${fw(103)}'});if(error)throw new Error('Synthetic catalog failed');
 return <main className="mx-auto max-w-6xl p-5"><ParticipantPanelBookings locale="it" registrationId="${fw(103)}" rows={data??[]}/></main>;}`);
 const calls=[];
 const literal=v=>`'${String(v).replaceAll("'","''")}'`;
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');const url=new URL(req.url,'http://127.0.0.1');
  calls.push(url.pathname);
  if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:fw(3),email:'queue-3@example.invalid',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}));return;}
  if(!url.pathname.startsWith('/rest/v1/rpc/')){res.end('[]');return;}
  const name=url.pathname.split('/').at(-1);let input='';for await(const chunk of req)input+=chunk;
  const body=input?JSON.parse(input):{};
  let expr;
  if(name==='get_panel_release_mode')expr='to_jsonb(get_panel_release_mode())';
  else if(name==='has_panel_reception_duty')expr='to_jsonb(false)';
  else if(name==='get_participant_panel_catalog')expr=`(select coalesce(jsonb_agg(x),'[]'::jsonb) from get_participant_panel_catalog(${literal(body.p_registration_id)}) x)`;
  else if(name==='set_individual_panel_waitlist')expr=`set_individual_panel_waitlist(${literal(body.p_registration_id)},${literal(body.p_panel_id)},${literal(body.p_section_id)},${literal(body.p_intent)})`;
  else if(name==='set_individual_panel_booking')expr=`set_individual_panel_booking(${literal(body.p_registration_id)},${literal(body.p_panel_id)},${literal(body.p_section_id)},${body.p_booked?'true':'false'})`;
  else {res.statusCode=500;res.end(JSON.stringify({message:'Unknown synthetic RPC',code:'UNKNOWN'}));return;}
  try {res.end(psql(`begin;set local role authenticated;set local "request.jwt.claim.sub"=${literal(fw(3))};select ${expr};commit;`,true).trim());}
  catch {res.statusCode=400;res.end(JSON.stringify({message:'Synthetic RPC rejected',code:'P0001'}));}
 });
 let browser;
 try {
  await new Promise(resolve=>server.listen(55485,'127.0.0.1',resolve));
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const context=await browser.newContext();
  const jwt=[{alg:'HS256',typ:'JWT'},{sub:fw(3),exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.synthetic';
  const session={access_token:jwt,refresh_token:'synthetic',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:fw(3),email:'queue-3@example.invalid'}};
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:base},{name:'iscrizioni_last_activity',value:String(Date.now()),url:base}]);
  const page=await context.newPage();
  await page.goto(base+'/forum-waitlist-action-check');
  const target=page.locator('article').filter({has:page.getByRole('heading',{name:'Forum full',exact:true})});
  await target.getByRole('button',{name:'Mettiti in coda per questo Forum',exact:true}).waitFor();
  const submitted=page.waitForResponse(r=>r.request().headers()['next-action']);
  await target.getByRole('button',{name:'Mettiti in coda per questo Forum',exact:true}).click();await submitted;
  assert.match(psql(`select status from panel_waitlist where registration_id=fw(103) and status='waiting';`,true),/waiting/);
  await page.goto(base+'/forum-waitlist-action-check');await target.getByRole('button',{name:'Esci dalla coda'}).waitFor();
  psql(`update panel_seat_sections set capacity=2 where id=fw(501);update panel_waitlist_scheduler set next_run_at=clock_timestamp();select claim_panel_waitlist_notification();`,true);
  await page.goto(base+'/forum-waitlist-action-check');
  await target.getByRole('button',{name:'Conferma iscrizione a questo Forum',exact:true}).waitFor();
  const acceptance=page.waitForResponse(r=>r.request().headers()['next-action']);
  await target.getByRole('button',{name:'Conferma iscrizione a questo Forum',exact:true}).click();await acceptance;
  assert.equal(psql(`select choice from moment_attendance_choices where registration_id=fw(103) and moment_id=fw(402);`,true).trim(),'no');
  assert.equal(psql(`select choice from moment_attendance_choices where registration_id=fw(103) and moment_id=fw(401);`,true).trim(),'yes');
  await page.goto(base+'/forum-waitlist-action-check');await target.getByRole('button',{name:'Cancella iscrizione',exact:true}).waitFor();
  assert.ok(calls.includes('/rest/v1/rpc/set_individual_panel_waitlist'));
  console.log('PASS real browser button -> authenticated Server Action -> disposable PostgreSQL -> canonical cancellation/new booking -> updated real Forum card');
 } finally {
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));rmSync(route,{recursive:true,force:true});rmSync('.next/dev/types/app/forum-waitlist-action-check',{recursive:true,force:true});
 }
}
