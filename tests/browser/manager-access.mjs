// Local-only visual verification using production UI and synthetic identities.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import ts from 'typescript';
const base = process.env.BASE_URL ?? 'http://localhost:3012';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Localhost required');
const route = new URL('../../app/manager-access-check/', import.meta.url);
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const write = (path, content) => writeFileSync(new URL(path, route), content);
mkdirSync(new URL('personal/', route), {recursive:true});
const source = read('app/dashboard/manager/page.tsx');
const ast = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const helpers = ast.statements.filter(n => ts.isFunctionDeclaration(n) && ['ManagerSidebar','canAccessManagerSection'].includes(n.name?.text)).map(n=>n.getText(ast)).join('\n');
write('page.tsx', `import Link from '@/components/pending-link';
import {BarChart3,Users,Mail,ShieldCheck,Network,Settings} from 'lucide-react';
import {DashboardRoleTabs} from './tabs';
import {getCurrentAuthContext} from './fixture';
type ManagerSection = 'dashboard'|'iscritti'|'email'|'ruoli'|'gruppi'|'impostazioni';
type ManagerNavMode = 'mini'|'full';
${helpers.replaceAll('/dashboard/manager','/manager-access-check')}
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string>>}) {
const p=await searchParams; const auth=await getCurrentAuthContext(); const canManage=auth.eventRoles[0].role==='manager';
const navMode=p.nav==='full'?'full':'mini';
return <main className="app-page"><section className="mx-auto grid w-full max-w-[90rem] gap-6 px-5 py-8 sm:px-8">
<DashboardRoleTabs activeRole="manager" eventRoles={auth.eventRoles}/>
<div className={'grid gap-4 lg:items-start '+(navMode==='mini'?'lg:grid-cols-[4.75rem_1fr]':'lg:grid-cols-[11.5rem_1fr]')}>
<ManagerSidebar activeSection="dashboard" navMode={navMode} canManage={canManage}/><section className="surface-card p-5"><h2>Statistiche</h2><p>Dati sintetici per verifica navigazione</p></section></div></section></main>;
}`);
write('tabs.tsx', read('app/dashboard/role-tabs.tsx').replace('const tabs = getDashboardRoleTabs(eventRoles, locale);', `const tabs = getDashboardRoleTabs(eventRoles, locale).map(tab=>({...tab,href:tab.href==='/dashboard/manager'?'/manager-access-check':'/manager-access-check/personal'}));`));
let page = read('app/dashboard/partecipante/page.tsx')
 .replace('from "./editable-registration-info"','from "@/app/dashboard/partecipante/editable-registration-info"')
 .replace('from "./cancel-registration-button"','from "./cancel-registration-button"')
 .replace('from "@/app/actions"','from "./actions"')
 .replace('from "@/app/dashboard/role-tabs"','from "../tabs"')
 .replace('from "@/lib/auth/session"','from "../fixture"')
 .replace('from "@/lib/supabase/service"','from "../fixture"')
 .replace('from "@/lib/supabase/server"','from "../fixture"')
 .replace('from "@/app/dashboard/participant-children-editor"','from "./children"')
 .replaceAll('/dashboard/partecipante','/manager-access-check/personal')
 .replaceAll('@/app/manager-access-check/personal/','@/app/dashboard/partecipante/');
