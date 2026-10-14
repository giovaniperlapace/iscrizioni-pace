// Browser -> real authenticated Server Action -> disposable PostgreSQL, synthetic only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
const fw=n=>createHash('md5').update('forum-queue-'+n).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
export async function checkForumUnpublication(psql,base='http://127.0.0.1:3164') {
 assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);
 const route='app/forum-unpublication-check';assert.ok(!existsSync(route));mkdirSync(route);
 writeFileSync(`${route}/page.tsx`, `import {PanelPublicationTable} from '@/app/dashboard/panel-publication-table';
 import {createSupabaseServerClient} from '@/lib/supabase/server';
 export default async function Fixture({searchParams}:{searchParams:Promise<{role?:string}>}){const {role}=await searchParams;
 const db=await createSupabaseServerClient();const {data,error}=await db.from('event_moments').select('id,publication_status').eq('id','${fw(401)}').single();if(error)throw new Error('Synthetic Forum failed');
 const panel={id:data.id,eventId:'${fw(200)}',title:'Forum sintetico da ritirare',description:null,startsAt:'2026-10-26T15:00:00Z',endsAt:'2026-10-26T16:00:00Z',locationId:'room',locationName:'Sala sintetica',locationCapacity:50,publicationStatus:data.publication_status,publishedAt:'2026-10-14T08:00:00Z',updatedAt:null,confirmedRegistrationCount:2,sections:[],assignedCapacity:2};
 return <main className="mx-auto max-w-6xl p-5"><PanelPublicationTable panels={[panel]} totalCount={1} dashboard={role==='manager'?'manager':'admin'} navMode="mini" eventId={panel.eventId} panelPath="/dashboard/admin?section=panel&panelView=panels&nav=mini&panelQ=sintetico&panelStatus=published" canManage={role!=='viewer'}/></main>;}`);
 const literal=v=>`'${String(v).replaceAll("'","''")}'`;
 let fail=false, rpcCalls=0, actor=10, browser;
 const snapshot=psql(`select md5(string_agg(to_jsonb(x)::text,'' order by id)) from moment_attendance_choices x where moment_id=fw(401);`,true).trim();
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');const url=new URL(req.url,'http://127.0.0.1');
  const user={id:fw(actor),email:'withdrawal@example.invalid',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify(user));return;}
  if(url.pathname==='/rest/v1/event_user_roles'){res.end(JSON.stringify([{role:actor===10?'admin':'manager',event_id:actor===10?null:fw(200)}]));return;}
  if(url.pathname==='/rest/v1/events'){res.end(JSON.stringify({id:fw(200),title:'Synthetic event',slug:'synthetic',starts_on:'2026-10-25',ends_on:'2026-10-27',is_current:true,panel_access_mode:'internal'}));return;}
  if(url.pathname==='/rest/v1/event_moments'){res.end(psql(`select jsonb_build_object('id',id,'publication_status',publication_status) from event_moments where id=fw(401);`,true).trim());return;}
  if(url.pathname==='/rest/v1/rpc/unpublish_panel') {
   rpcCalls++;if(fail){res.statusCode=500;res.end(JSON.stringify({message:'Synthetic temporary failure',code:'08006'}));return;}
   let input='';for await(const chunk of req)input+=chunk;const body=JSON.parse(input);
   try {res.end(psql(`begin;set local role authenticated;set local "request.jwt.claim.sub"=${literal(fw(actor))};select to_jsonb(unpublish_panel(${literal(body.p_event_id)},${literal(body.p_panel_id)}));commit;`,true).trim());}
   catch {res.statusCode=400;res.end(JSON.stringify({message:'Synthetic rejection',code:'P0001'}));}return;
  }
  if(url.pathname==='/rest/v1/rpc/has_panel_reception_duty'){res.end('false');return;}
  if(url.pathname==='/rest/v1/rpc/get_panel_release_mode'){res.end('"internal"');return;}
  res.end('[]');
 });
 try {
  await new Promise(resolve=>server.listen(55485,'127.0.0.1',resolve));
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const context=await browser.newContext();const page=await context.newPage();
  for(const n of [10,11]) {
   actor=n;
   const jwt=[{alg:'HS256',typ:'JWT'},{sub:fw(n),exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.synthetic';
   const session={access_token:jwt,refresh_token:'synthetic',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:fw(n),email:'withdrawal@example.invalid'}};
   await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:base},{name:'iscrizioni_last_activity',value:String(Date.now()),url:base}]);
   for(const width of [1440,390]) {
    await page.setViewportSize({width,height:844});
    await page.goto(base+'/forum-unpublication-check?role='+(actor===11?'manager':'admin'));
    const button=page.getByRole('button',{name:'Rendi non pubblicato',exact:true}).filter({visible:true});
    await button.click();const dialog=page.getByRole('dialog');await dialog.waitFor();
    assert.ok(await dialog.innerText().then(x=>x.includes('vengono conservate')&&x.includes('offerte temporanee')));
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await dialog.getByRole('button',{name:'Conferma ritiro pubblicazione',exact:true}).focus();
    await page.keyboard.press('Tab');assert.ok(await dialog.getByRole('button',{name:'Chiudi conferma ritiro pubblicazione'}).evaluate(el=>el===document.activeElement));
    await page.keyboard.press('Shift+Tab');assert.ok(await dialog.getByRole('button',{name:'Conferma ritiro pubblicazione',exact:true}).evaluate(el=>el===document.activeElement));
    if(n===10)await page.screenshot({path:`/tmp/pace-forum-unpublish-${width}.png`});
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    assert.ok(await button.evaluate(el=>el===document.activeElement));
    assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
    await button.click();await dialog.getByRole('button',{name:'Annulla',exact:true}).click();await dialog.waitFor({state:'hidden'});
    assert.equal(psql(`select publication_status from event_moments where id=fw(401);`,true).trim(),'published');
    await button.click();await dialog.getByRole('button',{name:'Chiudi conferma ritiro pubblicazione'}).click();await dialog.waitFor({state:'hidden'});
    await page.goto(base+'/forum-unpublication-check?role=viewer');assert.equal(await page.getByRole('button',{name:'Rendi non pubblicato'}).count(),0);
   }
  }
  await page.goto(base+'/forum-unpublication-check?role='+(actor===11?'manager':'admin'));
  await page.getByRole('button',{name:'Rendi non pubblicato',exact:true}).filter({visible:true}).click();
  const dialog=page.getByRole('dialog');fail=true;
  await dialog.getByRole('button',{name:'Conferma ritiro pubblicazione',exact:true}).click();await dialog.getByRole('alert').waitFor();
  assert.equal(psql(`select publication_status from event_moments where id=fw(401);`,true).trim(),'published');
  fail=false;const submitted=page.waitForResponse(r=>r.request().headers()['next-action']);
  await dialog.getByRole('button',{name:'Conferma ritiro pubblicazione',exact:true}).click();await submitted;
  await page.waitForURL(url=>url.pathname==='/dashboard/manager');
  assert.equal(new URL(page.url()).searchParams.get('panelQ'),'sintetico');
  assert.equal(new URL(page.url()).searchParams.get('nav'),'mini');
  assert.equal(psql(`select publication_status from event_moments where id=fw(401);`,true).trim(),'draft');
  assert.equal(psql(`select md5(string_agg(to_jsonb(x)::text,'' order by id)) from moment_attendance_choices x where moment_id=fw(401);`,true).trim(),snapshot);
  await page.goto(base+'/forum-unpublication-check?role='+(actor===11?'manager':'admin'));await page.getByRole('button',{name:'Pubblica forum',exact:true}).filter({visible:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Rendi non pubblicato'}).count(),0);assert.equal(rpcCalls,2);
  console.log('PASS real withdrawal button -> Server Action -> PostgreSQL, registrations unchanged, retry/error, filters, Admin/Manager, Viewer, desktop/mobile, Escape/focus and cancel');
 } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));rmSync(route,{recursive:true,force:true});rmSync('.next/dev/types/app/forum-unpublication-check',{recursive:true,force:true});}
}
