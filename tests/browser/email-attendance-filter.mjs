import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:3164';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const route='app/email-attendance-check';assert.ok(!existsSync(route));mkdirSync(route);
writeFileSync(`${route}/page.tsx`, `import {EmailCampaignComposer} from '@/app/dashboard/manager/email/email-campaign-composer';
const people=[['Ada Assente',true],['Bruno In Attesa',true],['Carla Confermata',false],['Dario Comunicato',false]] as const;
const recipients=people.map(([fullName,attendancePending],i)=>({recipientKey:'p'+i,recipientType:'participant' as const,fullName,destinationEmail:'test'+i+'@example.invalid',deliveryKind:'direct' as const,selected:false,groupIds:i===0?['g']:[],tagIds:[],serviceIds:[],panelIds:[],schoolNames:[],attendancePending}));
export default function Page(){return <EmailCampaignComposer groups={[{id:'g',label:'Gruppo Test'}]} tags={[]} services={[]} panels={[]} initialRecipients={[...recipients,{recipientKey:'leader',recipientType:'group_leader',fullName:'Capogruppo Test',destinationEmail:'leader@example.invalid',deliveryKind:'leader',selected:false,groupIds:['g'],tagIds:[],serviceIds:[],panelIds:[],schoolNames:[]}]} templates={[]} campaigns={[]}/>;}`);
let browser;
try {
 const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const mutations=[];page.on('request',request=>{if(request.method()==='POST')mutations.push(request.url());});
  await page.goto(base+'/email-attendance-check');
  const filter=page.locator('#campaign-attendance-filter');
  await filter.selectOption('pending');
  assert.equal(await page.getByRole('checkbox',{name:/^Seleziona (Ada|Bruno)/}).count(),2);
  assert.equal(await page.getByRole('checkbox',{name:/^Seleziona (Carla|Dario)/}).count(),0);
  await page.getByRole('checkbox',{name:'Seleziona tutte le 2 persone filtrate',exact:true}).check();
  assert.equal(await page.getByRole('checkbox',{name:/^Seleziona (Ada|Bruno)/,checked:true}).count(),2);
  await page.getByLabel('Cerca partecipante',{exact:true}).fill('Ada');
  assert.equal(await page.getByRole('checkbox',{name:/^Seleziona (Ada|Bruno)/}).count(),1);
  await page.getByLabel('Cerca partecipante',{exact:true}).fill('');
  await filter.selectOption('communicated');
  assert.equal(await page.getByRole('checkbox',{name:/^Seleziona (Carla|Dario)/}).count(),2);
  assert.equal(await page.getByRole('checkbox',{name:/^Seleziona (Ada|Bruno)/}).count(),0);
  await filter.selectOption('all');
  assert.equal(await page.getByRole('checkbox',{name:/^Seleziona (Ada|Bruno|Carla|Dario)/}).count(),4);
  await page.getByRole('tab',{name:'Capigruppo',exact:true}).click();
  assert.equal(await filter.count(),0);assert.equal(await page.getByRole('checkbox',{name:'Seleziona Capogruppo Test',exact:true}).count(),1);
  await page.getByRole('tab',{name:'Partecipanti',exact:true}).click();
  assert.equal(await filter.inputValue(),'all');
  await filter.selectOption('pending');
  await filter.scrollIntoViewIfNeeded();
  await page.screenshot({path:`/tmp/pace-email-attendance-${width}.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);assert.deepEqual(mutations,[]);
  await page.close();console.log('PASS attendance filter, search, selection and audience reset '+width);
 }
} finally {await browser?.close();rmSync(route,{recursive:true,force:true});}
