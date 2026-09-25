import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3128";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const routes = ["participant-operations-check", "leader-participants-check"];
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "participant-accessibility", ...args], {encoding: "utf8", timeout: 60000});
const check = (code, label) => {assert.match(ab("eval", `Boolean(${code})`), /true/, label); console.log(`PASS ${label}`);};
try {
  routes.forEach((route, index) => {
    const dir = new URL(`../../app/${route}/`, import.meta.url); mkdirSync(dir, {recursive: true});
    writeFileSync(new URL("page.tsx", dir), `export {default} from "@/tests/browser/${index ? "leader-participants" : "participant-operations"}-fixture";`);
  });
  ab("open", `${base}/${routes[0]}?section=iscritti&columns=name,accessibility`); ab("snapshot", "-i");
  check('document.querySelector("tbody").textContent.includes("Sofia Bianchi") && document.querySelector("tbody").textContent.includes("Luca Bianchi") && !document.body.textContent.includes("Mostra figli accompagnati")', "children always visible without toggle");
  check('document.querySelector("tbody").textContent.includes("Sentire, anche usando apparecchi acustici; Camminare o salire gradini")', "selected disability column displays multiple declared difficulties");
  ab("eval", 'Array.from(document.querySelectorAll("summary")).find(e => e.textContent.includes("Colonne visibili")).click(); Array.from(document.querySelectorAll("fieldset label")).find(e => e.textContent.includes("Informazioni sulla disabilità")).querySelector("input").click()');
  check('!document.querySelector("thead").textContent.includes("Informazioni sulla disabilità") && document.querySelector("tbody").textContent.includes("Sofia Bianchi")', "hiding optional disability keeps children visible");
  ab("eval", 'Array.from(document.querySelectorAll("fieldset label")).find(e => e.textContent.includes("Informazioni sulla disabilità")).querySelector("input").click()');
  check('new URL(document.querySelector("a[download]").href).searchParams.get("columns").includes("accessibility")', "download includes selected disability column");
  ab("eval", 'Array.from(document.querySelectorAll("summary")).find(e => e.textContent.includes("Colonne visibili")).click()');
  ab("screenshot", "--full", "/tmp/pace-participants-disability-desktop.png");
  ab("set", "viewport", "390", "844");
  check('document.documentElement.scrollWidth <= innerWidth', "operations mobile overflow stays inside table");
  ab("screenshot", "--full", "/tmp/pace-participants-disability-mobile.png");
  ab("eval", 'Array.from(document.querySelectorAll("button")).find(e => e.textContent.trim() === "Modalità sola lettura").click()');
  check('!document.querySelector("thead").textContent.includes("Informazioni sulla disabilità") && !Array.from(document.querySelectorAll("fieldset label")).some(e => e.textContent.includes("Informazioni sulla disabilità")) && !new URL(document.querySelector("a[download]").href).searchParams.get("columns").includes("accessibility")', "viewer cannot select or export disability even with forged URL");
  ab("open", `${base}/${routes[1]}?columns=name,accessibility`); ab("snapshot", "-i");
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"]) {
    ab("select", 'select[aria-label="Lingua fixture"]', locale);
    check('document.querySelector("tbody tr").cells[1].textContent.trim() !== "—" && document.querySelector("tbody").textContent.includes("Sofia Bianchi") && document.documentElement.scrollWidth <= innerWidth', `leader ${locale}: disability and children render on mobile`);
  }
  ab("select", 'select[aria-label="Lingua fixture"]', "it");
  ab("set", "viewport", "1280", "900");
  ab("screenshot", "--full", "/tmp/pace-leader-disability-desktop.png");
  assert.equal(ab("errors").trim(), "");
} finally {
  ab("close");
  for (const route of routes) {
    rmSync(new URL(`../../app/${route}/`, import.meta.url), {recursive: true, force: true});
    rmSync(new URL(`../../.next/dev/types/app/${route}/`, import.meta.url), {recursive: true, force: true});
  }
}
