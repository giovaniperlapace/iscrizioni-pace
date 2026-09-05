import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3115";
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
const ab = (...args) =>
  execFileSync(
    process.env.AGENT_BROWSER_BIN ?? "npx",
    [
      ...(process.env.AGENT_BROWSER_BIN ? [] : ["--yes", "agent-browser"]),
      "--session", "participant-operations", ...args,
    ],
    { encoding: "utf8", timeout: 60000 },
  );
const evaluate = (code) => ab("eval", code);
const check = (code, label) => {
  const result = evaluate(`Boolean(${code})`);
  if (!/true/.test(result)) {
    console.log(evaluate('JSON.stringify({href:location.href,dialog:document.querySelector("dialog")?.outerHTML.slice(0,500),scroll:scrollY})'));
    ab("screenshot", "/tmp/pace-block5-browser-failure.png");
  }
  assert.match(result, /true/, label);
  console.log(`PASS ${label}`);
};
const clickText = (selector, text) =>
  evaluate(
    `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e => e.textContent.trim() === ${JSON.stringify(text)}).click()`,
  );
const navigate = (query) =>
  evaluate(
    `history.replaceState(null, "", "/participant-operations-check?section=iscritti&nav=mini&${query}")`,
  );
try {
  ab("open", `${base}/participant-operations-check?section=iscritti&nav=mini`);
  ab("set", "viewport", "1280", "900");
  ab("snapshot", "-i");
  evaluate(
    'localStorage.removeItem("iscrizioni:participants:v2:browser-operator-a"); localStorage.removeItem("iscrizioni:participants:v2:browser-operator-b"); window.dispatchEvent(new Event("participant-preferences"))',
  );
  check(
    'document.querySelectorAll("tbody tr").length === 12 && !Array.from(document.querySelectorAll("th")).some(th => th.textContent === "Azioni")',
    "shared table loads without Actions",
  );
  clickText("summary", "Colonne visibili");
  ab("snapshot", "-i");
  evaluate(
    'Array.from(document.querySelectorAll("fieldset[aria-label=\\"Colonne visibili\\"] label")).find(e => e.textContent === "Paese").querySelector("input").click()',
  );
  check(
    'Array.from(document.querySelectorAll("th")).some(th => th.textContent === "Paese")',
    "operator can reveal country column",
  );
  clickText("th button", "Partecipante");
  check(
    'document.querySelector("th").getAttribute("aria-sort") === "descending"',
    "header sorting is accessible",
  );
  navigate("");
  check(
    'Array.from(document.querySelectorAll("th")).some(th => th.textContent === "Paese") && document.querySelector("th").getAttribute("aria-sort") === "descending"',
    "saved preferences survive a clean URL",
  );
  clickText("button", "Cambia operatore");
  check(
    '!Array.from(document.querySelectorAll("th")).some(th => th.textContent === "Paese") && document.querySelector("th").getAttribute("aria-sort") === "ascending"',
    "preferences isolated per operator",
  );
  clickText("button", "Cambia operatore");
  ab("select", '[aria-label="Gruppo di Anna Bianchi"]', "group2");
  ab("wait", "200");
  check(
    'document.querySelector("[aria-label=\\"Gruppo di Anna Bianchi\\"]").value === "group2"',
    "group saves inline",
  );
  ab("select", '[aria-label="Servizio di Anna Bianchi"]', "service1");
  ab("wait", "200");
  check(
    'document.querySelector("[aria-label=\\"Servizio di Anna Bianchi\\"]").value === "service1"',
    "service saves inline",
  );
  ab("click", '[aria-label="Tag di Anna Bianchi"]');
  ab("snapshot", "-i");
  evaluate(
    'document.querySelector("[aria-label=\\"Tag operativi di Anna Bianchi\\"] input").click()',
  );
  ab("wait", "200");
  evaluate(
    'document.querySelectorAll("[aria-label=\\"Tag operativi di Anna Bianchi\\"] input")[1].click()',
  );
  ab("wait", "200");
  check(
    'document.querySelectorAll("[aria-label=\\"Tag operativi di Anna Bianchi\\"] input:checked").length === 2',
    "multi-tag inline selection retains both tags",
  );
  evaluate('document.documentElement.dataset.failNext="true"');
  ab("select", '[aria-label="Gruppo di Anna Bianchi"]', "group1");
  ab("wait", "200");
  check(
    'document.querySelector("[aria-label=\\"Gruppo di Anna Bianchi\\"]").value === "group2" && document.querySelector("[role=alert]")?.textContent.includes("Errore simulato")',
    "failed edit preserves value and shows row error",
  );
  clickText("a", "Senza gruppo");
  ab("snapshot", "-i");
  check(
    'Array.from(document.querySelectorAll("th")).map(th=>th.textContent).join(",") === "Partecipante,Paese,Città,Età,Gruppo" && document.querySelectorAll("tbody tr").length === 3',
    "without-group queue has focused columns",
  );
  ab("select", '[aria-label="Gruppo di Persona Prova 3"]', "group1");
  ab("wait", "200");
  check(
    '!document.querySelector("[data-registration-id=reg-3]") && document.querySelectorAll("tbody tr").length === 2',
    "assigned row leaves queue immediately",
  );
  clickText("a", "Tutti gli iscritti");
  evaluate('window.scrollTo(0,500); document.documentElement.dataset.previousScroll = String(window.scrollY)');
  clickText("a", "Persona Prova 11");
  ab("fill", 'dialog [name="firstName"]', "Persona Controllo");
  clickText("button", "Salva dati"); ab("wait", "200");
  check('Math.abs(window.scrollY - Number(document.documentElement.dataset.previousScroll)) < 2', 'sheet save preserves background scroll position');
  ab("click", '[aria-label="Chiudi scheda partecipante"]');
  ab("snapshot", "-i");
  navigate(
    "q=Anna&sort=country&direction=desc&columns=name,country,group,service,tags",
  );
  clickText("a", "Anna Bianchi");
  ab("snapshot", "-i");
  check(
    'document.querySelector("dialog[open]") && document.querySelector("dialog [aria-label=\\"Servizio di Anna Bianchi\\"]")',
    "name opens accessible dialog with same operational selectors",
  );
  evaluate('document.querySelector("dialog > div:last-child").scrollTop=0');
  ab("fill", 'dialog [name="firstName"]', "Anna Maria");
  clickText("button", "Salva dati");
  ab("wait", "200");
  check(
    'document.querySelector("dialog[open]") && document.querySelector("[data-last-return]").textContent.includes("section=iscritti") && ["q=Anna","sort=country","direction=desc","columns=","nav=mini"].every(x=>document.querySelector("[data-last-return]").textContent.includes(x))',
    "sheet save preserves participants section, filters, sort, columns, sidebar and open dialog",
  );
  ab("screenshot", "/tmp/pace-block5-dialog-desktop.png");
  ab("set", "viewport", "390", "844");
  check(
    'document.documentElement.scrollWidth <= innerWidth && document.querySelector("dialog").getBoundingClientRect().width <= innerWidth',
    "mobile dialog fits viewport",
  );
  ab("screenshot", "/tmp/pace-block5-dialog-mobile.png");
  ab("press", "Escape");
  ab("wait", "300");
  check(
    '!document.querySelector("dialog[open]") && new URL(location.href).searchParams.get("q") === "Anna"',
    "Escape closes dialog retaining filters",
  );
  clickText("a", "Anna Maria Bianchi");
  ab("snapshot", "-i");
  ab("fill", 'dialog [name="reason"]', "Duplicate registration");
  ab("check", 'dialog [name="confirmLifecycle"]');
  clickText("button", "Elimina iscrizione");
  ab("wait", "200");
  check(
    '!document.querySelector("[data-registration-id=reg-0]") && !document.querySelector("dialog[open]")',
    "soft deletion removes row and closes sheet",
  );
  clickText("a", "Iscrizioni eliminate");
  ab("snapshot", "-i");
  clickText("a", "Anna Maria Bianchi");
  ab("wait", "dialog[open]");
  check(
    'document.querySelector("dialog").textContent.includes("Duplicate registration") && !document.querySelector("dialog select")',
    "archive shows reason without operational edits",
  );
  ab("fill", 'dialog [name="reason"]', "Deleted by mistake");
  ab("check", 'dialog [name="confirmLifecycle"]');
  clickText("button", "Ripristina iscrizione");
  ab("wait", "200");
  check(
    '!document.querySelector("[data-registration-id=reg-0]")',
    "restored row leaves archive",
  );
  clickText("a", "Tutti gli iscritti");
  check(
    'document.querySelector("[data-registration-id=reg-0]")',
    "restored row returns to operations",
  );
  clickText("button", "Modalità sola lettura");
  check(
    '!document.querySelector("tbody select") && document.querySelector("tbody a")',
    "viewer has details without quick edits",
  );
  check(
    "document.documentElement.scrollWidth <= innerWidth",
    "mobile page uses table scrolling without page overflow",
  );
  ab("screenshot", "/tmp/pace-block5-mobile.png");
  assert.equal(ab("errors").trim(), "");
  console.log("PASS no browser errors");
} finally {
  rmSync(route, { recursive: true, force: true });
  rmSync(
    new URL(
      "../../.next/dev/types/app/participant-operations-check/",
      import.meta.url,
    ),
    { recursive: true, force: true },
  );
  ab("close");
}
