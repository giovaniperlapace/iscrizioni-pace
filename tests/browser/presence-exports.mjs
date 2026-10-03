// Run only against a local, isolated checkout with its dev server already running.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import ts from 'typescript';
const base = process.argv[2] ?? 'http://localhost:3149';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw Error('Localhost required');
const root = new URL('../../', import.meta.url);
const route = new URL('app/presence-exports-check/', root);
const read = path => readFileSync(new URL(path, root), 'utf8');
const ab = (...args) => execFileSync('npx', ['--yes', 'agent-browser', '--session', 'pace-presence', ...args], { encoding: 'utf8', timeout: 60000 });
const check = (expression, label) => { assert.equal(ab('eval', `Boolean(${expression})`).trim(), 'true', label); console.log(`PASS ${label}`); };
function functions(path, names) {
  const ast = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast)).join('\n');
}
try {
  mkdirSync(new URL('file/', route), { recursive: true });
  writeFileSync(new URL('exports.tsx', route), read('app/dashboard/exports-section.tsx').replace('/dashboard/manager/esportazioni', '/presence-exports-check/file'));
  writeFileSync(new URL('page.tsx', route), `
import { ExportsSection } from './exports';
import Link from '@/components/pending-link';
import {BarChart3,FileDown,Users,Mail,ShieldCheck,Network,Settings} from 'lucide-react';
type ManagerSection = 'dashboard'|'esportazioni'|'iscritti'|'email'|'ruoli'|'gruppi'|'impostazioni';
type AdminSection = ManagerSection; type ManagerNavMode = 'mini'|'full'; type AdminNavMode = ManagerNavMode; type StatisticsReport = 'territory';
${functions('app/dashboard/manager/page.tsx', ['ManagerSidebar', 'canAccessManagerSection'])}
${functions('app/dashboard/admin/page.tsx', ['AdminSidebar', 'adminPath'])}
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string>>}) {
 const p = await searchParams; const navMode = p.nav === 'full' ? 'full' : 'mini';
 return <main className="app-page"><section className="mx-auto grid w-full max-w-[90rem] gap-6 px-5 py-8 sm:px-8">
 <div className={'grid gap-4 lg:items-start '+(navMode==='mini'?'lg:grid-cols-[4.75rem_1fr]':'lg:grid-cols-[11.5rem_1fr]')}>
 {p.role==='admin'?<AdminSidebar activeSection="esportazioni" navMode={navMode} report="territory"/>:<ManagerSidebar activeSection="esportazioni" navMode={navMode} canManage={p.role!=='viewer'} report="territory"/>}
 <ExportsSection eventId={p.empty?'other-event':'d302dff4-f08d-4040-8d83-9ec2042a73d5'}/></div></section></main>;
}`);
  writeFileSync(new URL('file/route.ts', route), read('app/dashboard/manager/esportazioni/route.ts')
    .replaceAll('"@/lib/auth/session"', '"./fixture"').replaceAll('"@/lib/supabase/server"', '"./fixture"')
    .replaceAll('"@/lib/supabase/service"', '"./fixture"').replaceAll('"@/lib/events/current"', '"./fixture"')
    .replaceAll('"@/lib/presence-exports/data.server"', '"./fixture"'));
  writeFileSync(new URL('file/fixture.ts', route), `
import {cookies} from 'next/headers';
import config from '@/lib/presence-exports/assisi-2026.json';
const event = {id: config.eventId,title:'Evento sintetico di collaudo',starts_on:'2026-10-25',ends_on:'2026-10-27'};
export async function createSupabaseServerClient(){return {};}
export function createSupabaseServiceClient(){return {};}
export async function getCurrentAuthContext(){return {eventRoles:[{role:'manager',eventId:event.id}]};}
export async function getCurrentOperationalEvent(){return event;}
export async function loadPresenceSource(){
 if((await cookies()).get('presence-failure')?.value==='yes') throw Error('Synthetic failure');
 await new Promise(resolve=>setTimeout(resolve,400));
 return {event,extractedAt:'2026-10-01T12:00:00Z',registrations:[{id:'r1',participant_id:'p1'},{id:'r2',participant_id:'p2'}],children:[{id:'child',registration_id:'r1'}],groups:[{id:config.groups[0].groupId,name:'Nome attuale di prova',parent_group_id:null,is_assignable:true}],assignments:[{registration_id:'r1',group_id:config.groups[0].groupId},{registration_id:'r2',group_id:config.groups[0].groupId}],attendance:[{registration_id:'r1',day:'2026-10-25',day_part:'morning',choice:'yes'}],services:[],serviceAssignments:[],tags:[],tagAssignments:[]};
}`);
  for (const role of ['manager', 'viewer', 'admin']) for (const nav of ['mini', 'full']) {
    ab('open', `${base}/presence-exports-check?role=${role}&nav=${nav}`); ab('snapshot', '-i');
    check('document.querySelectorAll("a[download]").length===4 && !document.querySelector("table") && !document.querySelector("[data-nextjs-dialog]")', `${role}/${nav}: four downloads, no statistics tables`);
    check('document.querySelector("nav a[aria-current=page]").href.includes("section=esportazioni")', 'exports is the selected section');
    for (const width of ['1440', '390']) {
      ab('set', 'viewport', width, '960');
      check('document.documentElement.scrollWidth<=innerWidth', `${role}/${nav}/${width}: no overflow`);
      ab('screenshot', '--full', `/tmp/pace-presence-${role}-${nav}-${width}.png`);
    }
  }
  ab('set', 'viewport', '1440', '960'); ab('open', `${base}/presence-exports-check`); ab('snapshot', '-i');
  // Exercise real PendingDownload and the actual route/workbook implementation,
  // with only authentication/database sources replaced by the local fixture.
  ab('eval', `window.__downloads=[]; const create=URL.createObjectURL.bind(URL); URL.createObjectURL=blob=>{window.__downloads.push(blob);return create(blob)}; window.__calls=0; const original=window.fetch.bind(window); window.fetch=(...args)=>{if(String(args[0]).includes('/file?'))window.__calls++;return original(...args)};`);
  for (const kind of ['a', 'a2', 'b', 'b2']) {
    ab('eval', `document.querySelector('a[download="presenze_${kind}.xlsx"]').click()`); ab('snapshot', '-i');
    ab('wait', '--fn', '!document.querySelector("a[aria-busy=true]")');
  }
  check('window.__downloads.length===4 && window.__downloads.every(blob=>blob.size>6000 && blob.type.includes("spreadsheetml"))', 'all four actual XLSX downloads completed');
  check('window.__calls===4 && !document.querySelector("[role=alert]")', 'no duplicate request and no error');
  ab('cookies', 'set', 'presence-failure', 'yes', '--url', base);
  ab('eval', 'document.querySelector("a[download]").click()'); ab('snapshot', '-i');
  ab('wait', '--fn', 'Boolean(document.querySelector("[role=alert]"))');
  check('window.__downloads.length===4 && !document.querySelector("a[aria-busy=true]")', 'failed download never saves a file and releases the button');
  ab('cookies', 'set', 'presence-failure', 'no', '--url', base);
  ab('eval', 'document.querySelector("a[download]").click();document.querySelector("a[download]").click()');
  ab('wait', '--fn', 'window.__downloads.length===5');
  check('window.__calls===6 && !document.querySelector("[role=alert]")', 'retry succeeds and double click sends only once');
  ab('open', `${base}/presence-exports-check?empty=1`); ab('snapshot', '-i');
  check('!document.querySelector("a[download]") && document.querySelector("[role=status]").textContent.includes("configurato")', 'unconfigured edition has no misleading downloads');
} finally {
  try { ab('close'); } finally {
    rmSync(route, { recursive: true, force: true });
    rmSync(new URL('.next/dev/types/app/presence-exports-check/', root), { recursive: true, force: true });
  }
}
