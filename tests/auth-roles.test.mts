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

test("manager and manager viewer share the manager dashboard", () => {
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
});

test("dashboard tabs dedupe manager and manager viewer", () => {
  const tabs = getDashboardRoleTabs([
    { role: "manager", eventId: "event-1" },
    { role: "manager_viewer", eventId: "event-1" },
  ]);

  assert.deepEqual(
    tabs.map((tab) => tab.key),
    ["manager", "partecipante"]
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
