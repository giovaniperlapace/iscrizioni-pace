// Actual personal page with synthetic auth/data/actions; localhost only, no sends.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
const base = process.env.BASE_URL ?? 'http://localhost:3012';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error('Localhost required');
const route = new URL('../../app/self-registration-check/', import.meta.url);
mkdirSync(route, { recursive: true });
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
let page = read('app/dashboard/partecipante/page.tsx')
 .replace('from "./editable-registration-info"', 'from "@/app/dashboard/partecipante/editable-registration-info"')
 .replaceAll('from "@/app/actions"', 'from "./actions"')
 .replace('from "@/lib/auth/session"', 'from "./fixture"')
 .replace('from "@/lib/supabase/service"', 'from "./fixture"')
 .replace('from "@/lib/supabase/server"', 'from "./fixture"')
 .replace('from "@/app/dashboard/participant-children-editor"', 'from "./children"')
 .replace('  const locale = await getRequestLocale();', '  const fixtureParams = searchParams ? await searchParams : {};\n  const locale = (fixtureParams.locale ?? "it") as SupportedLocale;')
 .replace('const supabase = await createSupabaseServerClient();', 'const supabase = await createSupabaseServerClient(params.cancelled === "1");')
 .replaceAll('/dashboard/partecipante', '/self-registration-check');
