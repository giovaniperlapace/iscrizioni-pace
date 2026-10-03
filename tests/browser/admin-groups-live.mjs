import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3134";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/admin-groups-live-check/", import.meta.url);
mkdirSync(route, { recursive: true });
copyFileSync(new URL("./admin-groups-live-fixture.tsx", import.meta.url), new URL("page.tsx", route));
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "pace-group-live", ...args], { encoding: "utf8", timeout: 60000 });
function check(expression, label) {
  assert.equal(ab("eval", expression).trim(), "true", label);
  console.log(`PASS ${label}`);
}
try {
  ab("open", `${base}/admin-groups-live-check?section=gruppi&nav=mini`);
  ab("snapshot", "-i");
  ab("eval", 'window.__requests=[]; const originalFetch=window.fetch; window.fetch=(...args)=>{window.__requests.push(String(args[0]));return originalFetch(...args)}');
  for (let length = 1; length <= "trastevere".length; length++) {
    ab("fill", "#admin-group-q", "trastevere".slice(0, length));
    check(`document.querySelectorAll("tbody tr").length===${length === 1 ? 2 : 1} && document.querySelector("tbody").textContent.includes("Assemblea di Trastevere") && document.activeElement.id==="admin-group-q"`, `letter ${length}: filters without Enter, retains focus`);
  }
  check('window.__requests.length===0', "no server requests while typing");
  ab("press", "Enter");
  check('document.querySelectorAll("tbody tr").length===1', "Enter preserves results");
  ab("reload"); ab("snapshot", "-i");
  check('document.querySelector("#admin-group-q").value==="trastevere" && document.querySelectorAll("tbody tr").length===1', "reload restores filter from URL");
  ab("fill", "#admin-group-q", "no-match");
  check('document.querySelectorAll("tbody tr").length===0 && document.querySelector("[role=status]").textContent.includes("Nessun gruppo")', "empty result");
  ab("find", "role", "button", "click", "--name", "Reset", "--exact");
  check('document.querySelectorAll("tbody tr").length===3 && !location.search.includes("groupQ") && location.search.includes("nav=mini")', "reset restores all and preserves navigation");
  ab("select", "#admin-group-visibility", "internal");
  check('document.querySelectorAll("tbody tr").length===1 && document.querySelector("tbody").textContent.includes("Roma")', "non-assignable filter");
  ab("select", "#admin-group-visibility", "reserved");
  ab("fill", "#admin-group-q", "LUCIA");
  check('document.querySelectorAll("tbody tr").length===1 && document.querySelector("tbody").textContent.includes("Gruppo riservato")', "combined visibility and case insensitive leader search");
  ab("select", "#admin-group-type", "city");
  check('document.querySelectorAll("tbody tr").length===0', "combined node type filter");
  assert.equal(ab("errors").trim(), "");
  console.log("PASS no browser errors");
} finally {
  ab("close");
  rmSync(route, { recursive: true, force: true });
  rmSync(new URL("../../.next/dev/types/app/admin-groups-live-check/", import.meta.url), { recursive: true, force: true });
}
