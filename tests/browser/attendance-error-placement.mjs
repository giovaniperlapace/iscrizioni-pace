import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.BASE_URL??'http://localhost:3130';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw Error('Local server required');
const route=new URL('../../app/attendance-error-check/',import.meta.url);
if(existsSync(route))throw Error('Fixture route already exists');
const ab=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','pace-attendance-error',...args],{encoding:'utf8',timeout:60000});
const check=(expr)=>assert.equal(ab('eval',expr).trim(),'true');
try {
 mkdirSync(route);
 writeFileSync(new URL('page.tsx',route),readFileSync(new URL('./required-registration-fields-fixture.tsx',import.meta.url),'utf8').replace('eventDays={[]}',`eventDays={[{day:'2026-10-24',label:'24 Oct',parts:['afternoon']},{day:'2026-10-25',label:'25 Oct',parts:['morning','afternoon']}]}`));
 for(const locale of ['it','en','fr','de','es','nl','uk'])for(const role of ['capogruppo','manager']){
  ab('open',`${base}/attendance-error-check?locale=${locale}&role=${role}`);ab('snapshot','-i');
  ab('eval',`window.cellSizes=[...document.querySelectorAll('[name=availabilitySlots]')].map(el=>[el.closest('label').offsetWidth,el.closest('label').offsetHeight])`);
  ab('click','button[type=submit]');
  check(`(()=>{const group=document.querySelector('[data-form-error-group]');const error=group.querySelector('[data-form-error]');return error?.parentElement===group && group.lastElementChild===error && !group.querySelector('label [data-form-error]') && [...group.querySelectorAll('input')].every(el=>el.getAttribute('aria-describedby')?.includes(error.id)) && JSON.stringify(window.cellSizes)===JSON.stringify([...group.querySelectorAll('[name=availabilitySlots]')].map(el=>[el.closest('label').offsetWidth,el.closest('label').offsetHeight]));})()`);
  ab('set','viewport','390','844');
  check(`(()=>{const group=document.querySelector('[data-form-error-group]');const error=group.querySelector('[data-form-error]');return error.getBoundingClientRect().top>=group.querySelector('[name=availabilityUnknown]').closest('label').getBoundingClientRect().bottom;})()`);
  if(locale==='it'&&role==='manager'){ab('eval',"document.querySelector('[data-form-error-group]').scrollIntoView()");ab('screenshot','/tmp/pace-attendance-error-mobile.png');}
  ab('check','[name=availabilitySlots]');ab('click','button[type=submit]');
  check(`!document.querySelector('[data-form-error-group] [data-form-error]')`);
  ab('uncheck','[name=availabilitySlots]');ab('check','[name=availabilityUnknown]');ab('click','button[type=submit]');
  check(`!document.querySelector('[data-form-error-group] [data-form-error]')`);
  ab('set','viewport','1280','900');console.log('PASS '+locale+' '+role+': error outside grid, unchanged cells, accessible message, both choices valid');
 }
 assert.equal(ab('errors').trim(),'');
}finally{ab('close');rmSync(route,{recursive:true,force:true});}
