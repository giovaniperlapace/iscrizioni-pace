// Synthetic UI and failure/retry checks; real authentication/SQL is tested separately.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3123";
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):\d+$/);
const route = "app/ceremony-check";
const owned = !existsSync(route);
if (owned) {
  mkdirSync(route);
  writeFileSync(
    `${route}/page.tsx`,
    'export { default } from "@/tests/browser/ceremony-fixture";',
  );
}
const ab = (...args) =>
  execFileSync(
    "npx",
    ["--no-install", "agent-browser", "--session", "pace-ceremony", ...args],
    { encoding: "utf8", timeout: 60000 },
  );
const snapshot = () => ab("snapshot", "-i");
const check = (code, label) => {
  assert.match(ab("eval", `Boolean(${code})`), /true/, label);
  console.log("PASS " + label);
};
const click = (name) => {
  ab(
    "eval",
    `Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(name)})?.scrollIntoView({block:'center'})`,
  );
  const line = snapshot()
    .split("\n")
    .find((line) => line.startsWith(`- button "${name}" `));
  const ref = line?.match(/ref=(e\d+)/)?.[1];
  assert.ok(ref, `button ${name}`);
  ab("click", `@${ref}`);
  snapshot();
};
const select = (label, value) => {
  const line = snapshot()
    .split("\n")
    .find((line) => line.startsWith(`- combobox "${label}" `));
  const ref = line?.match(/ref=(e\d+)/)?.[1];
  assert.ok(ref, `combobox ${label}`);
  ab("select", `@${ref}`, value);
  snapshot();
};
try {
  ab("open", base + "/ceremony-check");
  snapshot();
  check(
    'document.documentElement.scrollWidth<=innerWidth && !document.querySelector("[data-nextjs-dialog]")',
    "desktop layout and no error overlay",
  );
  select("Quota", "11111111-1111-4111-8111-111111111111");
  select("Gruppo", "11111111-1111-4111-8111-111111111111");
  ab("find", "label", "Posti da assegnare al gruppo", "fill", "90");
  click("Conferma assegnazione");
  ab("wait", "--fn", 'document.body.innerText.includes("Posti insufficienti")');
  check(
    'document.querySelector("form:has(input[value=allocate]) [name=quantity]").value==="90"',
    "capacity error preserves quantity",
  );
  select("Esito test", "conflict");
  click("Conferma assegnazione");
  ab(
    "wait",
    "--fn",
    'document.body.innerText.includes("La configurazione è cambiata")',
  );
  check(
    'document.querySelector("form:has(input[value=allocate]) [name=quantity]").value==="90"',
    "revision conflict preserves quantity",
  );
  select("Destinatario", "person");
  check(
    'document.querySelector("[name=registrationId]").options.length===2',
    "only eligible person selectable",
  );
  select("Ruolo test", "manager");
  check(
    '!Array.from(document.querySelectorAll("summary")).some(s=>/Modifica configurazione|Modifica settore|Aggiungi settore/.test(s.textContent))',
    "manager cannot configure venue",
  );
  select("Ruolo test", "viewer");
  check(
    'document.querySelectorAll("form:has(input[name=operation])").length===0',
    "viewer has no mutation forms",
  );
  select("Ruolo test", "admin");
  select("Configurazione test", "draft");
  check(
    '!document.querySelector("[name=quotaId]") && document.body.innerText.includes("Bozza")',
    "unknown draft cannot allocate",
  );
  select("Configurazione test", "empty");
  check(
    'document.querySelector("[name=capacity]").value===""',
    "new venue capacity not invented",
  );
  ab("set", "viewport", "390", "844");
  snapshot();
  check(
    "document.documentElement.scrollWidth<=innerWidth",
    "mobile configuration fits",
  );
  if (process.env.CEREMONY_SCREENSHOT_DIR)
    ab(
      "screenshot",
      `${process.env.CEREMONY_SCREENSHOT_DIR}/ceremony-mobile.png`,
    );
  select("Configurazione test", "ready");
  check(
    "document.documentElement.scrollWidth<=innerWidth",
    "mobile allocation fits",
  );
  assert.equal(ab("errors").trim(), "", "browser runtime errors");
  console.log(
    "PASS browser: synthetic admin/manager/viewer, error preservation, unknown dates/capacity and mobile",
  );
} catch (error) {
  console.error(ab("get", "text", "body"));
  console.error(
    ab(
      "eval",
      'JSON.stringify(Array.from(document.querySelectorAll("form:has(input[value=allocate]) input, form:has(input[value=allocate]) select")).map(e=>({name:e.name,value:e.value,valid:e.validity.valid})))',
    ),
  );
  throw error;
} finally {
  ab("close");
  if (owned) rmSync(route, { recursive: true });
}
