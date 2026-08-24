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

test("pending assignment details explain the tree routing next to the group selector", () => {
  assert.match(dashboardSource, /action: "Vedi dettagli e assegna"/);
  assert.match(dashboardSource, /currentAssignment:/);
  assert.match(dashboardSource, /rejectHelp:/);
  assert.match(dashboardSource, /assignmentReasonLabel\(assignment\.assignmentReason, copy\)/);

  const assignmentDetailStart = dashboardSource.indexOf(
    "<DetailBlock title={copy.detail.assignment}>"
  );
  const reassignmentSelect = dashboardSource.indexOf(
    'name="targetGroupId"',
    assignmentDetailStart
  );
  const notesStart = dashboardSource.indexOf(
    "<DetailBlock title={copy.detail.notes}>",
    assignmentDetailStart
  );

  assert.ok(assignmentDetailStart >= 0);
  assert.ok(reassignmentSelect > assignmentDetailStart);
  assert.ok(notesStart > reassignmentSelect);
});
