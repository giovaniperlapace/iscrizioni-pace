// Synthetic local form only. Never submits a registration or sends email.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3127";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/country-normalization-check/", import.meta.url);
mkdirSync(route, { recursive: true });
copyFileSync(new URL("./group-questionnaire-fixture.tsx", import.meta.url), new URL("page.tsx", route));
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "pace-country", ...args], { encoding: "utf8", timeout: 60000 });
function check(expression, label) {
  assert.equal(ab("eval", expression).trim(), "true", label);
  console.log(`PASS ${label}`);
}
try {
  for (const [locale, label] of [["it", "Spagna"], ["en", "Spain"], ["fr", "Espagne"], ["de", "Spanien"], ["es", "España"], ["nl", "Spanje"], ["uk", "Іспанія"]]) {
    ab("open", `${base}/country-normalization-check?locale=${locale}`);
    ab("snapshot", "-i");
    ab("fill", "[data-field=country]", label);
    ab("snapshot", "-i");
    ab("find", "role", "button", "click", "--name", label, "--exact");
    check('document.querySelector("[name=countryOther]").value === "Spagna"', `${locale}: localized choice sends canonical country`);
    ab("click", "[data-field=city]");
    check('Array.from(document.querySelectorAll("button")).some(b => b.textContent.trim() === "Madrid")', `${locale}: canonical country retains city options`);
    ab("click", "[data-field=country]");
    ab("snapshot", "-i");
    ab("find", "role", "button", "click", "--name", "Altro / non in lista", "--exact");
    ab("snapshot", "-i");
    ab("fill", "div.grid > input[data-field=country]", "España");
    check('document.querySelector("[name=countryOther]").value === "España"', `${locale}: other-country variant reaches server validation`);
    check('Array.from(document.querySelectorAll("[data-field=country]")).every(e => !e.validity.customError)', `${locale}: Spain variant is valid`);
  }
  ab("set", "viewport", "390", "844");
  ab("eval", 'document.querySelector("[data-field=country]").scrollIntoView({block:"center"})');
  check('document.documentElement.scrollWidth <= window.innerWidth', "mobile fits viewport");
  ab("screenshot", "/tmp/pace-country-mobile.png");
  ab("set", "viewport", "1280", "900");
  ab("screenshot", "/tmp/pace-country-desktop.png");
  assert.equal(ab("errors").trim(), "");
  console.log("PASS no browser errors");
} finally {
  ab("close");
  rmSync(route, { recursive: true, force: true });
  rmSync(new URL("../../.next/dev/types/app/country-normalization-check/", import.meta.url), { recursive: true, force: true });
}
