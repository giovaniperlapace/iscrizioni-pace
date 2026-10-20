import {mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const path='app/campaign-report-check';assert.ok(!existsSync(path));mkdirSync(path);
writeFileSync(path+'/page.tsx',`import {CampaignHistory} from '@/app/dashboard/manager/email/campaign-history';export default function Page(){return <main className="mx-auto w-full min-w-0 max-w-6xl p-4"><CampaignHistory/></main>}`);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');let browser;
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let posts=0;let reject=false;
 const campaign={id:'11111111-1111-4111-8111-111111111111',name:'Campagna di prova',date:'2026-10-19T08:40:00Z',recipientCount:104,status:'partial'};
 const recipients=Array.from({length:104},(_,i)=>({id:`row-${i}`,name:`Persona ${i}`,email:`test${i}@example.invalid`,snapshot:true,code:i===0?'bounced':i===1?'unknown':'delivered',label:i===0?'Non recapitata':i===1?'Esito da verificare':'Consegnata al server',reason:'',sentAt:campaign.date,deliveredAt:i>1?campaign.date:null,retryable:i===0,retryCampaignId:null}));
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='localhost')return route.abort();if(url.pathname!=='/api/email-campaigns/reports')return route.continue();if(route.request().method()==='POST'){posts++;return route.fulfill({status:400,json:{error:'Verifica del servizio non disponibile. Nessun nuovo reinvio confermato: aggiorna il report.'}});}if(reject)return route.fulfill({status:403,json:{error:'Accesso non consentito.'}});return route.fulfill({json:url.searchParams.has('campaign')?{campaign,counts:{bounced:1,unknown:1,delivered:102},recipients}:{campaigns:[campaign],page:1,total:1}});});
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:950});await page.goto('http://localhost:3148/campaign-report-check');await page.getByRole('button',{name:'Dettagli',exact:true}).click();
  await page.getByText('Non recapitate:',{exact:false}).waitFor();assert.equal(await page.getByRole('checkbox').count(),1);
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Destinatari successivi'}).click();await page.getByText('Persona 103',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Destinatari precedenti'}).click();assert.ok(await page.getByRole('checkbox').isChecked());
  await page.getByLabel('Cerca nome o email').fill('Persona 103');assert.equal(await page.getByRole('row').count(),4);await page.getByLabel('Cerca nome o email').fill('');
  await page.getByRole('button',{name:'Prepara reinvio (1)',exact:true}).click();assert.equal(posts,width===390?0:1);await page.getByRole('button',{name:'Conferma reinvio',exact:true}).click();await page.locator('p[role=alert]').waitFor();
  await page.getByRole('button',{name:'Annulla',exact:true}).click();assert.ok(await page.getByRole('checkbox').isChecked());await page.screenshot({path:`/tmp/campaign-report-${width}.png`,fullPage:false});if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width})).slice(0,12)));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/campaign-report-${width}.png`,fullPage:false});console.log('PASS',width,'report, filters, pagination, selection, explicit confirmation, failure preservation, no horizontal page overflow');
 }
 reject=true;await page.getByRole('button',{name:'Aggiorna report'}).click();await page.locator('p[role=alert]').waitFor();assert.equal(await page.getByRole('checkbox').count(),0);assert.equal(posts,2);assert.deepEqual(errors,[]);
}finally{await browser?.close();rmSync(path,{recursive:true,force:true});}
