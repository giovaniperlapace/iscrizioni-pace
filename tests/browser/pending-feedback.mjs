// Synthetic delayed navigation, forms and downloads; no real writes or emails.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
const base = process.argv[2] ?? "http://localhost:3106";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/pending-feedback-check/", import.meta.url);
const download = new URL("../../app/pending-download-check/", import.meta.url);
mkdirSync(route, { recursive: true }); mkdirSync(download, { recursive: true });
copyFileSync(new URL("./pending-feedback-fixture.tsx", import.meta.url), new URL("pending-feedback-fixture.tsx", route));
copyFileSync(new URL("./pending-feedback-page.tsx", import.meta.url), new URL("page.tsx", route));
writeFileSync(new URL("route.ts", download), `export async function GET(request: Request) {
  await new Promise(resolve => setTimeout(resolve, 4000));
  if (new URL(request.url).searchParams.has("error")) return new Response("Synthetic failure", { status: 500 });
  return new Response("synthetic download", { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
}`);
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "pending-feedback", ...args], { encoding: "utf8", timeout: 60000 });
const check = (code, label) => { assert.match(ab("eval", `(async () => Boolean(await (${code})))()`), /true/, label); console.log(`PASS ${label}`); };
// One browser evaluation per timing assertion prevents CLI startup from missing pending states.
const delayed = (trigger, during, after, label) => check(`(async () => { ${trigger}; await new Promise(r=>setTimeout(r,500)); const pending=Boolean(${during}); await new Promise(r=>setTimeout(r,5000)); return pending && Boolean(${after}); })()`, label);
try {
  ab("open", `${base}/pending-feedback-check`); console.log(ab("snapshot", "-i"));
  check('document.body.innerText.includes("Attesa operazioni") && !document.querySelector("[data-nextjs-dialog]")', "page loaded without framework errors");
  ab("screenshot", "/tmp/pace-pending-desktop.png");
  if (!process.argv.includes("--switches-only")) {
  delayed('document.querySelector("[data-statistics]").click()', 'document.querySelector("[data-statistics] [data-link-pending]") && getComputedStyle(document.querySelector("[data-statistics]")).cursor==="wait"', '!document.querySelector("[data-link-pending]") && document.querySelector("[data-section]").textContent==="statistics"', "statistics query navigation starts and clears spinner");
  delayed('document.querySelector("[data-groups]").click()', 'document.querySelector("[data-groups] [data-link-pending]")', '!document.querySelector("[data-link-pending]") && document.querySelector("[data-section]").textContent==="groups"', "second navigation starts and clears spinner");
  ab("eval", 'document.querySelector("[data-cancel]").click()'); check('!document.querySelector("[data-link-pending]")', "cancelled click does not start spinner");
  ab("click", "[data-save]"); check('!document.querySelector("[data-save]").disabled', "invalid form does not get stuck pending");
  ab("fill", '[aria-label="Nome"]', "Anna");
  delayed('document.querySelector("[data-save]").click()', 'document.querySelector("[data-save]").disabled && getComputedStyle(document.querySelector("[data-save]"),"::after").animationName==="work-spin"', '!document.querySelector("[data-save]").disabled && document.querySelector("[data-saved]").textContent==="1"', "validated save shows spinner until completion");
  delayed('document.querySelector("[data-fail]").click()', 'document.querySelector("[data-fail]").disabled', '!document.querySelector("[data-fail]").disabled && document.querySelector("[role=alert]")', "form error clears pending and shows error");
  delayed('document.querySelector("[data-native]").click()', 'document.querySelector("[data-native]").disabled', '!document.querySelector("[data-native]").disabled && document.querySelector("[data-saved]").textContent==="2"', "native React form status works");
  for (const [locale, label] of Object.entries({ it:"Operazione in corso…", en:"Working…", fr:"Opération en cours…", de:"Wird bearbeitet…", es:"Operación en curso…", nl:"Bezig…", uk:"Виконується…" })) {
    ab("select", '[aria-label="Lingua indicatore"]', locale);
    delayed('document.querySelector("[data-fail]").click()', `document.querySelector("[data-fail] [role=status]")?.textContent===${JSON.stringify(label)}`, '!document.querySelector("[data-fail]").disabled', `${locale} status is translated`);
  }
  ab("select", '[aria-label="Lingua indicatore"]', "it");
  delayed('document.querySelector("[data-download]").click()', 'document.querySelector("[data-download]").getAttribute("aria-busy")==="true"', 'document.querySelector("[data-download]").getAttribute("aria-busy")==="false"', "download pending ends after full response");
  delayed('document.querySelector("[data-download-error]").click()', 'document.querySelector("[data-download-error]").getAttribute("aria-busy")==="true"', 'document.querySelector("[data-download-error]").getAttribute("aria-busy")==="false" && document.body.textContent.includes("Impossibile scaricare")', "download error clears pending and offers retry");
  delayed('const input=document.querySelector("[aria-label=Ricerca]"); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"Anna"); input.dispatchEvent(new Event("input",{bubbles:true}))', 'document.querySelector("form[data-pending=true] .work-status") && !document.querySelector("[aria-label=Ricerca]").disabled && !document.querySelector("[aria-label=Ricerca]").closest("fieldset").disabled', '!document.querySelector("form[data-pending=true]")', "filter shows visible status without blocking typing");
  ab("set", "viewport", "390", "844");
  ab("eval", 'document.querySelector("[data-fail]").click()');
  ab("screenshot", "/tmp/pace-pending-mobile.png");
  check('document.documentElement.scrollWidth<=innerWidth', "mobile fits during pending operation");
  }
  delayed('document.querySelector("button[form=switch-service]").click()', 'document.querySelector("button[form=switch-service]").disabled && document.querySelector("button[form=switch-service]").getAttribute("aria-checked")==="false"', '!document.querySelector("button[form=switch-service]").disabled && document.querySelector("button[form=switch-service]").getAttribute("aria-checked")==="true"', "external service switch recovers after failure");
  delayed('document.querySelector("button[form=switch-group]").click()', 'document.querySelector("button[form=switch-group]").disabled', '!document.querySelector("button[form=switch-group]").disabled', "external group switch ends pending after success");
  assert.equal(ab("errors").trim(), "");
} finally {
  ab("close"); rmSync(route, { recursive: true, force: true }); rmSync(download, { recursive: true, force: true });
  for(const name of ["pending-feedback-check", "pending-download-check"]) rmSync(new URL(`../../.next/dev/types/app/${name}/`, import.meta.url), { recursive: true, force: true });
}
