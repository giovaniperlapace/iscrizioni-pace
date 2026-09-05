import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const dashboard = readFileSync("app/dashboard/capogruppo/page.tsx", "utf8");
const actions = readFileSync("app/actions.ts", "utf8");
const assignmentAction = actions.slice(actions.indexOf("export async function updateGroupLeaderAssignment"), actions.indexOf("export async function updateGroupLeaderParticipantContact"));
const registration = readFileSync("lib/registrations/public-flow.ts", "utf8");
test("leaders load all current assignments in their subtree without confirmation gating", () => {
  assert.match(dashboard, /getAssignments\(\[\.\.\.scopedGroupIds\]\)/);
  assert.doesNotMatch(dashboard, /PendingAssignmentsPanel|value="(?:confirm|unconfirm|read|reassign)"|leader_notification_read_at/);
  assert.match(dashboard, /value="reject"/);
});
test("ordinary confirmation commands and per-assignment notifications are retired", () => {
  assert.match(assignmentAction, /intent !== "note" && intent !== "reject"/);
  assert.match(assignmentAction, /rpc\("reject_group_assignment"/);
  assert.doesNotMatch(assignmentAction, /upsert|escalated_to|notifyGroup|intent === "confirm"/);
  assert.doesNotMatch(registration, /notifyGroupLeaders|leader_notification|status: "probable"/);
});
