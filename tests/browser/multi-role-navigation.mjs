// Production role tabs and authorization helpers with synthetic role assignments.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
const base=process.env.BASE_URL??'http://localhost:3012';
if(!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))throw new Error('Localhost required');
const route=new URL('../../app/multi-role-check/',import.meta.url);
mkdirSync(new URL('[area]/',route),{recursive:true});
const tabs=readFileSync(new URL('../../app/dashboard/role-tabs.tsx',import.meta.url),'utf8');
writeFileSync(new URL('tabs.tsx',route),tabs.replace('href={tab.href}','href={tab.href.replace("/dashboard/", "/multi-role-check/")}'));
writeFileSync(new URL('[area]/page.tsx',route),`import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {DashboardRoleTabs} from '../tabs';
import {isEventRole,isRoleAllowedForDashboard,dashboardRoleFromPath,pickDashboardRole,type DashboardRole} from '@/lib/auth/roles';
export default async function Page({params}:{params:Promise<{area:string}>}){
 const {area}=await params;const jar=await cookies();
 const roles=(jar.get('fixture-roles')?.value??'manager_viewer,capogruppo').split(',').filter(isEventRole);
 const required=dashboardRoleFromPath('/dashboard/'+area);
 if(!required || !isRoleAllowedForDashboard(required,new Set<DashboardRole>(roles)))redirect('/multi-role-check/manager');
 const activeRole=pickDashboardRole(roles,required);
 return <main className="app-page"><section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 sm:px-8">
 <DashboardRoleTabs activeRole={activeRole} eventRoles={roles.map(role=>({role,eventId:'event'}))}/>
 <section className="surface-card p-5" data-area={activeRole}><h1>{area}</h1><p>Account sintetico con più ruoli assegnati</p></section>
 </section></main>;
}`);
const ab=(...args)=>execFileSync('npx',['--yes','agent-browser','--session','pace-multi-role',...args],{encoding:'utf8',timeout:60000});
const check=(expr,label)=>{assert.equal(ab('eval',expr).trim(),'true',label);console.log('PASS '+label);};
const cookie=(key,value)=>ab('cookies','set',key,value,'--url',base);
try{
 ab('open',base+'/multi-role-check/manager');ab('snapshot','-i');
 check('document.body.innerText.length>0 && !document.querySelector("[data-nextjs-dialog]")','page renders without error overlay');
 for(const [index,locale] of ['it','en','fr','de','es','nl','uk'].entries()){
  cookie('iscrizioni_locale',locale);cookie('fixture-roles','manager_viewer,capogruppo');
  ab('set','viewport',index%2?'1280':'390','900');
  ab('open',base+'/multi-role-check/manager');ab('snapshot','-i');
  check('document.querySelectorAll("[role=tab]").length===3 && document.documentElement.scrollWidth<=innerWidth','three assigned dashboards fit '+locale);
  ab('click','a[href="/multi-role-check/capogruppo"]');ab('wait','[data-area="capogruppo"]');ab('snapshot','-i');
  check('document.querySelector("[aria-selected=true]").getAttribute("href")==="/multi-role-check/capogruppo"','secondary leader dashboard can be selected '+locale);
  if(locale==='it')ab('screenshot','/tmp/pace-multi-role-mobile.png');
 }
 for(const role of ['manager','manager_viewer']){
  cookie('fixture-roles',role+',capogruppo,accoglienza');
  ab('set','viewport','1280','900');ab('open',base+'/multi-role-check/manager');ab('snapshot','-i');
  check('document.querySelectorAll("[role=tab]").length===4','all assigned dashboards '+role);
  for(const area of ['accoglienza','capogruppo','partecipante','manager']){
   ab('click','a[href="/multi-role-check/'+area+'"]');ab('wait','[data-area="'+area+'"]');ab('snapshot','-i');
  }
 }
 cookie('fixture-roles','manager_viewer');ab('open',base+'/multi-role-check/capogruppo');ab('snapshot','-i');
 check('location.pathname==="/multi-role-check/manager" && document.querySelectorAll("[role=tab]").length===2','unassigned leader dashboard remains denied');
 assert.equal(ab('errors').trim(),'');console.log('PASS browser errors empty');
}finally{
 try{ab('close');}finally{rmSync(route,{recursive:true,force:true});rmSync(new URL('../../.next/dev/types/app/multi-role-check/',import.meta.url),{recursive:true,force:true});}
}
