// Local-only production toolbar, table and modal with synthetic session/catalogue/action.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
const base = process.env.BASE_URL ?? 'http://localhost:3014';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw Error('Localhost required');
const route = new URL('../../app/operations-manual-check/', import.meta.url);
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const write = (path, content) => writeFileSync(new URL(path, route), content);
mkdirSync(route, { recursive: true });
write('manual.tsx', read('app/dashboard/operations-manual-registration.tsx')
 .replace("from '@/app/actions'", "from './action'")
 .replace("from '@/lib/auth/session'", "from './fixture'")
 .replace("from '@/lib/events/current'", "from './fixture'")
 .replace("from '@/lib/supabase/server'", "from './fixture'")
 .replace("from '@/lib/supabase/service'", "from './fixture'")
 .replace("from '@/lib/registrations/manual-registration-navigation'", "from './navigation'"));
write('navigation.ts', `import {manualRegistrationPath as original} from '@/lib/registrations/manual-registration-navigation';
export function manualRegistrationPath(...args:Parameters<typeof original>){return original(...args).replace('/dashboard/manager','/operations-manual-check').replace('/dashboard/admin','/operations-manual-check');}`);
write('action.ts', `"use server";
import {redirect} from 'next/navigation';
import {parseManualRegistrationForm} from '@/lib/registrations/manual-registration';
import {formFailure,issueFromMessage} from '@/lib/forms/result';
export async function createGroupLeaderManualRegistration(data:FormData){
 const parsed=parseManualRegistrationForm(data);
 if(!parsed.ok)return formFailure(parsed.errors.map(issueFromMessage));
 if(!String(data.get('duplicateReason')??'').trim())return formFailure([{field:'duplicateReason',code:'duplicate'}]);
 const url=new URL(String(data.get('returnTo')),'http://localhost');
 if(url.pathname!=='/operations-manual-check')throw Error('Only fixture navigation allowed');
 url.searchParams.set('manual','1');url.searchParams.set('manualSaved','1');
 redirect(url.pathname+url.search);
}`);
write('fixture.ts', `import {cookies} from 'next/headers';
export async function getCurrentAuthContext(..._args:unknown[]){const jar=await cookies();const role=jar.get('fixture-role')?.value??'manager';return {user:{id:'synthetic-operator'},eventRoles:[{role,eventId:role==='admin'?null:'synthetic-event'}]};}
export async function getCurrentOperationalEvent(..._args:unknown[]){return {id:'synthetic-event',title:'Evento di verifica',starts_on:'2026-10-25',ends_on:'2026-10-27'};}
export async function createSupabaseServerClient(){return createSupabaseServiceClient();}
export function createSupabaseServiceClient(){return {from(){return {select(){return this},eq(){return this},order(){return this},async range(){return {data:[{id:'11111111-1111-4111-8111-111111111111',name:'Gruppo pubblico'},{id:'22222222-2222-4222-8222-222222222222',name:'Gruppo riservato'}],error:null};}}}};}
`);
write('section.tsx', read('app/dashboard/operations-participants-section.tsx')
 .replace('from "@/app/dashboard/operations-participants-table"', 'from "./table"')
 .replace('from "@/app/dashboard/operations-manual-registration"', 'from "./manual"')
 .replace('from "@/app/dashboard/operations-duplicates-section"', 'from "./stub"'));
write('table.tsx', read('app/dashboard/operations-participants-table.tsx')
 .replaceAll('from "./', 'from "@/app/dashboard/')
 .replace('from "@/lib/registrations/manual-registration-navigation"', 'from "./navigation"')
 .replace('return `/dashboard/${dashboard}?${params}`;', 'return `/operations-manual-check?${params}`;'));
