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
    actions.indexOf("export async function revokeGroupRegistrationLink")
  );

  assert.match(createAction, /\.eq\("group_id", groupRow\.id\)/);
  assert.doesNotMatch(createAction, /\.is\("revoked_at", null\)/);
  assert.match(createAction, /error: "link-already-exists"/);
});

test("the reserved link always uses the group name and cannot be renamed", () => {
  const createAction = actions.slice(
    actions.indexOf("export async function createGroupRegistrationLink"),
    actions.indexOf("export async function revokeGroupRegistrationLink")
  );

  assert.match(createAction, /public_label: groupRow\.name/);
  assert.match(createAction, /internal_label: groupRow\.name/);
  assert.doesNotMatch(actions, /export async function updateGroupRegistrationLink/);
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

test("operational link cards do not expose display-name editing", () => {
  for (const dashboard of [
    managerDashboard,
    adminDashboard,
    groupLeaderDashboard,
  ]) {
    assert.doesNotMatch(dashboard, /action=\{updateGroupRegistrationLink\}/);
    assert.doesNotMatch(dashboard, /Salva nome|Save name/);
  }
});
