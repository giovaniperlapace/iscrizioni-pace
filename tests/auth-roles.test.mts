import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardRoleTabs } from "../lib/auth/dashboard-tabs.ts";
import {
  dashboardRoleFromPath,
  isRoleAllowedForDashboard,
  pickDashboardRole,
  type DashboardRole,
} from "../lib/auth/roles.ts";

test("pickDashboardRole gives priority to operational roles", () => {
  assert.equal(pickDashboardRole(["capogruppo", "manager"]), "manager");
  assert.equal(pickDashboardRole(["capogruppo"]), "capogruppo");
  assert.equal(pickDashboardRole([]), "partecipante");
});

test("pickDashboardRole honors allowed requested roles", () => {
  assert.equal(
    pickDashboardRole(["manager", "capogruppo"], "capogruppo"),
    "capogruppo"
  );
  assert.equal(pickDashboardRole(["capogruppo"], "admin"), "capogruppo");
});

test("admin can access every dashboard", () => {
  const roles = new Set<DashboardRole>(["admin", "partecipante"]);

  assert.equal(isRoleAllowedForDashboard("admin", roles), true);
  assert.equal(isRoleAllowedForDashboard("manager", roles), true);
  assert.equal(isRoleAllowedForDashboard("accoglienza", roles), true);
  assert.equal(isRoleAllowedForDashboard("capogruppo", roles), true);
});

test("manager and manager viewer can access the manager and personal dashboards", () => {
  assert.equal(
    isRoleAllowedForDashboard(
      "manager",
      new Set<DashboardRole>(["manager_viewer", "partecipante"])
    ),
    true
  );
  assert.equal(
    isRoleAllowedForDashboard(
      "accoglienza",
      new Set<DashboardRole>(["manager_viewer", "partecipante"])
    ),
    false
  );
  assert.equal(
    isRoleAllowedForDashboard(
      "capogruppo",
      new Set<DashboardRole>(["manager", "capogruppo", "partecipante"])
    ),
    true
  );
  assert.equal(
    isRoleAllowedForDashboard(
      "partecipante",
      new Set<DashboardRole>(["manager", "partecipante"])
    ),
    true
  );
});

test("dashboard tabs expose all assigned areas to managers", () => {
  const tabs = getDashboardRoleTabs([
    { role: "manager", eventId: "event-1" },
    { role: "manager_viewer", eventId: "event-1" },
    { role: "capogruppo", eventId: "event-1" },
  ]);

  assert.deepEqual(
    tabs.map((tab) => tab.key),
    ["manager", "capogruppo", "partecipante"]
  );
});

test("dashboard tabs expose delegated admin areas", () => {
  const tabs = getDashboardRoleTabs([{ role: "admin", eventId: null }]);

  assert.deepEqual(
    tabs.map((tab) => tab.key),
    ["admin", "manager", "accoglienza", "capogruppo", "partecipante"]
  );
  assert.deepEqual(
    tabs.map((tab) => tab.label),
    [
      "Dashboard admin",
      "Dashboard manager",
      "Dashboard accoglienza",
      "Dashboard capogruppo",
      "Iscrizione e QR personale",
    ]
  );
});

test("dashboardRoleFromPath maps protected route groups", () => {
  assert.equal(dashboardRoleFromPath("/dashboard/admin/users"), "admin");
  assert.equal(dashboardRoleFromPath("/dashboard/manager"), "manager");
  assert.equal(dashboardRoleFromPath("/dashboard/accoglienza/scan"), "accoglienza");
  assert.equal(dashboardRoleFromPath("/dashboard/partecipante"), "partecipante");
  assert.equal(dashboardRoleFromPath("/dashboard"), null);
});

for (const role of ["manager", "manager_viewer"] as const) {
  test(`${role} can select the personal area in every language without losing its operational area`, () => {
    assert.equal(pickDashboardRole([role], "partecipante"), "partecipante");
    for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"] as const) {
      const tabs = getDashboardRoleTabs([{ role, eventId: "event" }], locale);
      assert.deepEqual(tabs.map(tab => tab.key), ["manager", "partecipante"]);
      assert.equal(tabs[1].href, "/dashboard/partecipante");
      assert.ok(tabs[1].label.length > 0);
    }
  });
}


test("all operational role combinations expose and authorize every assigned dashboard", () => {
  const assignable = ["manager", "manager_viewer", "accoglienza", "capogruppo"] as const;
  for (let mask = 0; mask < 1 << assignable.length; mask++) {
    const assigned = assignable.filter((_, index) => mask & (1 << index));
    const available = new Set<DashboardRole>(assigned);
    const expected = [
      ...(assigned.some(role => role === "manager" || role === "manager_viewer") ? ["manager"] : []),
      ...(assigned.includes("accoglienza") ? ["accoglienza"] : []),
      ...(assigned.includes("capogruppo") ? ["capogruppo"] : []),
      "partecipante",
    ];
    for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"] as const) {
      const tabs = getDashboardRoleTabs(assigned.map(role => ({ role, eventId: "event" })), locale);
      assert.deepEqual(tabs.map(tab => tab.key), expected, `${assigned}: ${locale}`);
    }
    for (const dashboard of ["admin", "manager", "accoglienza", "capogruppo", "partecipante"] as const) {
      assert.equal(isRoleAllowedForDashboard(dashboard, available), expected.includes(dashboard), `${assigned}: ${dashboard}`);
      if (expected.includes(dashboard)) assert.equal(pickDashboardRole(assigned, dashboard), dashboard);
    }
  }
});
