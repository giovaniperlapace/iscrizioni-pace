// Synthetic controls only; database transactions are covered by the SQL suite.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3107";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) throw new Error("Local server required");
const route = new URL("../../app/operational-groups-check/", import.meta.url);
mkdirSync(route, { recursive: true });
writeFileSync(new URL("page.tsx", route), 'export { default } from "@/tests/browser/operational-groups-fixture";');
const ab = (...args) => execFileSync("npx", ["--yes", "agent-browser", "--session", "automatic-group-controls", ...args], { encoding: "utf8", timeout: 60000 });
const check = (code, label) => { assert.match(ab("eval", `Boolean(${code})`), /true/, label); console.log(`PASS ${label}`); };
try {
 ab("open", `${base}/operational-groups-check`); ab("snapshot", "-i");
 check('document.querySelector("[name=groupNodeType]").value === "group" && document.querySelector("[name=isAssignable]").value === "on"', 'new group is assignable by default');
 ab("screenshot", "/tmp/automatic-group-desktop.png");
 ab("select", '[name="groupNodeType"]', "city"); ab("snapshot", "-i");
 check('document.querySelector("[name=isAssignable]").value === "off" && document.querySelector("input[type=search]").required', 'city structural by default and requires parent');
 ab("click", 'input[type="search"]'); ab("snapshot", "-i");
 ab("find", "role", "button", "click", "--name", "Italia");
 check('document.querySelector("[name=parentGroupId]").value === "country"', 'city selects country');
 ab("check", 'input[type="checkbox"]');
 check('document.querySelector("[name=isAssignable]").value === "on"', 'territorial node can explicitly receive registrations');
 ab("select", '[name="groupNodeType"]', "country"); ab("snapshot", "-i");
 check('!document.querySelector("input[type=search]") && document.querySelector("[name=parentGroupId]").value === ""', 'country has no parent');
 ab("find", "role", "button", "click", "--name", "Cambia modalità"); ab("snapshot", "-i");
 check('document.querySelector("[name=groupNodeType]").value === "group" && document.querySelector("[name=parentGroupId]").value === "city"', 'editing actual group preserves placement');
 ab("fill", 'input[type="search"]', "Discendente"); ab("snapshot", "-i");
 check('!Array.from(document.querySelectorAll("button")).some(b=>b.textContent.includes("Discendente"))', 'descendants excluded from parent selection');
 ab("set", "viewport", "390", "844");
 check('document.documentElement.scrollWidth <= innerWidth', 'mobile fits viewport');
 ab("screenshot", "/tmp/automatic-group-mobile.png");
 check('!document.querySelector("[data-nextjs-dialog]")', 'no framework error overlay');
 assert.equal(ab("errors").trim(), "");
 console.log('PASS no browser errors');
} finally {
 ab("close"); rmSync(route, { recursive: true, force: true });
 rmSync(new URL("../../.next/dev/types/app/operational-groups-check/", import.meta.url), { recursive: true, force: true });
}
