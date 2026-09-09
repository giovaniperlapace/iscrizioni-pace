import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const adminDashboard = readFileSync(
  join(process.cwd(), "app/dashboard/admin/page.tsx"),
  "utf8"
);
const managerDashboard = readFileSync(
  join(process.cwd(), "app/dashboard/manager/page.tsx"),
  "utf8"
);
const sharedSection = readFileSync(
  join(process.cwd(), "app/dashboard/operations-participants-table.tsx"),
  "utf8"
);

test("admin and manager render the same participant-management component", () => {
  assert.match(adminDashboard, /<OperationsParticipantsSection/);
  assert.match(adminDashboard, /dashboard="admin"/);
  assert.match(managerDashboard, /<OperationsParticipantsSection/);
  assert.match(managerDashboard, /dashboard="manager"/);
  assert.doesNotMatch(adminDashboard, /function AdminParticipantsSection/);
  assert.doesNotMatch(managerDashboard, /function ManagerParticipantsSection/);
});

test("the shared table exposes manager-level columns and filters", () => {
  assert.match(sharedSection, /PARTICIPANT_COLUMNS/);
  assert.match(sharedSection, /name="service"/);
  assert.match(sharedSection, /name="tag"/);
});

test("participant search waits for typing and stays interactive while filtering", () => {
  assert.match(sharedSection, /debounceMs=\{900\}/);
  assert.match(sharedSection, /blockWhilePending=\{false\}/);
});

test("the shared participant sheet edits identity, contacts, group, and tags", () => {
  for (const field of [
    "firstName",
    "lastName",
    "birthDate",
    "city",
    "country",
    "email",
    "phone",
  ]) {
    assert.match(sharedSection, new RegExp(`name=[{\"]${field}`));
  }

  assert.match(sharedSection, /name="sourceDashboard" value=\{dashboard\}/);
  assert.match(sharedSection, /operationsControl\(selected, field\)/);
});

test("admin loads the same participant tags, services, and identity fields", () => {
  assert.match(adminDashboard, /\.from\("participant_operational_tags"\)/);
  assert.match(adminDashboard, /\.from\("participant_event_services"\)/);
  assert.match(adminDashboard, /birthDate: participant\?\.birth_date/);
  assert.match(adminDashboard, /operationalTags:/);
  assert.match(adminDashboard, /eventServices:/);
});
