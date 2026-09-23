import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.argv[2]??'http://localhost:3127';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Local server required');
const route=new URL('../../app/statistics-hierarchy-check/',import.meta.url);
const ab=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','statistics-hierarchy',...args],{encoding:'utf8',timeout:60000});
const check=(code,label)=>{assert.match(ab('eval',`Boolean(${code})`),/true/,label);console.log(`PASS ${label}`);};
try {
 mkdirSync(route,{recursive:true});writeFileSync(new URL('page.tsx',route),'export {default} from "@/tests/browser/statistics-hierarchy-fixture";');
 for(const dashboard of ['manager','admin']) {
  ab('open',`${base}/statistics-hierarchy-check?dashboard=${dashboard}`);ab('snapshot','-i');
  check('document.querySelectorAll("tbody tr").length===1 && !document.querySelector("[data-nextjs-dialog]")','initial roots only');
  for(const label of ['ItaliaNazione','RomaCittà','CentroArea']) {
   ab('eval',`[...document.querySelectorAll('button[aria-expanded]')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);ab('snapshot','-i');
  }
  check('document.querySelectorAll("tbody tr").length===5 && document.body.textContent.includes("Iscritti a Roma senza sottogruppo") && document.body.textContent.includes("Trastevere")','three levels and direct assignment wording');
  check(`[...document.querySelectorAll('tbody a')].every(a=>a.pathname==='/dashboard/${dashboard}' && new URLSearchParams(a.search).get('stat'))`,'count links retain dashboard and filter');
  check('new URLSearchParams(new URLSearchParams(document.querySelector("tbody a").search).get("stat")).get("subtreeGroup")==="event:it"','parent link includes descendants');
  ab('screenshot','--full',`/tmp/pace-hierarchy-${dashboard}.png`);
  ab('set','viewport','390','844');
  check('document.documentElement.scrollWidth<=innerWidth','mobile has no page overflow');
  ab('eval','document.querySelector("tbody").closest("table").parentElement.scrollLeft=0');
  ab('screenshot','--full',`/tmp/pace-hierarchy-${dashboard}-mobile.png`);
  check('getComputedStyle(document.querySelector("tbody th")).position!=="sticky"','mobile labels allow horizontal scrolling to all counts');
  ab('eval','document.querySelector("button[aria-expanded]").focus()');ab('press','Enter');
  check('document.querySelectorAll("tbody tr").length===1 && document.activeElement.getAttribute("aria-expanded")==="false"','keyboard collapse keeps focus');
  ab('set','viewport','1280','900');
 }
 assert.equal(ab('errors').trim(),'');
} finally {ab('close');rmSync(route,{recursive:true,force:true});rmSync(new URL('../../.next/dev/types/app/statistics-hierarchy-check/',import.meta.url),{recursive:true,force:true});}
