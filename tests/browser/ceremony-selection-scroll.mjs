// Original workspace, synthetic view, no operational API calls or writes.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
const [base,root,fixture]=process.argv.slice(2);assert.match(base,/^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const route=`${root}/app/ceremony-scroll-check`;assert.ok(!existsSync(route));mkdirSync(route);
const {desk}=JSON.parse(readFileSync(fixture,'utf8'));
writeFileSync(`${route}/fixture.tsx`, `'use client';import {CeremonySeatsWorkspace} from '@/app/dashboard/ceremony-seats-workspace';import {parseOperationsDashboardFilters} from '@/lib/registrations/operations-dashboard';import type {SeatsDesk} from '@/lib/ceremonies/seats-desk';export default function Fixture({desk}:{desk:SeatsDesk}) {const people=Array.from({length:100},(_,i)=>({registrationId:'synthetic-'+i,name:'Participant '+i,code:'TEST'+i,place:'Synthetic place',group:'Synthetic group',priority:false,attendance:'Presenza da comunicare',children:[]}));return <main className="mx-auto max-w-6xl p-4"><CeremonySeatsWorkspace desk={desk} people={people} page={{page:1,pageCount:1,first:1,last:100,total:100}} filterProps={{dashboard:'manager',navMode:'mini',filters:parseOperationsDashboardFilters({}),groupOptions:[],eventServices:[],operationalTags:[]}} save={async()=>{throw Error('No writes in this fixture');}} revokeSeat={async()=>{throw Error('No writes in this fixture');}}/><section style={{height:400}}>Following content</section></main>;}`);
writeFileSync(`${route}/page.tsx`, `import Fixture from './fixture';export default function Page(){return <Fixture desk={${JSON.stringify(desk)}}/>;}`);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);let browser;
try {
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 for(const [width,height] of [[1440,1100],[1440,700],[390,844]]) {
  await page.setViewportSize({width,height});await page.emulateMedia({reducedMotion:'reduce'});
  for(const top of [120,height-130]) for(const nativeFocus of [true,false]) {
   await page.goto(`${base}/ceremony-scroll-check`,{waitUntil:'networkidle'});
   await page.getByRole('region',{name:'Piantina generale inaugurazione'}).getByRole('button',{name:/^Settore A1 · Blocco 1 · File /}).click();
   await page.waitForFunction(()=>{const el=document.querySelector('[aria-label="Dettaglio posti del settore"]');const top=el?.getBoundingClientRect().top;return document.activeElement===el && top>=80 && top<=115;});
   const chair=page.getByRole('button',{name:/^Settore A1 · Blocco 1 · Fila 10 · Sedia 1 ·/});
   await chair.evaluate((el,top)=>{el.scrollIntoView({block:'center',behavior:'instant'});const rect=el.getBoundingClientRect();window.scrollBy({top:rect.top-top,behavior:'instant'});document.activeElement?.blur();},top);
   await page.waitForTimeout(100);
   const snapshot=()=>chair.evaluate(el=>{const r=el.getBoundingClientRect(),scroller=el.closest('[role="region"]');return {y:scrollY,x:scrollX,top:r.top,innerY:scroller.scrollTop,innerX:scroller.scrollLeft};});
   const before=await snapshot();
   if(nativeFocus){const box=await chair.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);}else await chair.evaluate(el=>el.click());
   await page.getByRole('region',{name:'Scegli persone e familiari'}).waitFor();await page.waitForTimeout(300);
   const after=await snapshot();
   
   assert.equal(await chair.getAttribute('aria-pressed'),'true');
   for(const k of ['y','x','top','innerY','innerX'])assert.ok(Math.abs(after[k]-before[k])<=1,`first selection moved ${k}: ${JSON.stringify({before,after,width,height,top,nativeFocus})}`);
   const second=page.getByRole('button',{name:/^Settore A1 · Blocco 1 · Fila 10 · Sedia 2 ·/});
   await second.evaluate(el=>{el.focus({preventScroll:true});});await page.keyboard.press('Space');
   assert.equal(await second.getAttribute('aria-pressed'),'true');
   await page.waitForTimeout(100);const added=await snapshot();
   for(const k of ['y','x','top','innerY','innerX'])assert.ok(Math.abs(added[k]-before[k])<=1,`second selection moved ${k}`);
   await chair.evaluate(el=>el.click());await second.evaluate(el=>el.click());await page.waitForTimeout(100);
   const removed=await snapshot();for(const k of ['y','x','top','innerY','innerX'])assert.ok(Math.abs(removed[k]-before[k])<=1,`last deselection moved ${k}`);
   // Manual scrolling to the recipients stays available after selection.
   await chair.evaluate(el=>el.click());await page.mouse.move(width-8,Math.floor(height/2));await page.mouse.wheel(0,400);
   await page.waitForFunction(y=>scrollY>y+100,before.y);
   await page.getByRole('region',{name:'Scegli persone e familiari'}).getByLabel('Seleziona Participant 0',{exact:true}).check();
   assert.match(await page.getByRole('region',{name:'Riepilogo assegnazione'}).innerText(),/Participant 0/);
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS stable first selection and last deselection across desktop/mobile heights, page/map scroll and pointer/keyboard focus behavior; explicit block navigation and intentional recipient scrolling remain available');
}finally {await browser?.close();rmSync(route,{recursive:true,force:true});}
