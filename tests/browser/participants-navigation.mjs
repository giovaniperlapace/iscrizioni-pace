import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3106";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw new Error("Local server required");
const route = new URL(
  "../../app/participant-operations-check/",
  import.meta.url,
);
mkdirSync(route, { recursive: true });
writeFileSync(
  new URL("page.tsx", route),
  'export { default } from "@/tests/browser/participant-operations-fixture";',
);
let dialogFlowStarted = false;
const ab = (...args) => {
  // Chrome accessibility snapshots can stall after native dialog transitions.
  // Dialog flows use fresh DOM queries instead of cached accessibility refs.
  if (dialogFlowStarted && args[0] === "snapshot") return "";
  return execFileSync(
    process.env.AGENT_BROWSER_BIN ?? "npx",
    [
      ...(process.env.AGENT_BROWSER_BIN ? [] : ["--yes", "agent-browser"]),
      "--session",
      "participants-navigation",
      ...args,
    ],
    { encoding: "utf8", timeout: 60000 },
  );
};
const ev = (code) => ab("eval", code);
const check = (code, label) => {
  let result = ev(`Boolean(${code})`);
  for (let attempt = 0; !/true/.test(result) && attempt < 20; attempt++) {
    ab("wait", "100");
    result = ev(`Boolean(${code})`);
  }
  if (!/true/.test(result))
    console.log(
      ev(
        'JSON.stringify({url:location.href,dialog:document.querySelector("dialog")?.outerHTML.slice(0,200),body:document.body.innerText.slice(0,200)})',
      ),
    );
  assert.match(result, /true/, label);
  console.log(`PASS ${label}`);
};
const click = (selector, text) => {
  ev(
    `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e=>e.textContent.trim()===${JSON.stringify(text)}).click()`,
  );
  ab("snapshot", "-i");
};
try {
  ab(
    "open",
    `${base}/participant-operations-check?section=iscritti&nav=mini&q=Anna`,
  );
  ab("set", "viewport", "1440", "1000");
  ab("snapshot", "-i");
  click('nav[aria-label="Sezioni partecipanti"] a', "Duplicati");
  check(
    'document.querySelectorAll("table").length===1 && document.querySelector("[aria-label=\\"Tabella possibili duplicati\\"]") && !document.querySelector("input[name=q]")',
    "duplicates replaces participants and filters",
  );
  check(
    '!new URL(location.href).searchParams.has("q") && new URL(location.href).searchParams.get("nav")==="mini"',
    "switch clears hidden filters and preserves sidebar",
  );
  check(
    'Array.from(document.querySelectorAll("th")).map(e=>e.textContent).join(",")==="Partecipante,Email,Gruppo,Motivo,Confronta con,Azioni"',
    "duplicate rows include identity, contact, group, reason, comparison and actions",
  );
  click('nav[aria-label="Sezioni partecipanti"] a', "Senza gruppo");
  check(
    'document.querySelectorAll("table").length===1 && document.querySelectorAll("tbody tr").length===4',
    "without-group replaces duplicates with focused queue",
  );
  click('nav[aria-label="Sezioni partecipanti"] a', "Partecipanti");
  check(
    'document.querySelectorAll("table").length===1 && document.querySelectorAll("tbody tr").length===12',
    "participants restores complete list without stacked tables",
  );
  click('nav[aria-label="Sezioni partecipanti"] a', "Duplicati");
  ab("screenshot", "/tmp/pace-duplicates-desktop.png");
  dialogFlowStarted = true;
  click("tbody a", "Modifica");
  ab("wait", "dialog[open]");
  ab("fill", 'dialog [name="firstName"]', "Anna Maria");
  click("button", "Salva dati");
  ab("wait", "200");
  check(
    'document.querySelector("[data-last-return]").textContent.includes("view=duplicates") && document.querySelector("dialog[open]")',
    "editing from duplicates returns to same view with sheet open",
  );
  ab("press", "Escape");
  ab("wait", "200");
  ab("snapshot", "-i");
  check(
    'document.querySelector("tbody").textContent.includes("Anna Maria Bianchi") && !document.querySelector("dialog[open]")',
    "Escape returns to updated duplicates table",
  );
  click("tbody a", "Escludi");
  ab("wait", "dialog[open]");
  check(
    'document.querySelector("dialog h2").textContent==="Escludi segnalazione" && !document.querySelector("dialog select") && !document.documentElement.dataset.lastQualityDecision',
    "exclude opens focused comparison without writing",
  );
  check(
    'Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Conferma esclusione").disabled',
    "exclusion requires explicit confirmation",
  );
  ab("fill", "dialog textarea", "Persone distinte: verifica con il referente.");
  ab("check", "dialog input[type=checkbox]");
  click("button", "Conferma esclusione");
  check(
    '!document.querySelector("dialog[open]") && document.querySelector("tbody").textContent.includes("Nessun caso")',
    "confirmed exclusion leaves review queue",
  );
  click('nav[aria-label="Viste duplicati"] a', "Esclusi");
  check(
    'document.querySelectorAll("tbody tr").length===2 && !Array.from(document.querySelectorAll("tbody a")).some(e=>e.textContent==="Escludi")',
    "excluded pair remains available without duplicate exclusion action",
  );
  ab("set", "viewport", "390", "844");
  check(
    "document.documentElement.scrollWidth<=innerWidth",
    "mobile navigation and duplicates table do not overflow page",
  );
  ab("screenshot", "/tmp/pace-duplicates-mobile.png");
  assert.equal(ab("errors").trim(), "");
  console.log("PASS no browser errors");
} finally {
  rmSync(route, { recursive: true, force: true });
  ab("close");
}
