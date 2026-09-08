// Local synthetic form only. No production actions, database writes or emails.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3106";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/manual-email-check/", import.meta.url);
mkdirSync(route, { recursive: true });
copyFileSync(new URL("./manual-email-fixture.tsx", import.meta.url), new URL("page.tsx", route));
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "manual-email", ...args], { encoding: "utf8", timeout: 60000 });
const check = (code, label) => {
  assert.match(ab("eval", `Boolean(${code})`), /true/, label);
  console.log(`PASS ${label}`);
};
try {
  ab("open", base); ab("snapshot", "-i");
  check('document.body.innerText.trim().length > 0 && !document.querySelector("[data-nextjs-dialog]")', "home loads");
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"]) {
    ab("open", `${base}/manual-email-check?locale=${locale}`); ab("snapshot", "-i");
    check('document.querySelector("[name=email]").required && !document.querySelector("[name=useLeaderEmail]").checked', `${locale} personal mode default`);
    ab("fill", "[name=email]", "stale@example.org");
    ab("check", "[name=useLeaderEmail]"); ab("snapshot", "-i");
    check('!document.querySelector("[name=email]") && !new FormData(document.querySelector("[name=useLeaderEmail]").form).has("email")', `${locale} delegated email absent from payload`);
    ab("click", 'button[type=submit]'); ab("snapshot", "-i");
    check('JSON.parse(document.querySelector("[data-result]").textContent).value.email === null && JSON.parse(document.querySelector("[data-result]").textContent).value.useLeaderEmail', `${locale} delegated submission accepted without contacts`);
    if (locale === "it") ab("screenshot", "/tmp/manual-email-desktop.png");
    ab("uncheck", "[name=useLeaderEmail]"); ab("snapshot", "-i");
    check('document.querySelector("[name=email]").value === "" && document.querySelector("[name=email]").required', `${locale} return to personal email resets stale value`);
    ab("fill", "[name=email]", "personal@example.org");
    ab("click", 'button[type=submit]'); ab("snapshot", "-i");
    check('JSON.parse(document.querySelector("[data-result]").textContent).value.email === "personal@example.org" && !JSON.parse(document.querySelector("[data-result]").textContent).value.useLeaderEmail', `${locale} personal submission accepted`);
  }
  ab("set", "viewport", "390", "844");
  ab("open", `${base}/manual-email-check?locale=it`); ab("snapshot", "-i");
  ab("check", "[name=useLeaderEmail]"); ab("snapshot", "-i");
  check('document.documentElement.scrollWidth <= innerWidth && !document.querySelector("[name=email]")', "mobile delegated form fits");
  ab("screenshot", "/tmp/manual-email-mobile.png");
  assert.equal(ab("errors").trim(), "");
  console.log("PASS no browser errors");
} finally {
  ab("close");
  rmSync(route, { recursive: true, force: true });
  rmSync(new URL("../../.next/dev/types/app/manual-email-check/", import.meta.url), { recursive: true, force: true });
}
