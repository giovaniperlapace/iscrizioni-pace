import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
const base = process.argv[2] ?? "http://localhost:3127";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/service-import-check/", import.meta.url);
const output = "/tmp/pace-service-import-browser";
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "pace-services", ...args], { encoding: "utf8", timeout: 60000 });
const check = (code, label) => { assert.match(ab("eval", `(async () => Boolean(${code}))()`), /true/, label); console.log(`PASS ${label}`); };
try {
  mkdirSync(new URL("api/", route), { recursive: true });
  mkdirSync(output, { recursive: true });
  writeFileSync(new URL("page.tsx", route), 'export {default} from "@/tests/browser/service-import-fixture";');
  const source = readFileSync(new URL("../../app/dashboard/participants/service-import/api/route.ts", import.meta.url), "utf8")
    .replace('"@/lib/data-quality/access.server"', '"@/tests/browser/service-import-server-fixture"')
    .replace('"@/lib/supabase/service"', '"@/tests/browser/service-import-server-fixture"');
  writeFileSync(new URL("api/route.ts", route), source);
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Servizi").addRows([
    ["nome", "cognome", "servizio"], ["Marco", "Bianchi", "Accoglienza"], ["Anna", "Rossi", "Accoglienza"],
    ["Assente", "Rossi", "Accoglienza"], ["Omonimo", "Verdi", "Accoglienza"], ["Marco", "Bianchi", "Accoglienza"], ["Léa", "D’Angelo", "Inattivo"],
  ]);
  await book.xlsx.writeFile(`${output}/input.xlsx`);
  ab("set", "viewport", "1280", "900");
  ab("open", `${base}/service-import-check?dashboard=manager&q=Rossi&nav=mini&lost=1`);
  ab("snapshot", "-i");
  check('document.querySelector("#import-participants-trigger").nextElementSibling.id === "import-services-trigger"', "new button is adjacent to participant import");
  check('!document.querySelector("[data-nextjs-dialog]") && document.body.innerText.includes("Gestione iscritti")', "dev page loads without error overlay");
  ab("click", "#import-services-trigger");
  ab("wait", "dialog[open]");
  ab("snapshot", "-i");
  check('document.querySelector("dialog button[type=submit]").disabled', "file required before assignment");
  ab("screenshot", `${output}/desktop.png`);
  // Download the real GET template through the actual UI control.
  ab("click", "dialog [download=\"modello-servizi.xlsx\"]");
  ab("snapshot", "-i");
  ab("upload", "#services-file", `${output}/input.xlsx`);
  ab("click", "dialog button[type=submit]");
  ab("wait", "[role=alert]");
  check('document.querySelector("[role=alert]").textContent.includes("Risposta persa")', "lost response displays recoverable error");
  const firstId = ab("eval", "document.documentElement.dataset.importId").trim();
  ab("click", "dialog button[type=submit]");
  ab("wait", "#services-report-title");
  ab("snapshot", "-i");
  assert.equal(ab("eval", "document.documentElement.dataset.importId").trim(), firstId, "retry reuses request ID");
  check('document.body.innerText.includes("Richiesta già elaborata") && document.querySelectorAll("dialog tbody tr").length===6', "database receipt recovers all report rows without another write");
  check('document.body.innerText.includes("Partecipante non trovato") && document.body.innerText.includes("Nominativo ambiguo")', "distinct unresolved categories visible");
  ab("download", 'dialog a[download="report-importazione-servizi.xlsx"]', `${output}/report.xlsx`);
  const report = new ExcelJS.Workbook(); await report.xlsx.readFile(`${output}/report.xlsx`);
  assert.equal(report.getWorksheet("Report").rowCount, 7);
  assert.equal(report.getWorksheet("Riepilogo").getCell("B2").value, 6);
  console.log("PASS downloaded Excel report contains all six results");
  ab("check", "dialog input[type=checkbox]");
  check('document.querySelectorAll("dialog tbody tr").length===3', "filter retains only unresolved rows");
  ab("set", "viewport", "390", "844");
  ab("screenshot", `${output}/mobile-report.png`);
  check('document.documentElement.scrollWidth<=innerWidth && document.querySelector("dialog").getBoundingClientRect().height<=innerHeight', "mobile page has no horizontal overflow and dialog fits viewport");
  ab("screenshot", `${output}/mobile-report.png`);
  ab("press", "Escape");
  check('!document.querySelector("dialog[open]") && new URLSearchParams(location.search).get("q")==="Rossi" && document.activeElement.id==="import-services-trigger"', "Escape restores context and focus");
  ab("open", `${base}/service-import-check?dashboard=admin&import=services`);
  ab("wait", "dialog[open]");
  check('document.body.innerText.includes("Importa servizi da Excel")', "same dialog available to admin");
  ab("click", '[aria-label="Chiudi importazione servizi"]');
  check('!document.querySelector("dialog[open]")', "close button dismisses dialog");
  ab("open", `${base}/service-import-check?role=viewer&import=services`);
  ab("snapshot", "-i");
  check('!document.querySelector("#import-services-trigger") && !document.querySelector("dialog[open]")', "viewer cannot open import even via URL");
  check('await fetch("/service-import-check/api").then(r=>r.status===400)', "viewer cannot download template via API");
  check('await fetch("/service-import-check/api",{method:"POST",body:new FormData()}).then(r=>r.status===422)', "viewer cannot write via API");
  console.log("PASS UI → real handler → disposable SQL RPC → real Excel report; no production writes or email");
} finally {
  try { ab("close"); } catch {}
  rmSync(route, { recursive: true, force: true });
}
