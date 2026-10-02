// Real UI copied only to replace action transport with synthetic browser data.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
const base=process.env.BASE_URL??'http://localhost:3139';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw Error('Local only');
const route=new URL('../../app/assisted-demographics-check/',import.meta.url);
const ab=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','assisted-demographics',...args],{encoding:'utf8',timeout:60000});
const check=(code,label)=>{assert.equal(ab('eval',`Boolean(${code})`).trim(),'true',label);console.log('PASS '+label);};
function copy(source,target,replacements={}) {
 let text=readFileSync(new URL('../../'+source,import.meta.url),'utf8');
 for(const [a,b] of Object.entries(replacements)) text=text.replaceAll(a,b);
 writeFileSync(new URL(target,route),text);
}
mkdirSync(route,{recursive:true});
copy('app/dashboard/operational-demographics-editor.tsx','editor.tsx',{'"./operational-registration-actions"':'"./action"','"./assisted-demographic-fields"':'"@/app/dashboard/assisted-demographic-fields"'});
copy('app/dashboard/use-internal-sex-column.ts','use-internal-sex-column.ts',{'"./operational-registration-actions"':'"./action"'});
copy('app/dashboard/capogruppo/participants-table.tsx','table.tsx',{'"../use-internal-sex-column"':'"./use-internal-sex-column"','"../accompanying-children-list"':'"@/app/dashboard/accompanying-children-list"'});
copy('app/dashboard/operations-participants-table.tsx','manager-table.tsx',{'from "./':'from "@/app/dashboard/'});
writeFileSync(new URL('manager-table.tsx',route),readFileSync(new URL('manager-table.tsx',route),'utf8').replace('from "@/app/dashboard/use-internal-sex-column"','from "./use-internal-sex-column"'));
copy('tests/browser/participant-operations-fixture.tsx','manager-fixture.tsx',{'from "@/app/dashboard/operations-participants-table"':'from "./manager-table"','  country:':'  nationality: "Italian",\n  country:','dashboard="admin"':'dashboard="manager"'});
writeFileSync(new URL('action.ts',route),`import { formFailure } from "@/lib/forms/result";
const snapshot={nationality:"Italian",birthPlace:"Roma, Italia",country:"Italia",countryId:null,countryOther:"Italia",questionnaireId:null};
export async function getOperationalDemographics(){ return {status:"success" as const,snapshot}; }
export async function updateOperationalDemographics(form:FormData){
 if(form.get("nationality")==="Conflict")return formFailure([{field:null,code:"conflict"}]);
 const result={...snapshot,nationality:String(form.get("nationality")),birthPlace:String(form.get("birthPlace")),country:String(form.get("country"))};
 document.body.dataset.saved=JSON.stringify(result);return {status:"success" as const,snapshot:result};
}
export async function getVisibleInternalSexes(ids:string[]){document.body.dataset.sexCalls=String(Number(document.body.dataset.sexCalls??0)+1);return {status:"success" as const,values:Object.fromEntries(ids.map(id=>[id,"female" as const]))};}
`);
writeFileSync(new URL('page.tsx',route),`"use client";
import {useState} from "react";
import {useSearchParams} from "next/navigation";
import {LeaderParticipantsTable} from "./table";
import ManagerFixture from "./manager-fixture";
import {OperationalDemographicsEditor} from "./editor";
import {ManualRegistrationSection} from "@/app/dashboard/manual-registration-section";
import {MANUAL_REGISTRATION_COPY} from "@/lib/registrations/manual-registration-copy";
import {parseManualRegistrationForm} from "@/lib/registrations/manual-registration";
import {normalizeLocale} from "@/lib/i18n/config";
import {formFailure,issueFromMessage} from "@/lib/forms/result";
const rows=[{id:"a",registrationId:"11111111-1111-4111-8111-111111111111",groupId:"g",participantName:"Anna Synthetic",participantCode:"FIX",participantPlace:"Roma",participantEmail:null,participantPhone:null,participantCountry:"Italia",participantCity:"Roma",birthDate:"1990-01-01",groupName:"Gruppo",submittedAt:null,tagIds:[],children:[],tags:[],serviceLabel:null,nationality:"Italian"}];
export default function Page(){const p=useSearchParams(),locale=normalizeLocale(p.get("locale"))??"it";const [saved,setSaved]=useState("");const [mode]=useState(p.get("mode"));return <main className="mx-auto max-w-5xl p-4">
{mode==="manager"?<ManagerFixture/>:mode==="table"?<LeaderParticipantsTable rows={rows} operatorId="demographics-test" startsOn="2026-10-25" locale={locale}/>:mode==="edit"?<OperationalDemographicsEditor registrationId={rows[0].registrationId} locale={locale}/>:<ManualRegistrationSection locale={locale} copy={MANUAL_REGISTRATION_COPY[locale]} sourceDashboard={p.get("role")==="manager"?"manager":"capogruppo"} groups={[{id:rows[0].registrationId,name:"Gruppo",isAssignable:true}]} selectedGroupId={rows[0].registrationId} eventDays={[]} action={async form=>{const parsed=parseManualRegistrationForm(form);if(!parsed.ok)return formFailure(parsed.errors.map(issueFromMessage));setSaved(JSON.stringify(parsed.value));}}/>}<output className="block break-all" data-result>{saved}</output></main>;}`);
if(process.env.PREPARE_ONLY) {console.log('Prepared synthetic route');process.exit(0);}
try {
 ab('open',`${base}/assisted-demographics-check`);ab('snapshot','-i');ab('screenshot','/tmp/pace-demographics-desktop.png');
 check('document.body.innerText.length>100 && !document.querySelector("[data-nextjs-dialog]")','dev page rendered without error overlay');
 ab('eval','document.querySelector("[role=combobox]").scrollIntoView({block:"center"})');ab('screenshot','/tmp/pace-demographics-fields.png');
 if (!process.env.TABLE_ONLY) {
 if (!process.env.EDIT_ONLY) for(const locale of ['it','en','fr','de','es','nl','uk'])for(const role of ['manager','capogruppo']){
 ab('open',`${base}/assisted-demographics-check?locale=${locale}&role=${role}`);ab('snapshot','-i');
 check('["nationality","birthPlace","country","internalSex"].every(name=>document.querySelector(`[name=${name}]`) && !document.querySelector(`[name=${name}]`).required)',locale+' '+role+' optional fields');
 ab('fill','[name=firstName]','Anna');ab('fill','[name=lastName]','Synthetic');ab('check','[name=useLeaderEmail]');
 ab('eval',`(()=>{const e=document.querySelector('[name=birthDate]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'1990-01-01');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 ab('fill','[name=cityOther]','Roma');ab('check','[name=availabilityUnknown]');ab('check','[name=consentConfirmed]');
 ab('fill','[role=combobox]','Italian');ab('fill','[name=birthPlace]','France');ab('fill','[name=country]','Germany');ab('select','[name=internalSex]','female');
 ab('click','button[type=submit]');ab('wait','--fn','document.querySelector("[data-result]").textContent.includes("female")');
 check('JSON.parse(document.querySelector("[data-result]").textContent).country==="Germany"',locale+' '+role+' declared geography and sex reach action');
 ab('set','viewport','390','844');check('document.documentElement.scrollWidth<=innerWidth',locale+' mobile fits');ab('set','viewport','1280','900');
 }
 for(const locale of ['it','en','fr','de','es','nl','uk']){
 ab('open',`${base}/assisted-demographics-check?mode=edit&locale=${locale}`);ab('snapshot','-i');
 ab('wait','[role=combobox]');check('document.querySelector("[name=birthPlace]").value==="Roma, Italia" && !document.querySelector("[name=internalSex]")',locale+' existing birthplace preserved, sex absent from edit loads');
 }
 ab('fill','[role=combobox]','Conflict');ab('click','button[type=submit]');ab('wait','[role=alert]');check('document.querySelector("[name=nationality]").value==="Conflict"','conflict retains edits');
 ab('fill','[role=combobox]','French');ab('click','button[type=submit]');ab('wait','--fn','document.body.dataset.saved?.includes("French")');
 }
 ab('open',`${base}/assisted-demographics-check?mode=table&columns=name,nationality`);ab('snapshot','-i');
 check('!document.body.dataset.sexCalls && document.querySelector("tbody").textContent.includes("Italia")','nationality visible without sex reads');
 ab('click','summary');ab('find','role','checkbox','check','--name','Sesso','--exact');ab('wait','--fn','document.querySelector("tbody").textContent.includes("Femmina")');
 check('Number(document.body.dataset.sexCalls)===1','visible sex reads once');
 ab('find','role','checkbox','click','--name','Sesso','--exact');ab('snapshot','-i');check('!document.querySelector("tbody").textContent.includes("Femmina") && Number(document.body.dataset.sexCalls)===1','hidden sex removed without further reads');
 ab('set','viewport','390','844');check('document.documentElement.scrollWidth<=innerWidth','table mobile fits');ab('screenshot','/tmp/pace-demographics-mobile.png');
 ab('open',`${base}/assisted-demographics-check?mode=manager&columns=name,nationality`);ab('snapshot','-i');
 check('!document.body.dataset.sexCalls && document.querySelector("tbody").textContent.includes("Italia")','manager nationality without internal reads');
 ab('click','details:has(fieldset[aria-label="Colonne visibili"]) > summary');ab('snapshot','-i');ab('find','role','checkbox','check','--name','Sesso','--exact');
 ab('wait','--fn','document.querySelector("tbody").textContent.includes("Femmina")');check('Number(document.body.dataset.sexCalls)===1','manager selected sex loads once');
 ab('find','role','button','click','--name','Modalità sola lettura','--exact');ab('snapshot','-i');
 check('!document.querySelector("tbody").textContent.includes("Femmina") && !Array.from(document.querySelectorAll("thead th")).some(e=>e.textContent.includes("Sesso")) && Number(document.body.dataset.sexCalls)===1','Viewer drops column and stops reads');
 assert.equal(ab('errors').trim(),'');console.log('PASS synthetic browser checks complete');
}finally{ab('close');rmSync(route,{recursive:true,force:true});}
