import assert from 'node:assert/strict';
import {copyFileSync,mkdirSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.BASE_URL??'http://localhost:3124';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw Error('Local server required');
const route=new URL('../../app/required-fields-check/',import.meta.url);
const publicRoute=new URL('../../app/required-fields-public-check/',import.meta.url);
const ab=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','pace-required-fields',...args],{encoding:'utf8',timeout:60000});
const check=(expr,label)=>{assert.equal(ab('eval',`Boolean(${expr})`).trim(),'true',label);console.log('PASS '+label);};
const date=value=>ab('eval',`(()=>{const el=document.querySelector('[name=birthDate]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
try {
  mkdirSync(route,{recursive:true});mkdirSync(publicRoute,{recursive:true});
  copyFileSync(new URL('./required-registration-fields-fixture.tsx',import.meta.url),new URL('page.tsx',route));
  copyFileSync(new URL('./group-questionnaire-fixture.tsx',import.meta.url),new URL('page.tsx',publicRoute));
  for(const locale of (process.env.PUBLIC_ONLY ? [] : ['it','en','fr','de','es','nl','uk']))for(const role of ['capogruppo','manager']){
    ab('open',`${base}/required-fields-check?locale=${locale}&role=${role}`);ab('snapshot','-i');
    check("document.querySelector('[name=cityOther]').required && document.querySelector('[name=birthDate]').required",locale+' '+role+' required controls');
    ab('fill','[name=firstName]','Synthetic');ab('fill','[name=lastName]','Person');
    ab('check','[name=useLeaderEmail]');ab('check','[name=availabilityUnknown]');ab('check','[name=consentConfirmed]');
    ab('click','button[type=submit]');
    check("document.activeElement.name==='birthDate' && !document.querySelector('[data-saved]').textContent",'empty birth date rejected');
    date('1990-01-02');ab('click','button[type=submit]');
    check("document.activeElement.name==='cityOther' && !document.querySelector('[data-saved]').textContent",'empty city rejected with focus');
    ab('fill','[name=cityOther]','   ');ab('click','button[type=submit]');
    check("document.querySelector('[name=cityOther]').getAttribute('aria-invalid')==='true' && document.querySelector('[name=firstName]').value==='Synthetic'",'whitespace city rejected; values retained');
    if(locale==='de')check("document.body.innerText.includes('Wohnort') && document.body.innerText.includes('Füllen Sie dieses Feld aus.')",'German field and validation');
    ab('fill','[name=cityOther]','Würzburg');ab('click','button[type=submit]');
    ab('wait','--fn',"document.querySelector('[data-saved]').textContent.includes('Würzburg')");
    check("JSON.parse(document.querySelector('[data-saved]').textContent).birthDate==='1990-01-02'",'valid city and date reach synthetic action');
    ab('set','viewport','390','844');check('document.documentElement.scrollWidth<=innerWidth','manual mobile fits');ab('set','viewport','1280','900');
  }
  for(const link of ['', '1']){
    ab('open',`${base}/required-fields-public-check?locale=de&link=${link}`);ab('snapshot','-i');
    ab('fill','[data-field=country]','Deutschland');ab('snapshot','-i');
    ab('find','role','button','click','--name','Deutschland','--exact');ab('snapshot','-i');
    check("document.querySelector('[data-field=city]').required && document.querySelector('[data-field=city]').validity.valueMissing",'German public/group-link empty city blocked');
    check("document.querySelector('[name=birthDate]').required && document.querySelector('[name=birthDate]').validity.valueMissing",'German public/group-link empty birth blocked');
    date('2999-01-01');check("document.querySelector('[name=birthDate]').validity.rangeOverflow",'future birth blocked');
    ab('set','viewport','390','844');check('document.documentElement.scrollWidth<=innerWidth','public mobile fits');
    ab('screenshot',`/tmp/pace-required-public-de-${link||'public'}.png`);ab('set','viewport','1280','900');
  }
  assert.equal(ab('errors').trim(),'');console.log('PASS no browser errors; no real registrations or email');
}finally{ab('close');for(const path of [route,publicRoute])rmSync(path,{recursive:true,force:true});}
