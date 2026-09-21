import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const base = process.env.BASE_URL ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/public-registration-controls-check/", import.meta.url);
mkdirSync(route, { recursive: true });
copyFileSync(new URL("./group-questionnaire-fixture.tsx", import.meta.url), new URL("page.tsx", route));
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "pace-public-controls", ...args], { encoding: "utf8", timeout: 60000 });
function fillBirthDate(value) {
  ab("eval", `(() => { const input = document.querySelector("[name=child_0_birthDate]"); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); })()`);
}
function check(expression, label) {
  assert.equal(ab("eval", expression).trim(), "true", label);
  console.log(`PASS ${label}`);
}
try {
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"]) {
    for (const link of ["", "1"]) {
      ab("open", `${base}/public-registration-controls-check?locale=${locale}&link=${link}`);
      ab("snapshot", "-i");
      ab("fill", "[name=emailConfirmation]", "typo@example.org");
      check('document.querySelector("[name=emailConfirmation]").validity.customError', `${locale}/${link}: mismatch rejected`);
      ab("fill", "[name=emailConfirmation]", "SYNTHETIC@example.org");
      check('document.querySelector("[name=emailConfirmation]").validity.valid', "matching normalized emails accepted");
      ab("click", 'button[data-field=participatesWithChildren]:first-of-type');
      ab("snapshot", "-i");
      check('document.querySelector("#children-help").textContent.includes("17") && !document.querySelector("input[type=range]")', "localized explanation and no slider");
      fillBirthDate("1990-01-01");
      check('document.querySelector("[name=child_0_birthDate]").validity.rangeUnderflow', "adult rejected in browser");
      fillBirthDate("2099-01-01");
      check('document.querySelector("[name=child_0_birthDate]").validity.rangeOverflow', "future birth date rejected");
      fillBirthDate(new Date().toISOString().slice(0, 10));
      check('document.querySelector("[name=child_0_birthDate]").validity.valid', "newborn accepted");
    }
  }
  ab("set", "viewport", "390", "844");
  check('document.documentElement.scrollWidth <= window.innerWidth', "mobile fits viewport");
  ab("screenshot", "/tmp/pace-public-controls-mobile.png");
  ab("set", "viewport", "1280", "900");
  ab("screenshot", "/tmp/pace-public-controls-desktop.png");
  assert.equal(ab("errors").trim(), "");
  console.log("PASS no browser errors; no submissions performed");
} finally {
  ab("close");
  rmSync(route, { recursive: true, force: true });
  rmSync(new URL("../../.next/dev/types/app/public-registration-controls-check/", import.meta.url), { recursive: true, force: true });
}
