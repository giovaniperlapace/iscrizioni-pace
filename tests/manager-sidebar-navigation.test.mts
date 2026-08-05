import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const managerDashboard = readFileSync(
  join(process.cwd(), "app/dashboard/manager/page.tsx"),
  "utf8"
);

const managerSidebar = managerDashboard.slice(
  managerDashboard.indexOf("function ManagerSidebar"),
  managerDashboard.indexOf("function managerPath")
);

test("manager sidebar is compact unless full mode is explicitly requested", () => {
  assert.match(
    managerDashboard,
    /const navMode: ManagerNavMode = params\.nav === "full" \? "full" : "mini";/
  );
});

test("manager menu navigation always closes the sidebar", () => {
  const menuLinks = managerSidebar.match(
    /href: "\/dashboard\/manager\?section=[a-z]+&nav=mini"/g
  );

  assert.equal(menuLinks?.length, 7);
  assert.doesNotMatch(managerSidebar, /href: `[^`]*nav=\$\{navMode\}`/);
});
