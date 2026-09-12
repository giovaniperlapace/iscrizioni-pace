// Synthetic UI only; actual persistence/RLS/concurrency are checked by the SQL runner.
import { execFileSync } from 'node:child_process';
import { copyFileSync,mkdirSync,rmSync } from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://localhost:3111';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Local server required');
const route=new URL('../../app/reception-check/',import.meta.url);
mkdirSync(route,{recursive:true});copyFileSync(new URL('./reception-fixture.tsx',import.meta.url),new URL('page.tsx',route));
const ab=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','pace-p11',...args],{encoding:'utf8',timeout:60000});
const check=(code,label)=>{assert.match(ab('eval',`Boolean(${code})`),/true/,label);console.log(`PASS ${label}`);};
const settle=()=>ab('wait','--fn','!document.querySelector("button[aria-busy=true]")');
const snap=()=>ab('snapshot','-i');
const open=()=>{ab('open',`${base}/reception-check`);snap();};
try {
  ab('open',base);snap();check('document.body.innerText.length>0 && !document.querySelector("[data-nextjs-dialog]")','home renders without overlay');
  open();
  ab('fill','input[type=text]','TEST');ab('click','button[type=submit]');settle();snap();
  check('document.querySelectorAll("input[name=presentSubjects]").length===2 && document.querySelectorAll("input[type=checkbox]:checked").length===0','family is never presumed present');
  ab('check','input[value="22222222-2222-4222-8222-222222222222"]');
  ab('click','form:nth-of-type(2) button[type=submit]');settle();snap();
  check('document.body.innerText.includes("Presente dal") && document.body.innerText.includes("Ingresso non registrato")','partial family persists in UI');
  ab('screenshot','/tmp/pace-p11-desktop.png','--full');
  ab('click','button[aria-label="Chiudi messaggio"]');snap();
  ab('select','select[name=operation]','correct');snap();
  check('document.querySelector("form:nth-of-type(2) button[type=submit]").disabled','correction requires confirmation');
  ab('uncheck','input[value="22222222-2222-4222-8222-222222222222"]');ab('check','input[value="11111111-1111-4111-8111-111111111111"]');
  ab('check','input[name=confirmCorrection]');snap();ab('find','role','button','click','--name','Correggi presenze');settle();snap();
  check('JSON.parse(document.querySelector("[data-operations]").textContent)[1]?.action==="correct"', 'correction command submitted');
  ab('click','button[aria-label="Chiudi messaggio"]');snap();
  ab('select','select[name=operation]','cancel');ab('check','input[name=confirmCorrection]');
  ab('click','form:nth-of-type(2) button[type=submit]');settle();snap();
  check('!document.body.innerText.includes("Presente dal")','explicit cancellation updates presence');
  ab('fill','input[type=text]','NOPE');ab('click','form:nth-of-type(1) button[type=submit]');settle();snap();
  check('!!document.querySelector("[role=alert]") && !document.body.innerText.includes("Anna Bianchi")','invalid lookup clears previous identity');
  open();ab('select','main>label select','uncertain');ab('fill','input[type=text]','TEST');ab('click','button[type=submit]');settle();snap();
  ab('check','input[value="11111111-1111-4111-8111-111111111111"]');ab('click','form:nth-of-type(2) button[type=submit]');settle();snap();
  check('document.querySelector("input[type=text]").matches(":disabled")','uncertain outcome freezes original request');
  ab('find','role','button','click','--name','Riprova la stessa operazione');settle();snap();
  check('(()=>{const r=JSON.parse(document.querySelector("[data-requests]").textContent);return r.length===2&&r[0]===r[1]})()','retry keeps exact request ID');
  open();ab('select','main>label select','conflict');ab('fill','input[type=text]','TEST');ab('click','button[type=submit]');settle();snap();
  ab('check','input[value="11111111-1111-4111-8111-111111111111"]');ab('click','form:nth-of-type(2) button[type=submit]');settle();snap();
  check('document.body.innerText.includes("Un altro operatore") && document.querySelector("form:nth-of-type(2) fieldset").disabled','conflict requires a fresh verification');
  ab('set','viewport','390','844');open();
  ab('select','select[name=lookupKind]','qr');ab('fill','input[type=password]','a'.repeat(43));ab('click','button[type=submit]');settle();snap();
  check('Array.from(document.querySelectorAll("input[type=number]")).every(e=>e.value==="")','school counts require explicit input');
  ab('fill','input[name=students]','18');ab('fill','input[name=companions]','2');ab('click','form:nth-of-type(2) button[type=submit]');settle();snap();
  check('document.body.innerText.includes("18 studenti e 2 accompagnatori")','school aggregate presence displayed');
  check('document.documentElement.scrollWidth<=innerWidth','mobile has no horizontal overflow');
  ab('screenshot','/tmp/pace-p11-mobile.png','--full');
  assert.equal(ab('errors').trim(),'');console.log('PASS no browser errors');
} catch(error) {
  console.log(ab("snapshot","-i"));console.log(ab("eval","document.body.innerText"));
  throw error;
} finally {
  ab('close');rmSync(route,{recursive:true,force:true});
  rmSync(new URL('../../.next/dev/types/app/reception-check/',import.meta.url),{recursive:true,force:true});
}
