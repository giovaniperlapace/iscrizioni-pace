import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {campaignBadgePreviews} from '../../lib/email/campaign-badge.server.ts';
import {CAMPAIGN_BADGE_TEMPLATES} from '../../lib/email/campaign-badge.ts';
const fixture='app/campaign-badge-check';
assert.ok(!existsSync(fixture));mkdirSync(fixture);
const recipient={recipientKey:'participant:ada',recipientType:'participant',fullName:'Ada Test',destinationEmail:'ada@example.invalid',deliveryKind:'direct',selected:true,groupIds:[],tagIds:[],serviceIds:[],panelIds:[],schoolNames:[]};
writeFileSync(fixture+'/page.tsx',`import {EmailCampaignComposer} from '@/app/dashboard/manager/email/email-campaign-composer';export default function Page(){return <main className="mx-auto max-w-6xl p-4"><EmailCampaignComposer groups={[]} tags={[]} services={[]} panels={[]} initialRecipients={${JSON.stringify([recipient])}} templates={[]} campaigns={[]}/></main>}`);
const allPreviews=await campaignBadgePreviews({badgeTemplates:CAMPAIGN_BADGE_TEMPLATES.map(template=>template.id)},{firstName:'Ada',lastName:'Test',groupName:'Roma'});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');let browser;
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage();const errors=[];page.on('pageerror',error=>(errors.push(error.message),console.error('PAGE ERROR',error.message)));let previewRequests=0,testRequests=0,sendRequests=0;let chosen=[];
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(!['127.0.0.1','localhost'].includes(url.hostname)) return route.abort();
  if(url.pathname==='/api/email-campaigns/reports')return route.fulfill({json:{campaigns:[],page:1,total:0}});
  if(url.pathname!=='/api/email-campaigns')return route.continue();
  const body=route.request().postData()||'';
  if(route.request().headers()['content-type'].includes('multipart')){
   previewRequests++;const ids=JSON.parse(body.match(/name="badgeTemplates"\r\n\r\n([^\r]+)/)[1]);assert.deepEqual(ids,chosen.map(template=>template.id));assert.match(body,/programma.txt/);
   return route.fulfill({json:{campaignId:'campaign',recipientCount:1,directCount:1,delegatedCount:0,leaderCount:0,teacherCount:0,testRecipientEmail:'manager@example.invalid',sampleRecipientName:'Ada Test',previewSubject:'Invito Ada',previewHtml:'<p>Ciao Ada</p>',recipients:[recipient],attachments:[{fileName:'programma.txt',contentType:'text/plain',sizeBytes:9,inline:false}],badgePreviews:allPreviews.filter(preview=>ids.includes(preview.templateId))}});
  }
  const data=JSON.parse(body);if(data.action==='test'){testRequests++;return route.fulfill({json:{ok:true}});}sendRequests++;throw new Error('Unexpected final send');
 });
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:950});await page.goto('http://localhost:3159/campaign-badge-check');
  chosen=width===320?[CAMPAIGN_BADGE_TEMPLATES[1]]:width===390?[CAMPAIGN_BADGE_TEMPLATES[2]]:[...CAMPAIGN_BADGE_TEMPLATES];
  for(const template of CAMPAIGN_BADGE_TEMPLATES) assert.equal(await page.getByRole('checkbox',{name:template.label,exact:true}).isChecked(),false);
  const checkbox=page.getByRole('checkbox',{name:chosen[0].label,exact:true});
  await page.getByLabel('Oggetto',{exact:true}).fill('Invito {{nome}}');await page.locator('[contenteditable=true]').fill('Ciao {{nome}}');
  await page.getByRole('checkbox',{name:'Seleziona Ada Test',exact:true}).check();
  await page.locator('input[type=file]').setInputFiles({name:'programma.txt',mimeType:'text/plain',buffer:Buffer.from('programma')});
  for(const template of chosen) await page.getByRole('checkbox',{name:template.label,exact:true}).check();
  await checkbox.scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/campaign-badge-options-${width}.png`});
  await page.getByRole('button',{name:/Prepara.*anteprima|Crea.*anteprima|Controlla.*anteprima|Mostra.*anteprima/}).click();
  const dialog=page.getByRole('dialog',{name:'Anteprima prima dell’invio'});await dialog.waitFor();
  assert.equal(await dialog.getByRole('img').count(),chosen.length);
  for(const template of chosen){
   const img=dialog.getByRole('img',{name:`Badge ${template.label} di Ada Test`});await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());
   assert.ok(await img.evaluate(el=>el.naturalWidth===941));
   await page.screenshot({path:`/tmp/campaign-badge-${template.id}-${width}.png`});
   const [download]=await Promise.all([page.waitForEvent('download'),dialog.getByRole('link',{name:`Scarica PDF · ${template.label}`,exact:true}).click()]);
   assert.equal(download.suggestedFilename(),`${template.fileStem}.pdf`);
  }
  await dialog.getByRole('button',{name:/1\. Invia la prova/}).click();await dialog.getByText('Email di prova inviata',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Chiudi anteprima'}).click();
  await checkbox.uncheck();assert.equal(await page.getByRole('dialog').count(),0);await checkbox.check();
  await page.getByRole('tab',{name:/Capigruppo/}).click();for(const template of CAMPAIGN_BADGE_TEMPLATES){const check=page.getByRole('checkbox',{name:template.label,exact:true});assert.equal(await check.isChecked(),false);assert.equal(await check.isDisabled(),true);}
  assert.ok(await page.getByText('programma.txt',{exact:true}).count());
  console.log('PASS',width,'optional badge, ordinary attachment, inline preview, PDF download, test, reset and audience');
 }
 assert.equal(previewRequests,3);assert.equal(testRequests,3);assert.equal(sendRequests,0);assert.deepEqual(errors,[]);
}finally{await browser?.close();rmSync(fixture,{recursive:true,force:true});}
