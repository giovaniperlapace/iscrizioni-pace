import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const base = process.env.BASE_URL ?? "http://localhost:3117";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/birth-date-check/", import.meta.url);
const publicRoute = new URL("../../app/birth-date-public-check/", import.meta.url);
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "pace-birth-date", ...args], { encoding: "utf8", timeout: 60000 });
const check = (expression, label) => { assert.equal(ab("eval", expression).trim(), "true", label); console.log(`PASS ${label}`); };
const fillDate = value => ab("eval", `(() => { const field = document.querySelector('[name=birthDate]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true })); return field.value; })()`);
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
try {
  for (const path of [route, publicRoute]) mkdirSync(path, { recursive: true });
  copyFileSync(new URL("./birth-date-fixture.tsx", import.meta.url), new URL("page.tsx", route));
  copyFileSync(new URL("./group-questionnaire-fixture.tsx", import.meta.url), new URL("page.tsx", publicRoute));
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"]) {
    ab("open", `${base}/birth-date-check?locale=${locale}`); ab("snapshot", "-i");
    ab("click", 'button[type=submit]');
    check('document.activeElement.name === "birthDate" && document.querySelector("[data-calls]").textContent === "0"', `${locale}: empty date blocked with focus`);
    fillDate("2999-01-01"); ab("click", 'button[type=submit]');
    check('document.querySelector("[name=birthDate]").validity.rangeOverflow && document.querySelector("[data-calls]").textContent === "0"', "future date blocked");
    fillDate(today); ab("snapshot", "-i"); ab("click", 'button[type=submit]');
    check('document.querySelector("[role=status]") && !document.querySelector("[name=birthDateConfirmation]") && document.querySelector("[data-calls]").textContent === "1"', "under-one warning does not block submission or require a checkbox");
    fillDate(yesterday);
    check('Boolean(document.querySelector("[role=status]")) && !document.querySelector("[name=birthDateConfirmation]")', "warning remains for another recent date");
    fillDate("1990-01-02"); ab("click", 'button[type=submit]');
    check('!document.querySelector("[name=birthDateConfirmation]") && document.querySelector("[data-calls]").textContent === "2"', "ordinary date has no extra step");
    ab("open", `${base}/birth-date-public-check?locale=${locale}&link=1`); ab("snapshot", "-i");
    check('document.querySelector("[name=birthDate]").required', "public group registration requires date");
    fillDate(today); ab("snapshot", "-i");
    check('Boolean(document.querySelector("[name=birthDate]").getAttribute("aria-describedby")) && !document.querySelector("[name=birthDateConfirmation]") && document.querySelector("[name=birthDate]").validity.valid', "public registration displays only the warning");
  }
  ab("set", "viewport", "390", "844");
  check('document.documentElement.scrollWidth <= innerWidth', "mobile fits viewport");
  ab("eval", 'document.querySelector("[name=birthDate]").scrollIntoView({block:"start"})');
  ab("screenshot", "/tmp/pace-birth-date-mobile.png");
  assert.equal(ab("errors").trim(), "");
  console.log("PASS no browser errors; synthetic actions only, no registrations or email");
} finally {
  ab("close");
  for (const path of [route, publicRoute]) rmSync(path, { recursive: true, force: true });
}