write('stub.tsx', 'export const OperationsDuplicatesSection=(_props:unknown)=>null;');
write('page.tsx', `import {getCurrentAuthContext} from './fixture';
import {OperationsParticipantsSection} from './section';
import {parseOperationsDashboardFilters} from '@/lib/registrations/operations-dashboard';
import {PreserveDashboardScroll} from '@/app/dashboard/preserve-dashboard-scroll';
import type {OperationsParticipantRow} from '@/lib/registrations/operations-types';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string>>}){
 const p=await searchParams; const auth=await getCurrentAuthContext(); const role=auth.eventRoles[0].role;
 const people:OperationsParticipantRow[]=Array.from({length:20},(_,i)=>({registrationId:'reg-'+i,participantId:'person-'+i,eventId:'synthetic-event',eventTitle:'Evento di verifica',authUserId:null,firstName:'Synthetic',lastName:'Person '+i,name:'Synthetic Person '+i,publicCode:'TEST'+i,birthDate:'1990-01-02',country:'Italia',city:'Roma',place:'Roma',email:'synthetic'+i+'@example.test',phone:null,registrationStatus:'submitted',submittedAt:'2026-09-23',currentGroupId:'22222222-2222-4222-8222-222222222222',currentGroupName:'Gruppo riservato',currentGroupStatus:'confirmed',currentServiceId:null,currentServiceStatus:null,service:null,tagIds:[],tags:[],childrenCount:0,children:[]}));
 return <main className="app-page mx-auto grid max-w-[90rem] gap-5 px-5 py-8"><PreserveDashboardScroll/><h1>Dashboard sintetica</h1><OperationsParticipantsSection searchParams={p} dashboard={role==='admin'?'admin':'manager'} navMode={p.nav==='full'?'full':'mini'} operatorId="operator" eventId="synthetic-event" eventStartsOn="2026-10-25" canManageEvent={()=>role==='manager'||role==='admin'} selectedParticipant={null} snapshot={{participants:people,allParticipants:people,groupOptions:[{id:'22222222-2222-4222-8222-222222222222',eventId:'synthetic-event',name:'Gruppo riservato'}],operationalTags:[],eventServices:[],filters:parseOperationsDashboardFilters(p)}} /></main>;
}`);
const ab=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','pace-operations-manual',...args],{encoding:'utf8',timeout:60000});
const check=(expr,label)=>{const result=ab('eval',`Boolean(${expr})`).trim();if(result!=='true')console.log(ab('eval',`JSON.stringify({url:location.href,returnTo:document.querySelector('dialog [name=returnTo]')?.value,focus:document.activeElement?.outerHTML.slice(0,200)})`));assert.equal(result,'true',label);console.log('PASS '+label);};
const cookie=(name,value)=>ab('cookies','set',name,value,'--url',base);
const context='?section=iscritti&nav=full&q=Synthetic&group=22222222-2222-4222-8222-222222222222&sort=name&direction=desc&columns=name,group';
const open=()=>{ab('click','#manual-participant-trigger');ab('wait','dialog[open]');};
const checkContext=()=>check(`new URLSearchParams(location.search).get('q')==='Synthetic' && new URLSearchParams(location.search).get('nav')==='full' && new URLSearchParams(location.search).get('columns')==='name,group'`,'list context preserved');
try {
 ab('open',base+'/operations-manual-check'+context);ab('snapshot','-i');
 check('document.body.innerText.length>0 && !document.querySelector("[data-nextjs-dialog]")','page renders without errors');
 for(const role of ['manager','admin']){
  cookie('fixture-role',role);cookie('iscrizioni_locale','it');ab('set','viewport','1280','900');ab('open',base+'/operations-manual-check'+context);ab('snapshot','-i');
  check(`(() => {const a=document.querySelector('#manual-participant-trigger'), b=document.querySelector('#import-participants-trigger');return a.parentElement===b.parentElement && Math.abs(a.getBoundingClientRect().y-b.getBoundingClientRect().y)<2;})()`,'buttons adjacent '+role);
  if(role==='manager')ab('screenshot','/tmp/pace-manual-toolbar.png');
  ab('eval','window.scrollTo(0,100);window.__manualScroll=window.scrollY');
  open();checkContext();
  check('document.body.style.overflow==="hidden" && document.querySelector("dialog").contains(document.activeElement) && document.querySelector("#import-participants-trigger")','native modal, focus trapped, list behind '+role);
  ab('screenshot','/tmp/pace-manual-overlay-'+role+'.png');
  ab('press','Escape');ab('wait','--fn','!document.querySelector("dialog[open]")');checkContext();
  check('document.activeElement.id==="manual-participant-trigger" && document.body.style.overflow!=="hidden"','Escape restores trigger and scrolling '+role);
  check('Math.abs(window.scrollY-window.__manualScroll)<2','list scroll restored '+role);
  open();ab('click','dialog > div:first-child button');ab('wait','--fn','!document.querySelector("dialog[open]")');checkContext();
  open();ab('back');ab('wait','--fn','!document.querySelector("dialog[open]")');checkContext();
  open();ab('click','dialog button[type=submit]');ab('wait','dialog [role=alert]');
  ab('select','dialog select[name=groupId]','22222222-2222-4222-8222-222222222222');
  ab('fill','dialog input[name=firstName]','Synthetic');ab('fill','dialog input[name=lastName]','Person');
  ab('eval', `(() => {const f=document.querySelector('dialog [name=birthDate]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(f,'1990-01-02');f.dispatchEvent(new Event('input',{bubbles:true}));f.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  ab('fill','dialog input[name=cityOther]','Berlin');
  ab('check','dialog input[name=useLeaderEmail]');ab('check','dialog input[name=availabilityUnknown]');ab('check','dialog input[name=consentConfirmed]');
  ab('click','dialog button[type=submit]');ab('wait','dialog textarea[name=duplicateReason][aria-invalid=true]');
  check('document.querySelector("dialog input[name=firstName]").value==="Synthetic"','server error retains fields '+role);
  ab('fill','dialog textarea[name=duplicateReason]','Verified distinct synthetic person');ab('click','dialog button[type=submit]');
  ab('wait','--fn','new URLSearchParams(location.search).get("manualSaved")==="1"');ab('wait','dialog[open]');
  check('document.querySelector("dialog input[name=firstName]").value==="" && document.querySelector("dialog").innerText.includes("Partecipante inserito")','saved state inside modal with fresh form '+role);checkContext();
  ab('eval',`document.querySelector('dialog > div:first-child button').click()`);ab('wait','--fn','!document.querySelector("dialog[open]")');checkContext();
 }
 cookie('fixture-role','manager');
 for(const locale of ['it','en','fr','de','es','nl','uk']) for(const width of ['1280','390']){
  cookie('iscrizioni_locale',locale);ab('set','viewport',width,'900');ab('open',base+'/operations-manual-check'+context);open();
  check('document.documentElement.scrollWidth<=innerWidth && document.querySelector("dialog").getBoundingClientRect().width<=innerWidth && document.querySelector("dialog").getBoundingClientRect().height<=innerHeight','responsive overlay '+locale+' '+width);
  check('document.querySelectorAll("dialog select[name=groupId] option").length===3 && !document.querySelector("dialog [name=availabilityUnknown]").checked','catalogue and no invented attendance '+locale);
  ab('click','dialog button[type=submit]');ab('wait','dialog [role=alert]');
  check('document.querySelector("dialog").contains(document.activeElement)','validation focuses inside modal '+locale);
  if(locale==='it'&&width==='390')ab('screenshot','/tmp/pace-manual-overlay-mobile.png');
  ab('press','Escape');ab('wait','--fn','!document.querySelector("dialog[open]")');
 }
 cookie('fixture-role','manager_viewer');ab('open',base+'/operations-manual-check'+context+'&manual=1');ab('snapshot','-i');
 check('!document.querySelector("#manual-participant-trigger") && !document.querySelector("dialog[open]")','Viewer cannot open insertion overlay');
 assert.equal(ab('errors').trim(),'');console.log('PASS browser errors empty');
}finally{
 try{ab('close')}finally{rmSync(route,{recursive:true,force:true});rmSync(new URL('../../.next/dev/types/app/operations-manual-check/',import.meta.url),{recursive:true,force:true});}
}
