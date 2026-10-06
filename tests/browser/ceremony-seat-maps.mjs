import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3123";
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const route = "app/ceremony-map-check";
assert.ok(!existsSync(route));
mkdirSync(route);
writeFileSync(
  `${route}/page.tsx`,
  'export {default} from "@/tests/browser/ceremony-map-fixture";',
);
const ab = (...a) =>
  execFileSync(
    "npx",
    ["--no-install", "agent-browser", "--session", "pace-e3", ...a],
    { encoding: "utf8", timeout: 60000 },
  );
const snap = () => ab("snapshot", "-i");
const check = (code, label) => {
  assert.match(ab("eval", `Boolean(${code})`), /true/, label);
  console.log("PASS " + label);
};
function control(kind, label, action, value) {
  const line = snap()
    .split("\n")
    .find((l) => l.trimStart().startsWith(`- ${kind} "${label}" `));
  assert.ok(line, `${kind}: ${label}`);
  ab(
    action,
    "@" + line.match(/ref=(e\d+)/)[1],
    ...(value === undefined ? [] : [value]),
  );
  snap();
}
const click = (label) => control("button", label, "click");
const select = (label, value) => control("combobox", label, "select", value);
const saved = () =>
  ab("wait", "--fn", 'document.body.innerText.includes("Modifica salvata")');
try {
  ab("open", base + "/ceremony-map-check");
  snap();
  check(
    '!document.querySelector("[data-nextjs-dialog]") && document.querySelector("h1")',
    "page renders without error",
  );
  select(
    "Dotazione o assegnazione diretta",
    "11111111-1111-4111-8111-000000000050",
  );
  click("Seleziona posti contigui");
  check(
    'document.body.innerText.includes("Selezionati: 2")',
    "two contiguous seats",
  );
  select("Esito test", "lost");
  click("Riserva alla dotazione");
  ab(
    "wait",
    "--fn",
    'document.body.innerText.includes("Esito non confermato")',
  );
  const request = ab(
    "eval",
    'document.querySelector("output").dataset.request',
  );
  click("Riprova la stessa operazione");
  saved();
  assert.equal(
    ab("eval", 'document.querySelector("output").dataset.request'),
    request,
  );
  check(
    'document.body.innerText.includes("Sedute ancora da riservare: 1 / 3")',
    "conversion preserves allowance",
  );
  click("Platea sintetica · Fila A · Posto 1 · Nella dotazione scelta");
  select("Persona con posto assegnato", "11111111-1111-4111-8111-000000000070");
  click("Assegna la seduta alla persona");
  saved();
  check(
    'document.body.innerText.includes("Persone ancora senza seduta: 1")',
    "one numbered seat leaves child pending",
  );
  ab(
    "eval",
    'document.querySelector("[role=region]").scrollIntoView({block:"center"})',
  );
  ab("screenshot", "/tmp/pace-e3-map-desktop.png");
  click("Tabella accessibile");
  check(
    'document.querySelectorAll("input[type=checkbox]").length===20',
    "accessible table offers all seats",
  );
  select("Ruolo test", "leader");
  check(
    '!Array.from(document.querySelectorAll("button")).some(b=>b.textContent==="Riserva alla dotazione")',
    "leader cannot reserve outside allowance",
  );
  select("Ruolo test", "viewer");
  check(
    '!Array.from(document.querySelectorAll("button")).some(b=>b.textContent==="Assegna la seduta alla persona")',
    "viewer read only",
  );
  for (const lang of ["en", "fr", "de", "es", "nl", "uk", "it"]) {
    select("Lingua test", lang);
    check(
      'document.querySelector("h1").textContent.length>0&&!document.querySelector("[data-nextjs-dialog]")',
      "map translation " + lang,
    );
  }
  ab("set", "viewport", "390", "844");
  snap();
  check(
    "document.documentElement.scrollWidth<=innerWidth",
    "mobile without page overflow",
  );
  ab("screenshot", "/tmp/pace-e3-mobile.png");
  select("Ruolo test", "admin");
  ab(
    "eval",
    'Array.from(document.querySelectorAll("summary")).find(x=>x.textContent.includes("Editor admin")).click()',
  );
  snap();
  check(
    'document.body.innerText.includes("Aggiungi una fila")',
    "admin generic editor",
  );
  control(
    "textbox",
    "Titolo della piantina",
    "fill",
    "Bozza sintetica aggiornata",
  );
  click("Salva bozza");
  saved();
  click("Pubblica la versione salvata");
  saved();
  check(
    'document.body.innerText.includes("Versione 2")',
    "admin version publication",
  );
  ab("screenshot", "/tmp/pace-e3-editor-mobile.png");
  check(
    "document.documentElement.scrollWidth<=innerWidth",
    "mobile editor contained",
  );
  select("Esito test", "conflict");
  control(
    "textbox",
    "Titolo della piantina",
    "fill",
    "Bozza conservata dopo conflitto",
  );
  click("Salva bozza");
  ab(
    "wait",
    "--fn",
    'document.body.innerText.includes("La situazione è cambiata")',
  );
  check(
    'Array.from(document.querySelectorAll("input")).some(i=>i.value==="Bozza conservata dopo conflitto")',
    "draft values survive conflict",
  );
  assert.ok(!ab("errors").trim(), "browser errors");
  console.log(
    "PASS synthetic E3 desktop/mobile, selection, retry, versions, personal seats, seven languages and permissions",
  );
} finally {
  try {
    ab("close");
  } catch {}
  rmSync(route, { recursive: true, force: true });
}
