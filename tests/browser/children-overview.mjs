import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.argv[2] ?? "http://localhost:3128";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base))
  throw new Error("Local server required");
const route = new URL("../../app/children-overview-check/", import.meta.url);
const ab = (...args) =>
  execFileSync(
    "npx",
    ["--yes", "agent-browser", "--session", "pace-children", ...args],
    { encoding: "utf8", timeout: 60000 },
  );
const check = (code, label) => {
  assert.match(ab("eval", `Boolean(${code})`), /true/, label);
  console.log(`PASS ${label}`);
};
try {
  mkdirSync(route, { recursive: true });
  writeFileSync(
    new URL("page.tsx", route),
    'export {default} from "@/tests/browser/children-overview-fixture";',
  );
  for (const dashboard of ["manager", "admin"]) {
    ab(
      "open",
      `${base}/children-overview-check?view=children&dashboard=${dashboard}`,
    );
    ab("snapshot", "-i");
    check(
      'document.querySelectorAll("tbody")[0].rows.length === 2 && document.querySelectorAll("tbody")[1].rows.length === 1',
      `${dashboard}: children and independent under 15 are separate`,
    );
    check(
      'document.body.innerText.includes("1 iscrizioni con età da verificare")',
      "legacy parent with missing data remains visible with both children",
    );
    check(
      'document.querySelectorAll("main nav a")[1].getAttribute("aria-current") === "page"',
      "new menu is second and active",
    );
    check(
      '!document.querySelector("details[open]")',
      "parents initially collapsed",
    );
    ab("eval", 'document.querySelector("summary").focus()');
    ab("press", "Enter");
    check(
      'document.querySelector("details").open',
      "parent expands with keyboard",
    );
    ab("eval", 'document.querySelector("details a").click()');
    ab("snapshot", "-i");
    check(
      '!!document.querySelector("dialog[open]") && new URLSearchParams(location.search).get("edit") === "reg-0"',
      "parent opens existing read-only registration dialog",
    );
    ab("press", "Escape");
    ab("snapshot", "-i");
    check(
      '!document.querySelector("dialog[open]") && new URLSearchParams(location.search).get("view") === "children"',
      "Escape returns to children view",
    );
    ab(
      "eval",
      'document.querySelector("input[name=childrenQuery]").value="Ada"; document.querySelector("input[name=childrenQuery]").form.requestSubmit()',
    );
    ab("snapshot", "-i");
    check(
      'document.querySelectorAll("tbody")[0].rows.length === 1 && document.querySelectorAll("tbody")[1].rows.length === 0',
      "search uses child name",
    );
    ab(
      "open",
      `${base}/children-overview-check?view=children&childrenGroup=none&dashboard=${dashboard}`,
    );
    ab("snapshot", "-i");
    check(
      'document.querySelectorAll("tbody")[0].rows.length === 0 && document.querySelectorAll("tbody")[1].rows.length === 1',
      "without-group filter applies to both tables",
    );
    ab(
      "open",
      `${base}/children-overview-check?view=children&dashboard=${dashboard}`,
    );
    ab("snapshot", "-i");
    ab("screenshot", "--full", `/tmp/pace-children-${dashboard}.png`);
    ab("set", "viewport", "390", "844");
    check(
      "document.documentElement.scrollWidth <= innerWidth",
      "mobile has no page overflow",
    );
    ab("screenshot", "--full", `/tmp/pace-children-${dashboard}-mobile.png`);
    ab("set", "viewport", "1280", "900");
  }
  assert.equal(ab("errors").trim(), "");
} finally {
  ab("close");
  rmSync(route, { recursive: true, force: true });
  rmSync(
    new URL(
      "../../.next/dev/types/app/children-overview-check/",
      import.meta.url,
    ),
    { recursive: true, force: true },
  );
}
