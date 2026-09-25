import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.BASE_URL??'http://localhost:3130';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw Error('Local server required');
const route=new URL('../../app/email-delegation-check/',import.meta.url);
const ab=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','pace-email-indicator',...args],{encoding:'utf8',timeout:60000});
try{
 mkdirSync(route,{recursive:true});writeFileSync(new URL('page.tsx',route),'export { default } from "@/tests/browser/email-delegation-fixture";');
 for(const locale of ['it','en','fr','de','es','nl','uk']){
  ab('open',`${base}/email-delegation-check?locale=${locale}&columns=name,email`);ab('snapshot','-i');
  assert.equal(ab('eval',`[...document.querySelectorAll('[data-table]')].every(section=>{const rows=[...section.querySelectorAll('tbody tr')];return rows.length===3 && rows[0].cells[1].querySelector('span[title]') && rows[1].cells[1].textContent.trim()==='—' && rows[2].cells[1].textContent.trim()==='personal@example.test' && !rows[2].cells[1].querySelector('span[title]');})`).trim(),'true');
  console.log('PASS '+locale+': all three tables distinguish delegation, missing email, personal email');
  if(locale==='it'){
   assert.equal(ab('eval',`(async()=>{
    const section=document.querySelector('[data-table=capogruppo]');
    const button=section.querySelector('button:has(svg.lucide-download)');
    const fetch=window.fetch;
    window.fetch=async(input,...args)=>new URL(String(input),location.origin).pathname==='/dashboard/capogruppo/export'
      ? (await new Promise(r=>setTimeout(r,1000)),new Response('synthetic',{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}}))
      : fetch(input,...args);
    try {
     button.click();await new Promise(r=>setTimeout(r,300));
     const overlay=button.querySelector('.button-progress-overlay');
     const pending=button.disabled && overlay?.dataset.state==='pending'
       && getComputedStyle(overlay).opacity==='0.25' && getComputedStyle(button).cursor!=='wait'
       && section.querySelector('tbody span[title]');
     await new Promise(r=>setTimeout(r,1200));
     return Boolean(pending && !button.disabled && overlay.dataset.state==='idle');
    } finally {window.fetch=fetch;}
   })()`).trim(),'true');
   console.log('PASS email indicator and approved export loading overlay coexist');
  }

  ab('set','viewport','390','844');assert.equal(ab('eval',"[...document.querySelectorAll('[data-table] tbody span[title]')].every(el=>el.getBoundingClientRect().width<=224)").trim(),'true');
  if(locale==='it')ab('screenshot','--full','/tmp/pace-email-indicator-mobile.png');
  ab('set','viewport','1280','900');
 }
 assert.equal(ab('errors').trim(),'');console.log('PASS desktop/mobile, seven languages, no browser errors or writes');
}finally{ab('close');rmSync(route,{recursive:true,force:true});}
