// Run with a local dev server: node tests/browser/forms-reliability.mjs http://localhost:3105
// Uses synthetic inputs; no registration or email is created.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, rmdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3105";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local dev server required");
const route = new URL("../../app/form-reliability-check/", import.meta.url);
mkdirSync(route, { recursive: true });
copyFileSync(new URL("./form-fixture.tsx", import.meta.url), new URL("page.tsx", route));
const postRoute = new URL("post/", route);
mkdirSync(postRoute, { recursive: true });
writeFileSync(new URL("route.ts", postRoute), 'export { POST } from "@/app/dashboard/admin/participants/update/route";\n');
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "form-affidabili", ...args], { encoding: "utf8", timeout: 60000 });
const evaluate = (code) => ab("eval", code);
function check(code, label) {
  const output = evaluate(`Boolean(${code})`);
  assert.match(output, /true/, `${label}: ${output}`);
  console.log(`PASS ${label}`);
}
function fillBase(phone = "+39 333 1234567") {
  ab("select", '[name="groupId"]', "11111111-1111-4111-8111-111111111111");
  ab("fill", '[name="firstName"]', "Mario"); ab("fill", '[name="lastName"]', "Prova");
  ab("fill", '[name="email"]', "duplicate@example.org"); ab("fill", '[name="phone"]', phone);
  ab("fill", '[name="leaderNote"]', "Testo da conservare"); ab("check", '[name="consentConfirmed"]');
}
function submit() { ab("find", "role", "button", "click", "--name", "Inserisci partecipante"); }
try {
  ab("open", `${base}/form-reliability-check`); ab("snapshot", "-i");
  submit();
  check('document.activeElement?.getAttribute("name") === "groupId"', "first invalid field follows form order");
  fillBase("3331234567");
  ab("select", '[name="hasAccessibilityNeeds"]', "yes"); ab("snapshot", "-i");
  ab("check", '[name="accessibility_hearing"]');
  submit();
  check('document.activeElement?.getAttribute("name") === "phone"', "focus on missing phone prefix");
  check('document.querySelector("[name=phone]").value === "3331234567" && document.querySelector("[name=leaderNote]").value === "Testo da conservare"', "uncontrolled values retained");
  check('document.querySelector("[name=accessibility_hearing]").checked && document.querySelector("[role=dialog]")', "conditional values and overlay retained");
  check('document.querySelector("[name=phone]").getAttribute("aria-describedby") && document.querySelector("[data-form-error]").textContent.includes("prefisso internazionale")', "inline accessible phone guidance");
  check('!document.querySelector("[name=accessibilityNotes],[name=needsOperationalSupport]")', "retired controls absent");
  ab("screenshot", "/tmp/form-affidabili-validation-desktop.png");
  ab("fill", '[name="phone"]', "+39 333 1234567"); submit();
  ab("wait", '[name="email"][aria-invalid="true"]');
  check('document.activeElement?.getAttribute("name") === "email" && location.pathname === "/form-reliability-check"', "server duplicate error remains inline without navigation");
  check('document.querySelector("[name=firstName]").value === "Mario" && document.querySelector("[name=accessibility_hearing]").checked', "server error retains native and controlled values");
  // A successful retry must keep the original server-action redirect behavior.
  ab("fill", '[name="email"]', "valid@example.org"); submit(); ab("wait", "--url", "**saved=1");
  check('document.querySelector("[role=status]").textContent === "Salvato"', "corrected submission follows success redirect");
  ab("open", `${base}/form-reliability-check?mode=server`); ab("snapshot", "-i"); fillBase(); submit();
  ab("wait", '[name="phone"][aria-invalid="true"]');
  check('document.activeElement?.getAttribute("name") === "phone" && document.querySelector("[name=leaderNote]").value === "Testo da conservare"', "real manual server action validation preserves values");
  // Route handler returns a structured error for a synthetic invalid registration.
  ab("open", `${base}/form-reliability-check?mode=http`); ab("snapshot", "-i"); fillBase();
  submit();
  ab("wait", '[role="alert"]');
  check('document.querySelector("[role=alert]") && document.activeElement?.getAttribute("role") === "alert" && document.querySelector("[name=leaderNote]").value === "Testo da conservare" && location.search === "?mode=http"', "HTTP route error retains overlay and focuses its message");
  ab("set", "viewport", "390", "844");
  ab("screenshot", "/tmp/form-affidabili-validation-mobile.png");
  check('document.documentElement.scrollWidth <= window.innerWidth', "mobile overlay fits viewport");
  const errors = ab("errors"); assert.equal(errors.trim(), "", errors);
  console.log("PASS no browser errors");
} finally {
  ab("close");
  rmSync(new URL("page.tsx", route));
  rmSync(new URL("route.ts", postRoute));
  rmdirSync(postRoute);
  rmdirSync(route);
  // Next webpack keeps generated route types after the temporary page disappears.
  rmSync(new URL("../../.next/dev/types/app/form-reliability-check/", import.meta.url), { recursive: true, force: true });
}
