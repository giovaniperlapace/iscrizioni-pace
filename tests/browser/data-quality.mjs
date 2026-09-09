import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3116";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw new Error("Local server required");
const route = new URL("../../app/data-quality-check/", import.meta.url);
mkdirSync(route, { recursive: true });
writeFileSync(
  new URL("page.tsx", route),
  'export { default } from "@/tests/browser/data-quality-fixture";',
);
const ab = (...args) =>
  execFileSync(
    process.env.AGENT_BROWSER_BIN ?? "npx",
    [
      ...(process.env.AGENT_BROWSER_BIN ? [] : ["--yes", "agent-browser"]),
      "--session",
      "pace-quality-test",
      ...args,
    ],
    { encoding: "utf8", timeout: 60000 },
  );
const ev = (code) => ab("eval", code);
const check = (code, message) => {
  assert.match(ev(`Boolean(${code})`), /true/, message);
  console.log(`PASS ${message}`);
};
const click = (text) =>
  ev(
    `Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(text)}).click()`,
  );
try {
  ab("open", `${base}/data-quality-check`);
  ab("snapshot", "-i");
  check('document.body.textContent.includes("Qualità dati")', "page loads");
  ev(
    'const data=new DataTransfer();data.items.add(new File(["fixture"],"fixture.xlsx"));document.querySelector("input[type=file]").files=data.files;document.querySelector("input[type=file]").dispatchEvent(new Event("change",{bubbles:true}));',
  );
  check(
    'document.getElementById("import-selected-file").textContent.includes("fixture.xlsx")',
    "selected filename is visible",
  );
  click("Mostra anteprima");
  ab("snapshot", "-i");
  check(
    'document.querySelectorAll("tbody tr").length===2 && !document.documentElement.dataset.lastQualityAction',
    "preview performs no commit",
  );
  check(
    'Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Conferma importazione").disabled',
    "invalid rows block commit",
  );
  ev(
    'const replacement=new DataTransfer();replacement.items.add(new File(["replacement"],"replacement.xlsx"));const input=document.querySelector("input[type=file]");input.files=replacement.files;input.dispatchEvent(new Event("change",{bubbles:true}));',
  );
  check(
    '!Array.from(document.querySelectorAll("button")).some(e=>e.textContent==="Conferma importazione") && document.getElementById("import-selected-file").textContent.includes("replacement.xlsx")',
    "replacing a file clears its previous preview and confirmation",
  );
  click("Mostra anteprima");
  ab("snapshot", "-i");
  ab(
    "fill",
    "tbody tr:nth-child(1) textarea",
    "Different people, verified with manager",
  );
  ab("select", "tbody tr:nth-child(2) select", "skip");
  ab("fill", "tbody tr:nth-child(2) textarea", "Name missing");
  ab("check", "section:first-of-type input[type=checkbox]");
  ab("set", "viewport", "390", "844");
  check(
    "document.documentElement.scrollWidth<=innerWidth",
    "mobile has no page overflow",
  );
  ab("screenshot", "/tmp/pace-quality-preview-mobile.png");
  click("Conferma importazione");
  ab("snapshot", "-i");
  check(
    'document.body.textContent.includes("1 iscrizioni create, 1 righe scartate")',
    "explicit confirmation completes import",
  );
  ab("select", '[aria-label="Confronto schede"] select', "merged");
  ab("snapshot", "-i");
  check(
    'Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Conferma decisione").disabled',
    "merge requires explicit survivor and confirmation",
  );
  ab("check", '[aria-label="Confronto schede"] input[type=radio]');
  ab(
    "fill",
    '[aria-label="Confronto schede"] textarea',
    "Verified same person",
  );
  ab("check", '[aria-label="Confronto schede"] input[type=checkbox]');
  click("Conferma decisione");
  ab("snapshot", "-i");
  check(
    'document.querySelector("[role=alert]").textContent.includes("nessun dato modificato")',
    "failed merge stays visible with entered data",
  );
  ab("set", "viewport", "1280", "900");
  ab("screenshot", "/tmp/pace-quality-review-desktop.png");
  ab("open", `${base}/data-quality-check?import=excel&q=Maria&nav=mini`);
  ab("wait", "dialog[open]");
  check(
    'document.querySelector("dialog input[type=file]").getAttribute("aria-label") === "Scegli file Excel" && Array.from(document.querySelectorAll("dialog button")).find(e=>e.textContent.trim()==="Mostra anteprima").disabled',
    "modal explains file selection and requires a file before preview",
  );
  ab("screenshot", "/tmp/pace-import-dialog-desktop.png");
  ab("click", "dialog summary");
  check('document.querySelector("dialog details").open', "compilation guide expands inside modal");
  ab("set", "viewport", "390", "844");
  check(
    'document.documentElement.scrollWidth<=innerWidth && document.querySelector("dialog").getBoundingClientRect().height<=innerHeight && document.querySelector("dialog > div:last-child").scrollHeight>document.querySelector("dialog > div:last-child").clientHeight',
    "mobile instructions scroll inside the dialog",
  );
  ab("screenshot", "/tmp/pace-import-instructions-mobile.png");
  ab("click", "dialog summary");
  ab("screenshot", "/tmp/pace-import-dialog-mobile.png");
  ab("press", "Escape");
  ab("wait", "input[type=file]");
  check(
    '!document.querySelector("dialog[open]") && location.search==="?q=Maria&nav=mini" && document.body.style.overflow!=="hidden"',
    "Escape closes import and preserves dashboard context",
  );
  assert.equal(ab("errors").trim(), "");
} finally {
  ab("close");
  rmSync(route, { recursive: true, force: true });
}