// Restore imports rewritten by route replacement.
page = page.replaceAll('@/app/self-registration-check/', '@/app/dashboard/partecipante/');
writeFileSync(new URL('page.tsx', route), page);
writeFileSync(new URL('cancel-registration-button.tsx', route), read('app/dashboard/partecipante/cancel-registration-button.tsx').replaceAll('/dashboard/partecipante', '/self-registration-check'));
writeFileSync(new URL('children.tsx', route), read('app/dashboard/participant-children-editor.tsx').replace('from "@/app/actions"', 'from "./actions"'));
writeFileSync(new URL('actions.ts', route), '"use server";\nexport async function updateParticipantDashboard() { return {status:"error" as const,issues:[{field:null,code:"failed"}]}; }');
writeFileSync(new URL('cancellation-actions.ts', route), `export async function cancelOwnRegistration(id:string,confirmed:boolean) {
 document.body.dataset.cancellations=String(Number(document.body.dataset.cancellations??0)+1);
 document.body.dataset.cancelPayload=JSON.stringify({id,confirmed});
 await new Promise(resolve=>setTimeout(resolve,200));
 if(new URLSearchParams(location.search).has('failure')) return {error:'failed' as const};
 return {success:true as const};
}`);
writeFileSync(new URL('fixture.ts', route), `import { createClient } from '@supabase/supabase-js';
export async function getCurrentAuthContext(..._args: unknown[]) { return {user:{id:'self',email:'synthetic@example.test'},eventRoles:[],dashboardRole:'partecipante'}; }
export async function createSupabaseServerClient(cancelled=false) { return makeClient(cancelled); }
export function createSupabaseServiceClient() { return makeClient(false); }
function makeClient(cancelled:boolean) {
 return createClient('https://synthetic.invalid','synthetic',{global:{fetch:async(input)=>{
 const table=new URL(String(input)).pathname.split('/').pop()!;
 const data:Record<string,unknown>={
 registrations:cancelled?[]:[{id:'11111111-1111-4111-8111-111111111111',event_id:'event',participant_id:'participant',status:'submitted',submitted_at:'2026-09-22',
 events:{id:'event',title:'Incontro internazionale per la pace',starts_on:'2026-10-25',ends_on:'2026-10-27',registration_closes_at:null,is_current:true},
 participants:{auth_user_id:'self',first_name:'Anna',last_name:'Rossi',birth_date:'1985-05-20',public_code:'TEST',country_other:'Italia',city_other:'Roma'}}],
 participant_contacts:[{email:'synthetic@example.test',phone:'+393331234567',is_primary:true}],
 registration_children:[{first_name:'Luca',last_name:'Rossi',birth_date:'2018-05-20',position:1}],
 accessibility_needs:{washington_group_answers:{hearing:true},needs_operational_support:false},
 event_attendance_choices:[{day:'2026-10-25',day_part:'morning',choice:'yes'}],
 participant_event_services:null,qr_tokens:null,
 registration_questionnaire_answers:[{answers:{birthPlace:'Roma',nationality:'Italiana'}}]
 };
 return new Response(JSON.stringify(data[table]??[]));
 }}});
}`);
const ab = (...args) => execFileSync('npx', ['--yes','agent-browser','--session','pace-self',...args], {encoding:'utf8',timeout:60000});
const check = (code,label) => { const value=ab('eval',code).trim(); assert.equal(value,'true',label+' '+value); console.log('PASS '+label); };
const open = query => { ab('open',base+'/self-registration-check?overlay=iscrizione&'+query); ab('wait','dialog[open]'); ab('snapshot','-i'); };
try {
 for(const locale of (process.env.FOCUSED ? ['it'] : ['it','en','fr','de','es','nl','uk'])) {
  ab('set','viewport','1280','900'); open('locale='+locale);
  check('document.querySelectorAll("dialog[open] details").length===5','five editable sections '+locale);
  ab('click','dialog[open] details:first-of-type summary');
  ab('fill','input[name="firstName"]','Anna aggiornata');
  check('document.querySelector("input[name=firstName]").value === "Anna aggiornata"','identity form '+locale);
  if(locale==='it') ab('screenshot','/tmp/pace-self-desktop.png');
  ab('click','dialog[open] button:has(svg.lucide-user-round-x)');
  ab('wait','dialog[open][aria-describedby]');
  check('document.querySelectorAll("dialog[open]").length===2 && !document.body.dataset.cancellations','confirmation before mutation '+locale);
  check('document.activeElement.textContent===document.querySelector("dialog[aria-describedby] button").textContent','safe initial focus '+locale);
  ab('set','viewport','390','844');
  check('document.documentElement.scrollWidth<=innerWidth && [...document.querySelectorAll("dialog[open]")].every(d=>d.scrollWidth<=d.clientWidth)','mobile dialog fit '+locale);
  if(locale==='it') ab('screenshot','/tmp/pace-self-cancel-mobile.png');
  ab('press','Escape');
  check('document.querySelectorAll("dialog[open]").length===1 && document.activeElement.querySelector("svg.lucide-user-round-x")!==null','escape returns focus '+locale);
  ab('screenshot','/tmp/pace-self-mobile-'+locale+'.png');
 }
 open('locale=it&failure=1');
 ab('click','dialog[open] button:has(svg.lucide-user-round-x)');
 ab('click','dialog[aria-describedby] button:last-child'); ab('wait','[role=alert]');
 check('document.body.dataset.cancellations==="1" && document.querySelectorAll("dialog[open]").length===2','failed cancellation stays in confirmation');
 ab('click','dialog[aria-describedby] button:first-child');
 check('document.querySelectorAll("dialog[open]").length===1','keep after failure');
 open('locale=it'); ab('click','dialog[open] button:has(svg.lucide-user-round-x)');
 ab('click','dialog[aria-describedby] button:last-child');
 ab('wait','--url','**cancelled=1'); ab('snapshot','-i');
 check('!document.querySelector("dialog[open]") && document.body.innerText.includes("è stata annullata") && [...document.querySelectorAll("a")].some(a=>new URL(a.href).pathname==="/registrazione")','success removes modal and offers registration');
 assert.equal(ab('errors').trim(),''); console.log('PASS browser errors empty');
} finally {
 ab('close');
 rmSync(route,{recursive:true,force:true});
 rmSync(new URL('../../.next/dev/types/app/self-registration-check/',import.meta.url),{recursive:true,force:true});
}
