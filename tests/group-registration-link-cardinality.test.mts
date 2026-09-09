import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const actions = readFileSync(join(process.cwd(), "app/actions.ts"), "utf8");
const managerDashboard = readFileSync(
  join(process.cwd(), "app/dashboard/manager/page.tsx"),
  "utf8"
);
const adminDashboard = readFileSync(
  join(process.cwd(), "app/dashboard/admin/page.tsx"),
  "utf8"
);
const groupLeaderDashboard = readFileSync(
  join(process.cwd(), "app/dashboard/capogruppo/page.tsx"),
  "utf8"
);

test("canonical slug updates retain authorization and replace token atomically", () => {
  const updateAction = actions.slice(actions.indexOf("export async function updateGroupRegistrationLink"), actions.indexOf("export async function saveOperationsGroup"));
  assert.match(updateAction, /canManageGroupRegistrationLink/);
  assert.match(updateAction, /isReservedGroupRegistrationLinkToken/);
  assert.match(updateAction, /token_hash: hashGroupRegistrationLinkToken\(slug\)/);
  assert.match(updateAction, /public_label: publicLabel/);
  assert.doesNotMatch(updateAction, /\.delete\(/);
});

test("operational dashboards load the single canonical link including revoked links", () => {
  for (const dashboard of [
    managerDashboard,
    adminDashboard,
    groupLeaderDashboard,
  ]) {
    assert.match(dashboard, /\.eq\("is_canonical", true\)/);
  }
});

test("all dashboards edit automatic links without manual generation", () => {
  for (const dashboard of [managerDashboard, adminDashboard, groupLeaderDashboard]) {
    assert.doesNotMatch(dashboard, /createGroupRegistrationLink|Genera link/);
    assert.match(dashboard, /name="slug"/);
  }
});

test("link loading failures are logged instead of silently becoming an empty list", () => {
  assert.match(managerDashboard, /\[manager:group-registration-links\]/);
  assert.match(adminDashboard, /\[admin:group-registration-links\]/);
  assert.match(groupLeaderDashboard, /\[capogruppo:group-registration-links\]/);
});

test("operational link cards expose public-name editing but no revocation", () => {
  for (const dashboard of [
    managerDashboard,
    adminDashboard,
    groupLeaderDashboard,
  ]) {
    assert.match(dashboard, /action=\{updateGroupRegistrationLink\}/);
    assert.doesNotMatch(dashboard, /action=\{revokeGroupRegistrationLink\}/);
  }
  assert.doesNotMatch(actions, /export async function revokeGroupRegistrationLink/);
});

test("every static application root is reserved as a group slug", async () => {
  const { readdirSync } = await import("node:fs");
  const { isReservedGroupRegistrationLinkToken } = await import("../lib/groups/registration-links.ts");
  for (const entry of readdirSync(join(process.cwd(), "app"), { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith("[") && !entry.name.startsWith("(")) {
      assert.ok(isReservedGroupRegistrationLinkToken(entry.name), `Reserved route missing: ${entry.name}`);
    }
  }
});
