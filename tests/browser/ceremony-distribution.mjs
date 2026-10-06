import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3123";
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const route = "app/ceremony-distribution-check";
assert.ok(
  !existsSync(route),
  "temporary route must not overwrite existing work",
);
mkdirSync(route);
writeFileSync(
  `${route}/page.tsx`,
  'export {default} from "@/tests/browser/ceremony-distribution-fixture";',
);
const ab = (...args) =>
  execFileSync(
    "npx",
    [
      "--no-install",
      "agent-browser",
      "--session",
      "pace-distribution",
      ...args,
    ],
    { encoding: "utf8", timeout: 60000 },
  );
const snap = () => ab("snapshot", "-i");
const check = (code, label) => {
  assert.match(ab("eval", `Boolean(${code})`), /true/, label);
  console.log("PASS " + label);
};
function select(label, value) {
  const line = snap()
    .split("\n")
    .find((l) => l.startsWith(`- combobox "${label}" `));
  assert.ok(line, label);
  ab("select", "@" + line.match(/ref=(e\d+)/)[1], value);
  snap();
}
function click(name, index = 0) {
  ab(
    "eval",
    `Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim()===${JSON.stringify(name)})[${index}]?.scrollIntoView({block:'center'})`,
  );
  const line = snap()
    .split("\n")
    .filter((l) => l.startsWith(`- button "${name}" `))[index];
  assert.ok(line, name);
  ab("click", "@" + line.match(/ref=(e\d+)/)[1]);
  snap();
}
try {
  ab("open", base + "/ceremony-distribution-check");
  snap();
  check('!document.querySelector("[data-nextjs-dialog]")', "no error overlay");
  select("Dotazione", "a");
  click("Assegna un posto", 1);
  ab("wait", "--fn", 'document.body.innerText.includes("Modifica salvata")');
  check(
    'Array.from(document.querySelectorAll("article[data-child] button")).filter(b=>b.textContent==="Assegna un posto").every(b=>b.disabled)',
    "child seat exhausts allowance without assigning parent",
  );
  check(
    'Array.from(document.querySelectorAll("article[data-child=true] button")).filter(b=>b.textContent==="Non serve un posto").some(b=>!b.disabled)',
    "no-seat choice remains possible at full capacity",
  );
  select("Esito test", "lost");
  click("Non serve un posto", 1);
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
  ab("wait", "--fn", 'document.body.innerText.includes("Modifica salvata")');
  assert.equal(
    ab("eval", 'document.querySelector("output").dataset.request'),
    request,
  );
  check(
    'document.querySelector("output").dataset.calls==="3"',
    "uncertain retry uses identical request identity",
  );
  select("Ruolo test", "viewer");
  check(
    '!Array.from(document.querySelectorAll("button")).some(b=>/Assegna un posto|Non serve un posto|Conferma revoca/.test(b.textContent))',
    "viewer has no mutation controls",
  );
  for (const lang of ["en", "fr", "de", "es", "nl", "uk", "it"]) {
    select("Lingua test", lang);
    check(
      'document.querySelector("h1").textContent.length>0 && !document.querySelector("[data-nextjs-dialog]")',
      "translated distribution " + lang,
    );
  }
  ab("set", "viewport", "390", "844");
  snap();
  check(
    "document.documentElement.scrollWidth<=innerWidth",
    "mobile has no horizontal overflow",
  );
  ab(
    "screenshot",
    "/Users/giovaniperlapace/Documents/Codex/2026-10-06/procediamo-con-la-mileston-p13-s/work/ceremony-e2-mobile.png",
  );
  assert.ok(!ab("errors").trim(), "browser errors");
  console.log(
    "PASS synthetic manager/leader shared UI, explicit child decisions, retry and readonly",
  );
} finally {
  try {
    ab("close");
  } catch {}
  rmSync(route, { recursive: true, force: true });
}
