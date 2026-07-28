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

test("link creation is blocked when a group has any previous link", () => {
  const createAction = actions.slice(
    actions.indexOf("export async function createGroupRegistrationLink"),
    actions.indexOf("export async function updateGroupRegistrationLink")
  );

  assert.match(createAction, /\.eq\("group_id", groupRow\.id\)/);
  assert.doesNotMatch(createAction, /\.is\("revoked_at", null\)/);
  assert.match(createAction, /error: "link-already-exists"/);
});

test("the reserved link public name can be updated without replacing its token", () => {
  const updateAction = actions.slice(
    actions.indexOf("export async function updateGroupRegistrationLink"),
    actions.indexOf("export async function saveOperationsGroup")
  );

  assert.match(updateAction, /\.eq\("is_canonical", true\)/);
  assert.match(updateAction, /public_label: publicLabel/);
  assert.match(updateAction, /internal_label: publicLabel/);
  assert.doesNotMatch(updateAction, /token_hash|token_encrypted/);
  assert.match(updateAction, /group_registration_link\.updated/);
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

test("link creation forms disappear once the group link exists", () => {
  assert.match(
    managerDashboard,
    /canManage && links\.length === 0 \? \(/
  );
  assert.match(adminDashboard, /\{links\.length === 0 \? \(/);
  assert.match(
    groupLeaderDashboard,
    /\{groupLinks\.length === 0 \? \(/
  );
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
