// Synthetic browser transport; the real read model and RLS are checked separately.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = process.argv[2] ?? 'http://localhost:3112';
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw Error('Local server required');
const route = new URL('../../app/event-attendance-check/', import.meta.url);
mkdirSync(route, { recursive: true });
writeFileSync(new URL('page.tsx', route), 'export { default } from "@/tests/browser/event-attendance-fixture";');
const ab = (...args) => execFileSync('npx', ['--yes', 'agent-browser', '--session', 'pace-p13', ...args], { encoding: 'utf8', timeout: 60000 });
const check = (code, label) => { assert.match(ab('eval', `Boolean(${code})`), /true/, label); console.log(`PASS ${label}`); };
const wait = code => ab('wait', '--fn', code);
try {
  ab('open', `${base}/event-attendance-check`); ab('snapshot', '-i');
  wait('document.body.innerText.includes("Ingresso non registrato")');
  ab('find', 'role', 'button', 'click', '--name', 'Mostra figli accompagnati', '--exact'); ab('snapshot', '-i');
  ab('find', 'role', 'button', 'click', '--name', 'entered', '--exact'); ab('snapshot', '-i');
  wait('document.querySelector("tbody").innerText.includes("Ingresso registrato")');
  check('document.querySelector("tbody li").innerText.includes("Ingresso non registrato")', 'adult entry does not imply child entry');
  check('document.querySelector("article").innerText.includes("13")', 'school quantities included in total people');
  for (const view of ['iscritti', 'panel']) {
    const selector = `[data-school-view="${view}"] tbody`;
    wait(`document.querySelector('${selector}').innerText.includes("10 studenti · 2 accompagnatori presenti")`);
    check(`document.querySelector('${selector}').innerText.includes("Ingresso registrato") && document.querySelector('${selector}').innerText.includes("20 studenti")`, `school actual entry and booked quantities stay separate in ${view}`);
  }
  ab('set', 'viewport', '390', '844'); ab('snapshot', '-i');
  ab('screenshot', '/tmp/pace-p13-mobile.png', '--full');
  check('document.documentElement.scrollWidth <= innerWidth', 'mobile page has no horizontal overflow');
  ab('find', 'role', 'button', 'click', '--name', 'Apri scheda', '--exact');
  wait('!!document.querySelector("dialog[open]")');
  check('document.querySelector("dialog").innerText.includes("Ingresso registrato")', 'participant detail displays entry');
  ab('fill', 'dialog input[name="firstName"]', 'Modifica conservata');
  ab('eval', 'window.dispatchEvent(new CustomEvent("fixture-attendance", {detail:"absent"}))');
  wait('!document.querySelector("dialog").innerText.includes("Ingresso registrato")');
  check('document.querySelector("dialog input[name=firstName]").value === "Modifica conservata"', 'automatic cancellation refresh preserves unsaved form');
  ab('eval', 'window.dispatchEvent(new CustomEvent("fixture-attendance", {detail:"error"}))');
  wait('document.querySelector("dialog").innerText.includes("Presenza non disponibile")');
  check('!document.querySelector("tbody").innerText.includes("Ingresso non registrato")', 'read failure is not displayed as absence');
  ab('eval', 'window.dispatchEvent(new CustomEvent("fixture-attendance", {detail:"entered"}))');
  wait('document.querySelector("dialog").innerText.includes("Ingresso registrato")');
  ab('eval', 'window.dispatchEvent(new CustomEvent("fixture-attendance", {detail:"forbidden"}))');
  wait('document.querySelector("dialog").innerText.includes("Presenza non disponibile")');
  check('!document.querySelector("tbody").innerText.includes("Ingresso registrato")', 'revoked access clears previous presence data');
  for (const view of ['iscritti', 'panel']) {
    check(`document.querySelector('[data-school-view="${view}"] tbody').innerText.includes("Presenza non disponibile")`, `school presence clears on revoked access in ${view}`);
  }
  ab('eval', 'window.dispatchEvent(new Event("fixture-close-participant"))');
  wait('!document.querySelector("dialog[open]")');
  ab('eval', 'window.dispatchEvent(new CustomEvent("fixture-attendance", {detail:"entered"}))');
  ab('eval', 'document.querySelectorAll("[data-school-view] button").forEach(b=>{if(b.textContent==="Riprova") b.click()})');
  wait('document.querySelector("[data-school-view] tbody").innerText.includes("Ingresso registrato")');
  ab('find', 'role', 'button', 'click', '--name', 'Apri scheda scuola iscritti', '--exact');
  wait('!!document.querySelector("[data-school-view] [role=dialog]")');
  ab('fill', '[data-school-view] input[name="schoolName"]', 'Modifica scuola conservata');
  ab('eval', 'window.dispatchEvent(new CustomEvent("fixture-attendance", {detail:"absent"}))');
  wait('document.querySelector("[data-school-view] [role=dialog]").innerText.includes("Ingresso non registrato")');
  check('document.querySelector("[data-school-view] input[name=schoolName]").value === "Modifica scuola conservata"', 'school cancellation refresh preserves unsaved form');
  assert.equal(ab('errors').trim(), '');
  console.log('PASS browser flow and no runtime errors');
} finally {
  ab('close'); rmSync(route, { recursive: true, force: true });
  rmSync(new URL('../../.next/dev/types/app/event-attendance-check/', import.meta.url), { recursive: true, force: true });
}
