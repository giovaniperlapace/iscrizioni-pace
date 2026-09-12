// Local synthetic form only. No production actions, database writes or emails.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3106";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/leader-attendance-check/", import.meta.url);
mkdirSync(route, { recursive: true });
copyFileSync(new URL("./leader-attendance-fixture.tsx", import.meta.url), new URL("page.tsx", route));
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "leader-attendance", ...args], { encoding: "utf8", timeout: 60000 });
const check = (code, label) => {
  assert.match(ab("eval", `Boolean(${code})`), /true/, label);
  console.log(`PASS ${label}`);
};
try {
  ab("open", base); ab("snapshot", "-i");
  check('document.body.innerText.trim().length > 0 && !document.querySelector("[data-nextjs-dialog]")', "home loads");
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"]) {
    ab("open", `${base}/leader-attendance-check?locale=${locale}`); ab("snapshot", "-i");
    check('document.querySelectorAll("[name=availabilitySlots]:checked").length === 1', `${locale} existing attendance`);
    ab("check", '[value="2026-10-26__afternoon"]'); ab("click", 'button[type=submit]'); ab("snapshot", "-i");
    check('JSON.parse(document.querySelector("[data-result]").textContent).value.slots.length === 2', `${locale} edited selection submits`);
    if (locale === "it") ab("screenshot", "/tmp/leader-attendance-desktop.png");
    ab("check", "[name=availabilityUnknown]"); ab("click", 'button[type=submit]'); ab("snapshot", "-i");
    check('JSON.parse(document.querySelector("[data-result]").textContent).value.unknown && JSON.parse(document.querySelector("[data-result]").textContent).value.slots.length === 0', `${locale} unknown clears dates`);
    ab("uncheck", "[name=availabilityUnknown]"); ab("click", 'button[type=submit]'); ab("snapshot", "-i");
    check('!!document.querySelector("[role=alert]")', `${locale} empty selection error`);
  }
  ab("set", "viewport", "390", "844");
  ab("open", `${base}/leader-attendance-check?locale=uk`); ab("snapshot", "-i");
  check('document.documentElement.scrollWidth <= innerWidth', "mobile page fits");
  ab("screenshot", "/tmp/leader-attendance-mobile.png");
  assert.equal(ab("errors").trim(), "");
  console.log("PASS no browser errors");
} finally {
  ab("close");
  rmSync(route, { recursive: true, force: true });
  rmSync(new URL("../../.next/dev/types/app/leader-attendance-check/", import.meta.url), { recursive: true, force: true });
}
