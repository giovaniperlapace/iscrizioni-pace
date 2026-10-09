// Run against local Next dev + a synthetic Supabase stub, never a remote site.
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
const base=process.argv[2]??'http://127.0.0.1:3124';
assert.match(base,/^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const ab=(...args)=>execFileSync('npx',['--no-install','agent-browser','--session','pace-release',...args],{encoding:'utf8',timeout:60000});
const check=(expr,label)=>{assert.match(ab('eval',`Boolean(${expr})`),/true/,label);console.log('PASS '+label);};
const snap=()=>ab('snapshot','-i');
const control=url=>JSON.parse(execFileSync('curl',['-fsS',url],{encoding:'utf8'}));
const route='app/release-panel-check';
assert.ok(!existsSync(route),'temporary fixture route must not already exist');
mkdirSync(route);writeFileSync(`${route}/page.tsx`,'export {default} from "@/tests/browser/panel-release-fixture";');
try {
const requestsStart=control('http://127.0.0.1:55440/requests').length;
control('http://127.0.0.1:55440/mode?value=internal');
ab('open',base);snap();
check('!document.querySelector("#panel-program")&&!document.querySelector("#schools")&&!!document.querySelector("input[type=email]")','original home, no public announcement');
ab('screenshot','/tmp/pace-release-home-desktop.png');
for(const path of ['/scuole','/scuole/accesso','/scuole/conferma']){
 ab('open',base+path);snap();check('location.pathname==="/"','closed direct route '+path);
}
control('http://127.0.0.1:55440/mode?value=catalog');
ab('open',base);snap();
check('document.body.innerText.includes("Panel sintetico riservato")&&!document.querySelector("#schools")&&!document.querySelector("a.panel-access-cue")','preserved future catalog without school/public-booking CTA');
ab('set','viewport','390','844');snap();
check('document.documentElement.scrollWidth<=innerWidth','future catalog mobile width');
ab('screenshot','/tmp/pace-release-future-mobile.png');
control('http://127.0.0.1:55440/mode?value=internal');
ab('open',base+'/release-panel-check');snap();
check('document.body.innerText.includes("58 prenotati da iscritti e scuole")&&document.body.innerText.includes("Iscritti: 30 disponibili su 70")&&document.body.innerText.includes("Scuole: 12 disponibili su 30")','admin canonical remaining seats by audience');
check('document.documentElement.scrollWidth<=innerWidth','admin mobile width');
ab('screenshot','/tmp/pace-release-manager-mobile.png');
for(const width of ['390','1440']){
 ab('set','viewport',width,'900');ab('open',base+'/release-panel-check?role=viewer');snap();
 check('!Array.from(document.querySelectorAll("button")).some(b=>b.innerText.includes("Convalida"))&&!Array.from(document.querySelectorAll("a")).some(a=>a.innerText==="Modifica")','viewer is read only '+width);
}
ab('open',base+'/release-panel-check');snap();ab('wait','1000');
ab('screenshot','/tmp/pace-release-manager-desktop.png');
const line=snap().split('\n').find(l=>l.includes('button "Convalida"'));
assert.ok(line);ab('click','@'+line.match(/ref=(e\d+)/)[1]);snap();
check('!!document.querySelector("[role=dialog]")&&document.body.style.overflow==="hidden"','confirmation locks background');
ab('press','Escape');snap();check('!document.querySelector("[role=dialog]")&&document.body.style.overflow!=="hidden"','Escape closes confirmation and restores background');
for(const width of ['390','1440']) {
 ab('set','viewport',width,'900');
 for(const role of ['admin','manager']) {
  ab('open',base+'/release-panel-check?view=email&role='+role);snap();
  check(`Boolean(document.querySelector('#campaign-audience-teachers-tab'))===${role==='admin'}`,'teacher audience only admin '+width);
  check(`Boolean(document.querySelector('#campaign-recipient-panel'))===${role==='admin'}`,'panel email filter only admin '+width);
  check('document.documentElement.scrollWidth<=innerWidth','email layout '+role+' '+width);
 }
}
const requests=control('http://127.0.0.1:55440/requests').slice(requestsStart);
assert.ok(requests.every(r=>['/rest/v1/rpc/get_panel_release_mode','/rest/v1/rpc/get_public_panel_program'].includes(r.path)),JSON.stringify(requests));
console.log('PASS no school loader, authentication or email side effects');

} finally { rmSync(route,{recursive:true,force:true}); }
