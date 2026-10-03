// Run separately from typecheck/build. Creates a temporary synthetic route;
// the production component's action import is replaced, so no real DB calls occur.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3107";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/group-deletion-check/", import.meta.url);
mkdirSync(route, { recursive: true });
writeFileSync(new URL("page.tsx", route), 'import Fixture from "@/app/group-deletion-check/fixture"; import {normalizeLocale} from "@/lib/i18n/config"; export default async function Page({searchParams}:{searchParams:Promise<Record<string,string>>}) {const p=await searchParams;return <Fixture locale={normalizeLocale(p.locale)??"it"}/>;}');
writeFileSync(new URL("button.tsx", route), readFileSync(new URL("../../app/dashboard/group-delete-button.tsx", import.meta.url), "utf8").replace('@/app/dashboard/groups/actions', '@/app/group-deletion-check/fixture'));
writeFileSync(new URL("fixture.tsx", route), readFileSync(new URL("group-deletion-fixture.tsx", import.meta.url), "utf8").replace('@/app/dashboard/group-delete-button', '@/app/group-deletion-check/button'));
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "group-deletion-check", ...args], { encoding: "utf8", timeout: 60000 });
const check = (code, label) => { assert.match(ab("eval", `Boolean(${code})`), /true/, label); console.log(`PASS ${label}`); };
try {
 for (const locale of ["it","en","fr","de","es","nl","uk"]) {
  ab("set", "viewport", "390", "844");
  ab("open", `${base}/group-deletion-check?locale=${locale}&groupQ=Roma`); ab("snapshot", "-i");
  ab("click", 'main form button'); ab("wait", 'dialog input[type=checkbox]'); ab("snapshot", "-i");
  check('document.querySelector("dialog").open && document.querySelector("dialog button[aria-busy]").disabled', `${locale}: explicit confirmation required`);
  check('document.querySelector("dialog").textContent.includes("1001")', `${locale}: complete counts over 1000`);
  check('document.querySelector("dialog").getBoundingClientRect().width <= innerWidth && document.querySelector("dialog").scrollWidth <= document.querySelector("dialog").clientWidth', `${locale}: mobile dialog fits`);
  if (locale === "it") ab("screenshot", "/tmp/pace-group-delete-mobile.png");
  ab("press", "Escape"); ab("snapshot", "-i");
  check('!document.querySelector("dialog") && document.activeElement === document.querySelector("main form button") && !document.body.dataset.deleted && !document.body.dataset.submitted', `${locale}: cancel restores focus and changes nothing`);
  assert.equal(ab("errors").trim(), "");
 }
 ab("set", "viewport", "1280", "900");
 ab("open", `${base}/group-deletion-check?locale=it&groupQ=Roma`); ab("snapshot", "-i");
 ab("click", "main form button"); ab("wait", "dialog input[type=checkbox]"); ab("snapshot", "-i");
 ab("screenshot", "/tmp/pace-group-delete-desktop.png");
 ab("check", "dialog input"); ab("click", "dialog button[aria-busy]"); ab("wait", 'body[data-deleted=true]'); ab("snapshot", "-i");
 check('document.querySelector("main form input").value === "Roma" && location.search.includes("groupQ=Roma") && document.body.dataset.calls === "2" && !document.body.dataset.submitted && !document.body.dataset.filterChanged', 'success preserves filters, does not submit ancestor form, single mutation');
 for (const scenario of ["children", "error", "conflict"]) {
  ab("open", `${base}/group-deletion-check?locale=it&scenario=${scenario}`); ab("snapshot", "-i");
  ab("click", "main form button");
  if (scenario === "conflict") { ab("wait", "dialog input"); ab("check", "dialog input"); ab("click", "dialog button[aria-busy]"); }
  ab("wait", scenario === "children" ? "dialog dl" : "dialog [role=alert]"); ab("snapshot", "-i");
  check('!document.querySelector("dialog input") && !document.body.dataset.deleted', `${scenario}: no destructive action available`);
 }
 assert.equal(ab("errors").trim(), "");
 console.log("PASS browser controls in seven languages, success, cancel, errors, conflicts, desktop/mobile");
} finally {
 ab("close"); rmSync(route, { recursive: true, force: true });
 rmSync(new URL("../../.next/dev/types/app/group-deletion-check/", import.meta.url), { recursive: true, force: true });
}
