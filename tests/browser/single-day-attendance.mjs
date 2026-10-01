import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://localhost:3138';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw Error('Local server required');
const route = new URL('../../app/single-day-attendance-check/', import.meta.url);
const ab = (...args) => execFileSync('npx', ['--yes', 'agent-browser', '--session', 'single-day', ...args], { encoding: 'utf8', timeout: 60000 });
const check = (code, label) => { assert.match(ab('eval', `Boolean(${code})`), /true/, label); console.log(`PASS ${label}`); };
try {
  mkdirSync(route, { recursive: true });
  writeFileSync(new URL('page.tsx', route), 'export { default } from "@/tests/browser/single-day-attendance-fixture";');
  for (const dashboard of ['manager', 'admin']) for (const report of ['territory', 'attendance']) {
    const nav = dashboard === 'admin' ? 'mini' : 'full';
    ab('open', `${base}/single-day-attendance-check?dashboard=${dashboard}&report=${report}&nav=${nav}`);
    ab('snapshot', '-i');
    check('!document.querySelector("details").open && document.querySelector("summary").textContent.startsWith("5")', `${dashboard}/${report}: separate count starts collapsed`);
    ab('eval', 'document.querySelector("summary").focus()'); ab('press', 'Enter'); ab('snapshot', '-i');
    check('document.querySelector("details").open && [...document.querySelectorAll("details tbody a")].map(a=>a.textContent).join(",")==="1,3,1,0"', 'keyboard expands chronological daily counts including zero');
    check(`[...document.querySelectorAll('details tbody a')].every(a=>a.pathname==='/dashboard/${dashboard}' && new URLSearchParams(a.search).get('nav')==='${nav}' && new URLSearchParams(new URLSearchParams(a.search).get('stat')).has('singleDay'))`, 'daily links preserve dashboard, menu and exclusive-date filter');
    for (const width of [1280, 390]) {
      ab('set', 'viewport', String(width), '844');
      check('document.documentElement.scrollWidth<=innerWidth+1', `${width}px: no page overflow`);
    }
    if (dashboard === 'manager') ab('screenshot', '--full', `/tmp/pace-single-day-${report}-mobile.png`);
    // Only the destination is replaced with the local fixture: the real table,
    // parser and server selection run against synthetic data without authentication.
    ab('eval', `(()=>{const a=document.querySelectorAll('details tbody a')[1]; const u=new URL(a.href); u.pathname='/single-day-attendance-check'; u.searchParams.set('dashboard','${dashboard}');u.searchParams.set('columns','name');a.href=u.href; a.addEventListener('click', e=>{e.preventDefault();e.stopImmediatePropagation();location.assign(u.href);},{capture:true,once:true});})()`);
    ab('click', 'details tbody tr:nth-child(2) a'); ab('wait', '[aria-label="Tabella iscritti, scorrimento orizzontale"]'); ab('snapshot', '-i');
    check('document.body.innerText.includes("Partecipano solo il 25 ottobre") && document.querySelectorAll("tbody tr").length===2 && document.body.innerText.includes("Prova family") && document.body.innerText.includes("Prova morning") && document.body.innerText.includes("Figlio Prova") && !document.body.innerText.includes("Prova multiple")', 'click opens actual participants table with the two counted registrations and child');
    check('document.documentElement.scrollWidth<=innerWidth+1', 'filtered table fits mobile');
    ab('set', 'viewport', '1280', '900');
  }
  const errors = ab('errors').trim(); assert.ok(!errors || /No errors/i.test(errors), errors);
} catch (error) { console.log(ab('get', 'url')); console.log(ab('get', 'text', 'body')); throw error; } finally {
  ab('close');
  rmSync(route, { recursive: true, force: true });
  rmSync(new URL('../../.next/dev/types/app/single-day-attendance-check/', import.meta.url), { recursive: true, force: true });
}
