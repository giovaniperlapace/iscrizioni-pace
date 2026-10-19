// Run in a disposable copy without .env files. No operational writes or printing.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import ts from 'typescript';
import QRCode from 'qrcode';
const base=process.argv[2]??'http://localhost:3187';
assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
assert.ok(!existsSync('.env.local'));
const original=new Map();
function replace(path,source){if(!original.has(path))original.set(path,readFileSync(path,'utf8'));writeFileSync(path,source);}
for(const dashboard of ['manager','admin']) replace(`app/dashboard/${dashboard}/page.tsx`,`import Fixture from '@/tests/browser/participant-sheet-loading-fixture';export default function Page(props:{searchParams:Promise<Record<string,string>>}){return <Fixture {...props} dashboard="${dashboard}"/>;}`);
const actionPath='app/dashboard/operational-registration-actions.ts';
const source=readFileSync(actionPath,'utf8'), ast=ts.createSourceFile(actionPath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
let patched=source;
for(const node of [...ast.statements].reverse()) if(ts.isFunctionDeclaration(node)&&['getOperationalDemographics','getOperationalAssociation','getOperationalAccessibility'].includes(node.name?.text)) {
 const kind=node.name.text.replace('getOperational','').toLowerCase();
 patched=patched.slice(0,node.body.pos)+` { return (await fetch('http://127.0.0.1:55490/${kind}?id='+registrationId,{cache:'no-store'})).json(); }`+patched.slice(node.end);
}
replace(actionPath,patched);
replace('app/dashboard/participants/reception-actions.ts',`"use server";
export async function participantReceptionCommand(eventId:string,registrationId:string,input:unknown){return (await fetch('http://127.0.0.1:55490/reception?id='+registrationId,{method:'POST',body:JSON.stringify(input),cache:'no-store'})).json();}
export async function participantLabelCommand(registrationId:string,input:unknown){return (await fetch('http://127.0.0.1:55490/labels?id='+registrationId,{method:'POST',body:JSON.stringify(input),cache:'no-store'})).json();}`);
const calls=[], gates=new Map();let failAssociation=false, browser;
function hold(kind){let release;const promise=new Promise(r=>release=r);gates.set(kind,{promise,release});}
function release(kind){gates.get(kind)?.release();gates.delete(kind);}
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost'),kind=url.pathname.slice(1),id=url.searchParams.get('id');
 let body='';for await(const chunk of req)body+=chunk;
 calls.push({kind,id,action:body?JSON.parse(body).action:null});
 await gates.get(kind)?.promise;
 const snapshot=kind==='demographics'?{nationality:'IT',birthPlace:'Italia',country:'Italia',questionnaireId:null,countryId:null,countryOther:null}:kind==='association'?{association:'Associazione sintetica',questionnaireId:null}:null;
 const result=kind==='labels'?{status:'queue',snapshot:'synthetic',items:[{registrationId:id,name:'Persona Test',code:'AT01',attempts:0,reason:null}]}:kind==='reception'?{status:'valid',kind:'family',code:id.endsWith('0')?'AT01':'BT01',revision:0,outcome:'verified',registrationStatus:'confirmed',persons:[{id,kind:'adult',firstName:id.endsWith('0')?'Anna':'Bruno',lastName:'Test',checkedInAt:null}]}:failAssociation&&kind==='association'?{status:'error'}:{status:'success',snapshot};
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
});
try{
 await new Promise(r=>server.listen(55490,'127.0.0.1',r));
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const image=await QRCode.toDataURL('synthetic-participant-qr');
 for(const dashboard of ['manager','admin']){
  const page=await browser.newPage({viewport:{width:dashboard==='admin'?390:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();
  let qrRequests=0,qrGate=null,failQr=false,attendanceGate=null;
  await page.route('**/api/auth/activity',r=>r.fulfill({json:{}}));
  await page.route('**/dashboard/participants/qr?*',async r=>{qrRequests++;await qrGate;await r.fulfill(failQr?{status:503,json:{}}:{json:{qr:{state:'active',dataUrl:image,downloadDataUrl:image,expiresAt:null}}}).catch(()=>{});});
  await page.route('**/dashboard/participants/attendance?*',async r=>{await attendanceGate;await r.fulfill({json:{attendance:{startsOn:'2026-10-25',endsOn:'2026-10-27',unknown:true,slots:[]}}}).catch(()=>{});});
  await page.route('**/dashboard/attendance?*',r=>r.fulfill({json:{eventId:'event',updatedAt:new Date().toISOString(),entries:{},schoolEntries:{},totals:{people:0,adults:0,children:0,students:0,companions:0,schoolBookings:0}}}));
  const start=`${base}/dashboard/${dashboard}?section=iscritti&nav=mini&columns=name`;
  const dialog=page.getByRole('dialog'),name=page.getByRole('link',{name:'Anna Test',exact:true});
  const opened=()=>page.waitForFunction(()=>document.querySelector('dialog')?.getAttribute('aria-busy')==='false');
  const closed=()=>dialog.waitFor({state:'detached'});
  const close=async()=>{await page.getByLabel('Chiudi scheda partecipante').click();await closed();};
  const unavailable=async()=>{assert.equal(await dialog.locator('input[name=firstName]').first().isVisible(),false);assert.equal(await dialog.getByRole('button',{name:'Conferma partecipazione',exact:true}).isVisible(),false);};
  const before=calls.length;await page.goto(start);await name.waitFor();await page.waitForTimeout(250);assert.equal(qrRequests,0);assert.equal(calls.length,before);
  let finishQr;qrGate=new Promise(r=>finishQr=r);await name.click();await dialog.getByText('Caricamento scheda partecipante…',{exact:true}).waitFor();
  const closePosition=await page.getByLabel('Chiudi scheda partecipante').boundingBox();
  await unavailable();await page.waitForTimeout(700);await unavailable();
  finishQr();qrGate=null;await opened();assert.equal(await dialog.locator('input[name=firstName]').first().inputValue(),'Anna');
  assert.equal(await dialog.locator('input[name=association]').inputValue(),'Associazione sintetica');
  assert.equal(await dialog.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
  assert.deepEqual(await page.getByLabel('Chiudi scheda partecipante').boundingBox(),closePosition,'close control must not move on reveal');
  const position=await dialog.getByRole('button',{name:'Conferma partecipazione',exact:true}).boundingBox();await page.waitForTimeout(400);
  assert.deepEqual(await dialog.getByRole('button',{name:'Conferma partecipazione',exact:true}).boundingBox(),position);
  await dialog.locator('input[name=firstName]').first().fill('Bozza conservata');await page.getByRole('button',{name:'Aggiorna presenze',exact:true}).evaluate(el=>el.click());
  assert.equal(await dialog.locator('input[name=firstName]').first().inputValue(),'Bozza conservata');assert.equal(await dialog.getAttribute('aria-busy'),'false');
  await page.screenshot({path:`/tmp/pace-sheet-ready-${dashboard}.png`});await close();
  // Every independently loaded section must hold the complete sheet back.
  for(const kind of ['reception','labels','demographics','association','accessibility']){
   hold(kind);await name.click();await dialog.getByText('Caricamento scheda partecipante…',{exact:true}).waitFor();
   await page.waitForTimeout(350);await unavailable();release(kind);await opened();await close();
  }
  let finishAttendance;attendanceGate=new Promise(r=>finishAttendance=r);await name.click();await page.waitForTimeout(350);await unavailable();finishAttendance();attendanceGate=null;await opened();await close();
  // Close during QR loading, open another identity, then finish the obsolete read.
  let lateQr;qrGate=new Promise(r=>lateQr=r);await name.click();await dialog.getByText('Caricamento scheda partecipante…',{exact:true}).waitFor();await close();qrGate=null;
  await page.getByRole('link',{name:'Bruno Test',exact:true}).click();await opened();lateQr();assert.equal(await dialog.locator('input[name=firstName]').first().inputValue(),'Bruno');await close();
  failQr=true;failAssociation=true;await name.click();await opened();await dialog.getByText('Impossibile caricare il QR.',{exact:true}).waitFor();await dialog.getByText(/Impossibile caricare l’associazione/).waitFor();
  assert.equal(await dialog.locator('input[name=firstName]').first().isVisible(),true);failQr=false;failAssociation=false;await close();
  // A stalled read has a bounded wait and explicit retry; hidden fields cannot receive focus.
  let stalled;qrGate=new Promise(r=>stalled=r);await name.click();await dialog.getByText('Caricamento scheda partecipante…',{exact:true}).waitFor();
  await page.screenshot({path:`/tmp/pace-sheet-loading-${dashboard}.png`});
  await page.clock.fastForward(26_000);
  await page.getByRole('button',{name:'Riprova caricamento',exact:true}).waitFor();await unavailable();
  qrGate=null;await page.getByRole('button',{name:'Riprova caricamento',exact:true}).click();await opened();stalled();await close();
  const after=calls.length,afterQr=qrRequests;await page.goto(start+'&viewer=1&children=1');await name.click();await opened();assert.equal(calls.length,after);assert.equal(qrRequests,afterQr);assert.equal(await dialog.locator('input[name=firstName]').first().isDisabled(),true);await close();
  await page.goto(start+'&deleted=1');await name.click();await opened();assert.equal(calls.length,after);assert.equal(qrRequests,afterQr);await close();
  assert.ok(calls.every(c=>!c.action||['inspect','read'].includes(c.action)),'Opening must never register attendance');assert.deepEqual(errors,[]);
  console.log(`PASS ${dashboard}: no preload, all sections revealed together, stable controls, image decoded, close/stale reads, errors/retry, timeout, drafts, viewer and deleted registrations`);
  await page.close();
 }
}finally{
 for(const kind of gates.keys())release(kind);
 await browser?.close();await new Promise(r=>server.close(r));
 for(const [path,source] of original)writeFileSync(path,source);
}
