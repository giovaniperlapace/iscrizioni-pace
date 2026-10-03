import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,mkdirSync,rmSync} from 'node:fs';
const base=process.argv[2]??'http://localhost:3119';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw Error('Local only');
const route=new URL('../../app/main-dashboard-fixes-check/',import.meta.url);
mkdirSync(route,{recursive:true});copyFileSync(new URL('./main-dashboard-fixes-fixture.tsx',import.meta.url),new URL('page.tsx',route));
const ab=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','main-dashboard-fixes',...args],{encoding:'utf8',timeout:60000});
const check=(code,label)=>{assert.equal(ab('eval',`Boolean(${code})`).trim(),'true',label);console.log('PASS '+label);};
try{
 for(const [width,height] of [[1280,900],[390,844]]) {
  ab('set','viewport',String(width),String(height));ab('open',base+'/main-dashboard-fixes-check');ab('snapshot','-i');
  check(`document.querySelector('[role=combobox]').value==='Italia'`,'localized nationality');
  ab('click','[role=combobox]');ab('snapshot','-i');
  check(`document.querySelectorAll('[role=option]').length>200 && document.querySelector('[name=nationality]').value==='Italian (Italy)'`,'focus opens full catalog and preserves saved selection');
  ab('fill','[role=combobox]','Germania');ab('snapshot','-i');ab('find','role','option','click','--name','Germania','--exact');
  check(`document.querySelector('[name=nationality]').value==='German (Germany)' && document.querySelector('[role=combobox]').value==='Germania'`,'localized search selects canonical answer');
  ab('fill','[type=search]','rossi jose');ab('snapshot','-i');ab('find','role','button','click','--name','José Rossi jose@example.test');
  check(`document.querySelector('[name=existingUserId]').value==='a'`,'reversed name and accents search');
  ab('click','[type=search]');ab('fill','[type=search]','AB12');ab('snapshot','-i');
  check(`document.body.textContent.includes('José Rossi')`,'participant code search');
  ab('click','h1');ab('find','role','button','click','--name','Simula risposta email');ab('snapshot','-i');
  check(`(()=>{const r=document.querySelector('[role=status]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()`,'email result brought into view from bottom of page');
  check(`document.documentElement.scrollWidth<=innerWidth`,'no horizontal overflow');
  ab('screenshot',`/tmp/pace-main-fixes-${width}.png`);
 }
 assert.equal(ab('errors').trim(),'');
}finally{ab('close');rmSync(route,{recursive:true,force:true});rmSync(new URL('../../.next/dev/types/app/main-dashboard-fixes-check/',import.meta.url),{recursive:true,force:true});}
