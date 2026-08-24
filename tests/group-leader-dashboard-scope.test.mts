import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const dashboardSource = readFileSync(
  join(process.cwd(), "app/dashboard/capogruppo/page.tsx"),
  "utf8"
);
const actionsSource = readFileSync(join(process.cwd(), "app/actions.ts"), "utf8");

test("higher-level group leaders load descendant confirmations but only direct pending assignments", () => {
  assert.match(
    dashboardSource,
    /getAssignments\(\[\.\.\.scopedGroupIds\], "confirmed"\)/
  );
  assert.match(dashboardSource, /getAssignments\(rootGroupIds, "probable"\)/);
});

test("territorial pending assignments can be routed only through the guarded reassign action", () => {
  assert.match(dashboardSource, /name="targetGroupId"/);
  assert.match(dashboardSource, /value="reassign"/);
  assert.match(actionsSource, /canGroupLeaderReassignProbableAssignment/);
  assert.match(actionsSource, /group_leader\.assignment_reassigned/);
});
