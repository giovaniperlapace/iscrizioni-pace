// Real components with a synthetic transport; database permissions are tested in SQL.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
const base=process.argv[2]??'http://localhost:3119';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw Error('Local only');
const route=new URL('../../app/operational-association-check/',import.meta.url);
const ab=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','operational-association',...args],{encoding:'utf8',timeout:60000});
const check=(code,label)=>{assert.equal(ab('eval',`Boolean(${code})`).trim(),'true',label);console.log('PASS '+label);};
mkdirSync(route,{recursive:true});
writeFileSync(new URL('editor.tsx',route),readFileSync(new URL('../../app/dashboard/operational-association-editor.tsx',import.meta.url),'utf8').replace('"./operational-registration-actions"','"./action"'));
writeFileSync(new URL('fixture.tsx',route),readFileSync(new URL('./participant-operations-fixture.tsx',import.meta.url),'utf8').replace('  country:', '  association: "Comunità di Sant’Egidio",\n  country:'));
writeFileSync(new URL('action.ts',route),`import {formFailure} from "@/lib/forms/result";
let snapshot={association:"Comunità di Sant’Egidio" as string|null,questionnaireId:"q"};
export async function getOperationalAssociation(){return {status:"success" as const,snapshot};}
export async function updateOperationalAssociation(form:FormData){
 await new Promise(r=>setTimeout(r,150));
 if(form.get("association")==="Conflict")return formFailure([{field:null,code:"conflict"}]);
 snapshot={...snapshot,association:String(form.get("association")).trim()||null};
 document.body.dataset.saved=JSON.stringify(snapshot);return {status:"success" as const,snapshot};
}`);
writeFileSync(new URL('page.tsx',route),`"use client";
import {useSearchParams} from "next/navigation";
import {OperationalAssociationEditor} from "./editor";
import Fixture from "./fixture";
export default function Page(){const p=useSearchParams();return p.has("table")?<Fixture/>:<main className="max-w-xl p-5"><OperationalAssociationEditor registrationId="11111111-1111-4111-8111-111111111111"/></main>;}`);
try {
 for(const [width,height] of [[1280,900],[390,844]]) {
  ab('set','viewport',String(width),String(height));ab('open',base+'/operational-association-check');ab('snapshot','-i');ab('wait','[name=association]');
  check(`document.querySelector('[name=association]').value==='Comunità di Sant’Egidio'`,'existing declaration prefilled');
  ab('fill','[name=association]','Conflict');ab('click','button[type=submit]');ab('wait','[role=alert]');
  check(`document.querySelector('[name=association]').value==='Conflict'`,'conflict keeps entered value');
  ab('fill','[name=association]','Associazione nuova');ab('click','button[type=submit]');ab('wait','--fn',`document.body.dataset.saved?.includes('Associazione nuova')`);
  check(`document.body.textContent.includes('Associazione aggiornata.')`,'successful save confirmed');
  ab('fill','[name=association]','');ab('click','button[type=submit]');ab('wait','--fn',`document.body.dataset.saved && JSON.parse(document.body.dataset.saved).association===null`);
  check(`document.querySelector('[name=association]').value==='' && document.documentElement.scrollWidth<=innerWidth`,'clear saves empty and mobile fits');
  ab('screenshot',`/tmp/pace-association-${width}.png`);
 }
 ab('open',base+'/operational-association-check?table=1&columns=name');ab('snapshot','-i');
 check(`!document.querySelector('thead').textContent.includes('Associazione / organizzazione')`,'column is optional');
 ab('click','details:has(fieldset[aria-label="Colonne visibili"]) > summary');ab('find','role','checkbox','check','--name','Associazione / organizzazione','--exact');
 ab('wait','--fn',`document.querySelector('tbody').textContent.includes('Comunità di Sant’Egidio')`);
 check(`document.querySelector('thead').textContent.includes('Associazione / organizzazione')`,'selected column shows declarations');
 ab('find','role','button','click','--name','Modalità sola lettura','--exact');ab('snapshot','-i');
 check(`document.querySelector('tbody').textContent.includes('Comunità di Sant’Egidio')`,'viewer retains read access');
 assert.equal(ab('errors').trim(),'');
}finally{ab('close');rmSync(route,{recursive:true,force:true});rmSync(new URL('../../.next/dev/types/app/operational-association-check/',import.meta.url),{recursive:true,force:true});}
