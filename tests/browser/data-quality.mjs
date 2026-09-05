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
    'const data=new DataTransfer();data.items.add(new File(["fixture"],"fixture.xlsx"));document.querySelector("input[type=file]").files=data.files;',
  );
  click("Carica e valida");
  ab("snapshot", "-i");
  check(
    'document.querySelectorAll("tbody tr").length===2 && !document.documentElement.dataset.lastQualityAction',
    "preview performs no commit",
  );
  check(
    'Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Conferma importazione").disabled',
    "invalid rows block commit",
  );
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
  assert.equal(ab("errors").trim(), "");
} finally {
  ab("close");
  rmSync(route, { recursive: true, force: true });
}