write('personal/page.tsx',page);
write('personal/children.tsx',read('app/dashboard/participant-children-editor.tsx').replace('from "@/app/actions"','from "./actions"'));
write('personal/actions.ts','"use server"; export async function updateParticipantDashboard(){ return {status:"error" as const,issues:[{field:null,code:"failed"}]}; }');
write('personal/cancel-registration-button.tsx',read('app/dashboard/partecipante/cancel-registration-button.tsx'));
write('personal/cancellation-actions.ts','export async function cancelOwnRegistration(..._args:unknown[]){return {error:"failed" as const};}');
write('fixture.ts', `import {createClient} from '@supabase/supabase-js';
import {cookies} from 'next/headers';
import {encryptQrToken} from '@/lib/qrcode/secure-token';
export async function getCurrentAuthContext(..._args:unknown[]) {const jar=await cookies();return {user:{id:'self',email:'operator@example.test'},eventRoles:[{role:jar.get('fixture-role')?.value==='manager'?'manager' as const:'manager_viewer' as const,eventId:'event'}],dashboardRole:'partecipante'};}
export async function createSupabaseServerClient(){const jar=await cookies();return client(jar.get('fixture-registered')?.value==='yes');}
export function createSupabaseServiceClient(){return client(true);}
function client(registered:boolean){return createClient('https://synthetic.invalid','synthetic',{global:{fetch:async(input,init)=>{
 if(init?.method && init.method!=='GET')throw new Error('Fixture is read only');
 const table=new URL(String(input)).pathname.split('/').pop()!;
 const data:Record<string,unknown>={registrations:registered?[{id:'11111111-1111-4111-8111-111111111111',event_id:'event',participant_id:'participant',status:'submitted',submitted_at:'2026-09-23',events:{id:'event',title:'Incontro internazionale per la pace',starts_on:'2026-10-25',ends_on:'2026-10-27',registration_closes_at:null,is_current:true},participants:{auth_user_id:'self',first_name:'Anna',last_name:'Rossi',birth_date:'1985-05-20',public_code:'TEST',country_other:'Italia',city_other:'Roma'}}]:[],participant_contacts:[{email:'operator@example.test',phone:'+393331234567',is_primary:true}],registration_children:[],accessibility_needs:{washington_group_answers:{},needs_operational_support:false},event_attendance_choices:[{day:'2026-10-25',day_part:'morning',choice:'yes'}],participant_event_services:null,qr_tokens:{status:'active',expires_at:null,revoked_at:null,token_encrypted:encryptQrToken('synthetic-qr-token-manager-check')},registration_questionnaire_answers:[]};
 return new Response(JSON.stringify(data[table]??[]));
 }}});}
`);
const ab=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','pace-manager-access',...args],{encoding:'utf8',timeout:60000});
const check=(expr,label)=>{assert.equal(ab('eval',expr).trim(),'true',label);console.log('PASS '+label);};
const cookie=(name,value)=>ab('cookies','set',name,value,'--url',base);
try{
 ab('open',base+'/manager-access-check'); ab('snapshot','-i');
 check('document.body.innerText.length>0 && !document.querySelector("[data-nextjs-dialog]")','dev server renders without error overlay');
 ab('screenshot','/tmp/pace-manager-initial.png');
 for(const role of ['manager_viewer','manager']){
  cookie('fixture-role',role);
  for(const width of ['1280','390']){
   ab('set','viewport',width,'900');
   for(const nav of ['full','mini']){
    ab('open',base+'/manager-access-check?nav='+nav);ab('snapshot','-i');
    check(`document.querySelectorAll('nav[aria-label="Sezioni dashboard manager"] a').length===${role==='manager'?6:2}`,'menu '+role+' '+width+' '+nav);
    check('document.querySelectorAll("[role=tab]").length===2 && document.documentElement.scrollWidth<=innerWidth','tabs and layout');
    if(role==='manager_viewer' && nav==='full')ab('screenshot','/tmp/pace-viewer-'+width+'.png');
   }
  }
  ab('click','[role=tab]:last-child');ab('wait','--url','**/manager-access-check/personal');ab('snapshot','-i');
  check('[...document.querySelectorAll("a")].some(a=>new URL(a.href).pathname==="/registrazione" && new URL(a.href).searchParams.get("email")==="operator@example.test")','missing registration uses same account '+role);
  cookie('fixture-registered','yes');
  for(const locale of ['it','en','fr','de','es','nl','uk']){
   cookie('iscrizioni_locale',locale);
   ab('open',base+'/manager-access-check/personal');ab('snapshot','-i');
   check('document.body.innerText.includes("Anna") && ![...document.querySelectorAll("a")].some(a=>new URL(a.href).pathname==="/registrazione")','existing registration '+role+' '+locale);
   check('document.querySelectorAll("[role=tab]").length===2 && document.documentElement.scrollWidth<=innerWidth','personal tabs fit '+locale);
   check('[...document.images].some(img=>img.src.startsWith("data:image/png")) && [...document.querySelectorAll("a[download]")].some(a=>a.href.startsWith("data:image/png"))','personal QR preview and download '+role+' '+locale);
  }
  cookie('iscrizioni_locale','it');
  ab('open',base+'/manager-access-check/personal?overlay=iscrizione');ab('wait','dialog[open]');ab('snapshot','-i');
  check('document.querySelector("dialog[open]").innerText.includes("Anna")','own registration opens '+role);
  ab('open',base+'/manager-access-check/personal?overlay=qr');ab('wait','dialog[open]');ab('snapshot','-i');
  check('document.querySelector("dialog[open]").innerText.includes("TEST")','own QR area opens '+role);
  ab('press','Escape');ab('snapshot','-i');
  ab('click','[role=tab]:first-child');ab('wait','--url','**/manager-access-check');ab('snapshot','-i');
  cookie('fixture-registered','no');
 }
 assert.equal(ab('errors').trim(),'');console.log('PASS browser errors empty');
}finally{
 try{ab('close');}finally{rmSync(route,{recursive:true,force:true});rmSync(new URL('../../.next/dev/types/app/manager-access-check/',import.meta.url),{recursive:true,force:true});}
}
