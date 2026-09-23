// Local-only production UI with synthetic catalogue, session and server action.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
const base = process.env.BASE_URL ?? 'http://localhost:3014';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw Error('Localhost required');
const route = new URL('../../app/operations-manual-check/', import.meta.url);
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const write = (path, content) => writeFileSync(new URL(path, route), content);
mkdirSync(new URL('list/', route), { recursive: true });
let page = read('app/dashboard/manager/nuovo/page.tsx')
 .replace("from '@/app/actions'", "from './action'")
 .replace("from '@/lib/auth/session'", "from './fixture'")
 .replace("from '@/lib/events/current'", "from './fixture'")
 .replace("from '@/lib/supabase/server'", "from './fixture'")
 .replace("from '@/lib/supabase/service'", "from './fixture'")
 .replaceAll('/dashboard/manager?section=iscritti', '/operations-manual-check/list');
write('page.tsx', page);
write('action.ts', `"use server";
import {redirect} from 'next/navigation';
import {parseManualRegistrationForm} from '@/lib/registrations/manual-registration';
import {formFailure,issueFromMessage} from '@/lib/forms/result';
export async function createGroupLeaderManualRegistration(data:FormData){
 const parsed=parseManualRegistrationForm(data);
 if(!parsed.ok)return formFailure(parsed.errors.map(issueFromMessage));
 if(!String(data.get('duplicateReason')??'').trim())return formFailure([{field:'duplicateReason',code:'duplicate'}]);
 redirect('/operations-manual-check?manualSaved=1');
}`);
write('fixture.ts', `import {cookies} from 'next/headers';
export async function getCurrentAuthContext(..._args:unknown[]){const jar=await cookies();return {user:{id:'synthetic-operator'},eventRoles:[{role:jar.get('fixture-role')?.value??'manager',eventId:'synthetic-event'}]};}
export async function getCurrentOperationalEvent(..._args:unknown[]){return {id:'synthetic-event',title:'Evento di verifica',starts_on:'2026-10-25',ends_on:'2026-10-27'};}
export async function createSupabaseServerClient(){return createSupabaseServiceClient();}
export function createSupabaseServiceClient(){return {from(){return {select(){return this},eq(){return this},order(){return this},async range(){return {data:[{id:'11111111-1111-4111-8111-111111111111',name:'Gruppo pubblico'},{id:'22222222-2222-4222-8222-222222222222',name:'Gruppo riservato'}],error:null};}}}};}
`);
// Keep the real section's insertion-link permission and localization; replace unrelated tables.
write('section.tsx', read('app/dashboard/operations-participants-section.tsx')
 .replace('from "@/app/dashboard/operations-participants-table"', 'from "./stub"')
 .replace('from "@/app/dashboard/operations-duplicates-section"', 'from "./stub"')
 .replace('from "@/app/dashboard/operations-participants-navigation"', 'from "./stub"')
 .replaceAll('/dashboard/manager/nuovo','/operations-manual-check'));
write('stub.tsx', 'export const OperationsParticipantsTable=(_props:unknown)=>null; export const OperationsDuplicatesSection=(_props:unknown)=>null; export const OperationsParticipantsNavigation=(_props:unknown)=>null;');
write('list/page.tsx', `import {getCurrentAuthContext} from '../fixture';
import {OperationsParticipantsSection} from '../section';
export default async function Page(){const auth=await getCurrentAuthContext();return <main className="app-page p-8"><h1>Gestione iscritti</h1><OperationsParticipantsSection dashboard="manager" navMode="mini" operatorId="operator" eventId="synthetic-event" eventStartsOn="2026-10-25" canManageEvent={()=>auth.eventRoles[0].role==='manager'} selectedParticipant={null} snapshot={{participants:[],allParticipants:[],groupOptions:[],operationalTags:[],eventServices:[],filters:{} as never}} /></main>;}`);
const ab=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','pace-operations-manual',...args],{encoding:'utf8',timeout:60000});
const check=(expr,label)=>{assert.equal(ab('eval',expr).trim(),'true',label);console.log('PASS '+label);};
const cookie=(name,value)=>ab('cookies','set',name,value,'--url',base);
try {
 ab('open',base+'/operations-manual-check/list'); ab('snapshot','-i');
 ab('click','a[href="/operations-manual-check"]'); ab('wait','select[name="groupId"]');ab('snapshot','-i');
 check('document.body.innerText.length>0 && !document.querySelector("[data-nextjs-dialog]")','page renders, no error overlay');
 ab('screenshot','/tmp/pace-operations-manual-desktop.png');
 const locales = process.env.CHECK_LOCALES === undefined ? ['it','en','fr','de','es','nl','uk'] : process.env.CHECK_LOCALES.split(',').filter(Boolean);
 for(const locale of locales){
  cookie('iscrizioni_locale',locale);
  for(const width of ['1280','390']){
   ab('set','viewport',width,'900');
   ab('open',base+'/operations-manual-check');ab('snapshot','-i');
   check('document.documentElement.scrollWidth<=innerWidth','responsive '+locale+' '+width);
   check('document.querySelectorAll("select[name=groupId] option").length===3','public and hidden group '+locale+' '+width);
   check('!document.querySelector("[name=availabilityUnknown]").checked && !document.querySelector("[name=availabilitySlots]:checked")','no attendance invented');
   ab('click','button[type=submit]'); ab('snapshot','-i');
   check('!!document.querySelector("[role=alert]") && location.search===""','required validation '+locale);
   ab('select','select[name=groupId]','22222222-2222-4222-8222-222222222222');
   ab('fill','input[name=firstName]','Synthetic');ab('fill','input[name=lastName]','Person');
   ab('eval', "(() => { const field = document.querySelector('[name=birthDate]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, '1990-01-02'); field.dispatchEvent(new Event('input', {bubbles:true})); field.dispatchEvent(new Event('change', {bubbles:true})); return field.value; })()");
   ab('check','input[name=useLeaderEmail]');ab('snapshot','-i');
   check('!document.querySelector("input[name=email]")','group email delegation '+locale);
   ab('check','input[name=availabilityUnknown]');ab('check','input[name=consentConfirmed]');
   ab('click','button[type=submit]');ab('wait','textarea[name=duplicateReason][aria-invalid=true]');ab('snapshot','-i');
   check('document.querySelector("input[name=firstName]").value==="Synthetic" && document.querySelector("select[name=groupId]").value.startsWith("2222")','server error preserves inputs '+locale);
   ab('fill','textarea[name=duplicateReason]','Verified distinct synthetic person');
   ab('click','button[type=submit]');ab('wait','--url','**/operations-manual-check?manualSaved=1');ab('snapshot','-i');
   check('document.querySelector("input[name=firstName]").value==="" && !document.querySelector("[role=alert]")','success resets new form '+locale+' '+width);
   if(locale==='it'&&width==='390')ab('screenshot','/tmp/pace-operations-manual-mobile.png');
  }
 }
 cookie('fixture-role','manager_viewer');ab('open',base+'/operations-manual-check/list');ab('snapshot','-i');
 check(`!document.querySelector('a[href="/operations-manual-check"]')`,'Viewer insertion button absent');
 ab('open',base+'/operations-manual-check');ab('wait','--url','**/operations-manual-check/list');ab('snapshot','-i');
 check('!document.querySelector("select[name=groupId]")','Viewer direct URL denied');
 assert.equal(ab('errors').trim(),'');console.log('PASS browser errors empty');
}finally{
 try{ab('close')}finally{rmSync(route,{recursive:true,force:true});rmSync(new URL('../../.next/dev/types/app/operations-manual-check/',import.meta.url),{recursive:true,force:true});}
}
