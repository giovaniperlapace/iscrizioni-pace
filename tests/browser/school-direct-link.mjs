// Original pages and Server Actions; local Auth/REST adapter and disposable SQL only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {openSync,closeSync,mkdirSync} from 'node:fs';
const sd=n=>createHash('md5').update('school-direct-'+n).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
const lit=v=>v===null?'null':typeof v==='number'?String(v):typeof v==='boolean'?String(v):"'"+String(typeof v==='object'?JSON.stringify(v):v).replaceAll("'","''")+"'";
export async function checkSchoolDirectLink(psql) {
 const dir=process.env.SCHOOL_BUILD_DIR;assert.ok(dir?.startsWith('/tmp/'));
 const base='http://127.0.0.1:3179';const calls=[];const errors=[];
 const tables=new Set(['events','school_bookings','school_booking_teachers','school_panel_reservations','school_booking_qr_tokens','audit_logs']);
 const rpcTypes={get_school_booking_access:'scalar',get_panel_release_mode:'scalar',get_public_school_booking_options:'rows',get_teacher_school_panel_options:'rows',create_public_school_booking:'scalar',link_current_school_teacher_identity:'scalar',save_school_booking:'scalar',cancel_school_booking:'scalar'};
 const adapter=createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');const u=new URL(req.url,base);let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{};
  calls.push(u.pathname);
  if(u.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:sd(3),email:'school-3@example.invalid',aud:'authenticated',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}));return;}
  if(u.pathname==='/auth/v1/admin/generate_link'){res.end(JSON.stringify({id:sd(3),email:body.email,action_link:base+'/auth/callback',hashed_token:'synthetic-school-token',verification_type:'magiclink'}));return;}
  const name=u.pathname.split('/').at(-1);let expression;
  if(u.pathname.startsWith('/rest/v1/rpc/')) {
   if(name==='has_panel_reception_duty'){res.end('false');return;}
   if(!(name in rpcTypes)){res.end('[]');return;}
   const args=Object.entries(body).map(([key,value])=>{assert.match(key,/^[a-z_]+$/);return key+'=>'+lit(value);}).join(',');
   expression=rpcTypes[name]==='rows'?`select coalesce(jsonb_agg(x),'[]') from ${name}(${args}) x`:`select to_jsonb(${name}(${args}))`;
  }else if(tables.has(name)){
   if(req.method==='POST'&&name==='audit_logs'){
    const keys=Object.keys(body);assert.ok(keys.every(k=>/^[a-z_]+$/.test(k)));expression=`insert into audit_logs(${keys.join(',')}) values(${keys.map(k=>lit(body[k])).join(',')}) returning '{}'::jsonb`;
   }else {
    const filters=[];
    for(const [key,value]of u.searchParams){if(['select','order','offset','limit'].includes(key))continue;if(key==='school_bookings.event_id')continue;assert.match(key,/^[a-z_]+$/);if(value.startsWith('eq.'))filters.push(`${key}=${lit(value.slice(3))}`);else if(value.startsWith('in.('))filters.push(`${key} in (${value.slice(4,-1).split(',').map(lit).join(',')})`);}
    const rows=`select * from ${name}${filters.length?' where '+filters.join(' and '):''}`;
    expression=req.headers.accept?.includes('vnd.pgrst.object')?`select to_jsonb(x) from (${rows}) x limit 1`:`select coalesce(jsonb_agg(x),'[]') from (${rows}) x`;
   }
  }else {res.end('[]');return;}
  const role=req.headers.authorization==='Bearer synthetic-service'?'service_role':req.headers.authorization?.includes('synthetic')&&req.headers.authorization!=='Bearer synthetic-anon'?'authenticated':'anon';
  const claims=role==='authenticated'?`select set_config('request.jwt.claim.sub',${lit(sd(3))},true);select set_config('request.jwt.claims','{"email":"school-3@example.invalid"}',true);`:'';
  try{const out=psql(`begin;${claims}set local role ${role};${expression};commit;`,true).trim().split('\n').at(-1);res.end(out||'null');}
  catch(e){errors.push(String(e.stderr));res.statusCode=400;res.end(JSON.stringify({message:String(e.stderr),code:'P0001'}));}
 });
 let browser,app;const log=openSync('/tmp/pace-school-browser-server.log','w');
 try{
  await new Promise(r=>adapter.listen(55492,'127.0.0.1',r));
  app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3179'],{cwd:dir,env:{PATH:process.env.PATH,HOME:process.env.HOME,NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:55492',SUPABASE_URL:'http://127.0.0.1:55492',NEXT_PUBLIC_SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',EMAIL_DELIVERY_MODE:'log',QR_TOKEN_ENCRYPTION_SECRET:'synthetic-school-key-not-used-outside-local-tests',APP_URL:base,NEXT_PUBLIC_APP_URL:base,PUBLIC_SITE_URL:base},stdio:['ignore',log,log]});
  for(let i=0;i<80;i++){try{await fetch(base+'/scuole');break;}catch{await new Promise(r=>setTimeout(r,250));}}
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const context=await browser.newContext({locale:'it-IT'});const page=await context.newPage();const browserErrors=[];page.on('pageerror',e=>browserErrors.push(e.message));
  await page.goto(base+'/scuole');await page.locator('[name=teacherFirstName]').waitFor();
  assert.equal(await page.locator('[name=sectionIds]').count(),3);
  assert.match(await page.locator('meta[name=robots]').getAttribute('content'),/noindex/);
  await page.locator('[name=teacherFirstName]').fill('Ada');await page.locator('[name=teacherLastName]').fill('Docente');await page.locator('[name=teacherEmail]').fill('school-3@example.invalid');await page.locator('[name=teacherPhone]').fill('+3906000000');await page.locator('[name=schoolName]').fill('Scuola browser');await page.locator('[name=schoolCity]').fill('Roma');await page.locator('[name=classDescription]').fill('3B');
  await page.locator('[name=studentCount]').fill('8');await page.locator('[name=companionCount]').fill('1');await page.locator('[name=sectionIds]').first().check();
  assert.equal(await page.locator(`[name="students:${sd(501)}"]`).inputValue(),'8');
  assert.equal(await page.locator(`[name=sectionIds][value="${sd(506)}"]`).isDisabled(),true);
  assert.equal(await page.locator(`[name=sectionIds][value="${sd(502)}"]`).isDisabled(),false);
  await page.locator(`[name=sectionIds][value="${sd(501)}"]`).uncheck();
  assert.equal(await page.locator(`[name=sectionIds][value="${sd(506)}"]`).isEnabled(),true);
  await page.locator(`[name=sectionIds][value="${sd(501)}"]`).check();
  await page.locator('[name=privacyAccepted]').check();
  await Promise.all([page.waitForURL('**/scuole/conferma?**'),page.getByRole('button',{name:/Invia.*prenotazione/}).click()]).catch(async e=>{console.log({url:page.url(),text:(await page.locator('main').innerText()).slice(-1200),errors,calls:calls.slice(-12),invalid:await page.locator('input:invalid').evaluateAll(xs=>xs.map(x=>({name:x.name,value:x.value,reason:x.validationMessage})))});throw e;});
  assert.match(page.url(),/email=sent/);
  assert.equal(psql("select count(*) from school_bookings where school_name='Scuola browser' and student_count=8 and companion_count=1;",true).trim(),'1');
  assert.equal(psql("select count(*) from audit_logs where action='school_booking.confirmation_email_sent';",true).trim(),'1');
  console.log('PASS original school page -> Server Action -> local SQL reservation -> logged email with QR -> confirmation');
  // Same teacher, another real class in the same slot, through the original form.
  async function bookClass(className,students,companions) {
   await page.goto(base+'/scuole');await page.locator('[name=teacherFirstName]').waitFor();
   for(const [name,value] of Object.entries({teacherFirstName:'Ada',teacherLastName:'Docente',teacherEmail:'school-3@example.invalid',teacherPhone:'+3906000000',schoolName:'Scuola browser',schoolCity:'Roma',classDescription:className,studentCount:String(students),companionCount:String(companions)}))await page.locator(`[name=${name}]`).fill(value);
   await page.locator(`[name=sectionIds][value="${sd(506)}"]`).check();await page.locator('[name=privacyAccepted]').check();
   await Promise.all([page.waitForURL(url=>url.searchParams.has('email')||url.searchParams.has('error')),page.getByRole('button',{name:/Invia.*prenotazione/}).click()]);
  }
  await bookClass('3C',6,1);assert.match(page.url(),/email=sent/);
  assert.equal(psql("select count(*) from school_bookings where school_name='Scuola browser' and status='submitted';",true).trim(),'2');
  await bookClass('3 - b',3,2);assert.match(page.url(),/error=overlap/);
  assert.match(await page.locator('main').getByRole('alert').innerText(),/stessa fascia/);
  assert.equal(await page.getByRole('link',{name:'Accedi alle prenotazioni'}).getAttribute('href'),'/scuole/accesso');
  assert.equal(psql("select count(*) from school_bookings where school_name='Scuola browser' and status='submitted';",true).trim(),'2');
  assert.equal(psql("select count(*) from audit_logs where action='school_booking.confirmation_email_sent';",true).trim(),'2');
  assert.equal(errors.length,1);assert.match(errors.pop(),/overlap/);
  console.log('PASS browser: two classes with the same teacher book concurrent forums; duplicate class with changed counts rejected without email');
  const jwt=[{alg:'HS256',typ:'JWT'},{sub:sd(3),exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.synthetic';
  const session={access_token:jwt,refresh_token:'synthetic',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:sd(3),email:'school-3@example.invalid'}};
  await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:base},{name:'iscrizioni_last_activity',value:String(Date.now()),url:base}]);
  await page.goto(base+'/dashboard/docente');await page.getByRole('heading',{name:'Scuola browser'}).first().waitFor();
  const card=page.locator('article').filter({has:page.locator('[name=classDescription][value="3B"]')});
  assert.ok(await card.locator('img').count());assert.equal(await card.locator(`[name=sectionIds][value="${sd(506)}"]`).isDisabled(),true);assert.match(await card.innerText(),/Forum scuola 1/);
  await card.locator('[name=studentCount]').fill('7');await card.locator(`[name="students:${sd(501)}"]`).fill('7');
  await Promise.all([page.waitForURL('**saved=*'),card.getByRole('button',{name:'Salva modifiche'}).click()]);
  assert.equal(psql("select student_count from school_bookings where school_name='Scuola browser' and class_description='3B';",true).trim(),'7');
  await Promise.all([page.waitForURL('**cancelled=*'),card.getByRole('button',{name:'Annulla prenotazione'}).click()]);
  assert.equal(psql("select status from school_bookings where school_name='Scuola browser' and class_description='3B';",true).trim(),'cancelled');
  console.log('PASS original teacher page -> scoped metadata + QR -> edit -> cancellation, personal release remains internal');
  await context.clearCookies();await page.setViewportSize({width:390,height:844});await page.goto(base+'/scuole');await page.locator('[name=teacherFirstName]').waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  const createsBefore=calls.filter(x=>x.endsWith('/create_public_school_booking')).length;
  await page.locator(`[name=sectionIds][value="${sd(501)}"]`).check();
  assert.equal(await page.locator(`[name=sectionIds][value="${sd(506)}"]`).isDisabled(),true);
  await page.locator(`[name=sectionIds][value="${sd(501)}"]`).focus();await page.keyboard.press('Space');
  assert.equal(await page.locator(`[name=sectionIds][value="${sd(506)}"]`).isEnabled(),true);
  await page.locator(`[name=sectionIds][value="${sd(506)}"]`).check();
  assert.equal(await page.locator(`[name=sectionIds][value="${sd(501)}"]`).isDisabled(),true);
  assert.equal(calls.filter(x=>x.endsWith('/create_public_school_booking')).length,createsBefore);
  mkdirSync('/tmp/pace-school-proof',{recursive:true});await page.screenshot({path:'/tmp/pace-school-proof/mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/pace-school-proof/desktop.png',fullPage:true});
  await page.goto(base+'/');assert.equal(await page.locator('a[href="/scuole"]').count(),0);assert.equal(await page.locator('#schools').count(),0);
  assert.equal(psql('select get_panel_release_mode();',true).trim(),'internal');
  assert.deepEqual(errors,[]);assert.deepEqual(browserErrors,[]);
  console.log('PASS desktop/mobile, no school link on home, no browser errors, no production writes or real email');
 }finally{if(browser)await browser.close();app?.kill('SIGTERM');await new Promise(r=>adapter.close(r));closeSync(log);}
}
