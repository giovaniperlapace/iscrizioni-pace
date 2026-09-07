import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3116";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw new Error("Local server required");
const route = new URL("../../app/leader-participants-check/", import.meta.url);
mkdirSync(route, { recursive: true });
writeFileSync(
  new URL("page.tsx", route),
  'export { default } from "@/tests/browser/leader-participants-fixture";',
);
const ab = (...args) =>
  execFileSync(
    process.env.AGENT_BROWSER_BIN ?? "npx",
    [
      ...(process.env.AGENT_BROWSER_BIN ? [] : ["--yes", "agent-browser"]),
      "--session",
      "leader-table",
      ...args,
    ],
    { encoding: "utf8", timeout: 60000 },
  );
const evaluate = (code) => ab("eval", code);
const check = (code, label) => {
  assert.match(evaluate(`Boolean(${code})`), /true/, label);
  console.log(`PASS ${label}`);
};
const click = (selector, text) =>
  evaluate(
    `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e => e.textContent.trim() === ${JSON.stringify(text)}).click()`,
  );
try {
  ab("open", `${base}/leader-participants-check?q=Anna&tag=tag`);
  ab("snapshot", "-i");
  evaluate(
    'localStorage.removeItem("iscrizioni:leader-participants:v1:leader-fixture-a"); localStorage.removeItem("iscrizioni:leader-participants:v1:leader-fixture-b"); window.dispatchEvent(new Event("leader-preferences"))',
  );
  check(
    'document.querySelectorAll("tbody tr").length === 12 && !Array.from(document.querySelectorAll("th")).some(e => /Azioni|Dettagli/.test(e.textContent))',
    "no Actions or Details column",
  );
  click("summary", "Colonne visibili");
  ab("snapshot", "-i");
  evaluate(
    'Array.from(document.querySelectorAll("fieldset label")).find(e => e.textContent === "Paese").querySelector("input").click()',
  );
  check(
    'Array.from(document.querySelectorAll("th")).some(e => e.textContent === "Paese")',
    "column selection applies without filter submit",
  );
  click("th button", "Partecipante");
  check(
    'document.querySelector("th").getAttribute("aria-sort") === "descending" && document.querySelector("tbody a").textContent === "Persona Prova 11"',
    "numeric descending sorting",
  );
  check(
    'document.querySelector("tbody a").href.includes("q=Anna") && document.querySelector("tbody a").href.includes("tag=tag") && document.querySelector("tbody a").href.includes("direction=desc") && document.querySelector("tbody a").href.includes("assignmentId=")',
    "name opens assignment with filters and table state",
  );
  // Simulate navigation back with no URL preference override; saved operator settings win.
  evaluate(
    'history.replaceState(null, "", "/leader-participants-check?q=Anna&tag=tag")',
  );
  check(
    'Array.from(document.querySelectorAll("th")).some(e => e.textContent === "Paese") && document.querySelector("th").getAttribute("aria-sort") === "descending"',
    "preferences survive navigation",
  );
  click("button", "Cambia operatore");
  check(
    '!Array.from(document.querySelectorAll("th")).some(e => e.textContent === "Paese") && document.querySelector("th").getAttribute("aria-sort") === "ascending"',
    "preferences isolated by operator",
  );
  click("button", "Cambia operatore");
  // Intercept only the download transport to inspect actual request and failure UI.
  evaluate(
    'window.fetch = async (input) => { window.__exportRequest = String(input); return new Response("denied", {status:403}); }',
  );
  click("button", "Esporta iscritti");
  check(
    'window.__exportRequest.includes("/dashboard/capogruppo/export?") && window.__exportRequest.includes("q=Anna") && window.__exportRequest.includes("direction=desc") && window.__exportRequest.includes("columns=")',
    "export sends effective filters, columns and ordering",
  );
  check(
    'document.querySelector("[role=alert]")?.textContent === "Esportazione non riuscita. Riprova."',
    "download failure shown without navigating away",
  );
  ab("open", `${base}/leader-participants-check`);
  ab("snapshot", "-i");
  ab("set", "viewport", "1280", "900");
  ab("screenshot", "/tmp/pace-leader-desktop.png");
  ab("set", "viewport", "390", "844");
  check(
    "document.documentElement.scrollWidth <= innerWidth",
    "mobile overflow stays within table",
  );
  ab("screenshot", "/tmp/pace-leader-mobile.png");
  check(
    '!document.querySelector("[data-nextjs-dialog]")',
    "no framework error overlay",
  );
  assert.equal(ab("errors").trim(), "");
} finally {
  ab("close");
  rmSync(route, { recursive: true, force: true });
}
