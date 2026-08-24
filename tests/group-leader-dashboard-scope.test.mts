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

  const pendingRowStart = dashboardSource.indexOf("function PendingAssignmentRow");
  const pendingRowEnd = dashboardSource.indexOf(
    "function AssignmentsTable",
    pendingRowStart
  );
  const pendingRowSource = dashboardSource.slice(pendingRowStart, pendingRowEnd);

  assert.doesNotMatch(pendingRowSource, /value="reject"/);
  assert.match(pendingRowSource, /whitespace-nowrap/);

  const assignmentDetailStart = dashboardSource.indexOf(
    "<DetailBlock title={copy.detail.assignment}>"
  );
  const reassignmentSelect = dashboardSource.indexOf(
    'name="targetGroupId"',
    assignmentDetailStart
  );
  const alternativeLabel = dashboardSource.indexOf(
    "copy.reassignment.alternative",
    assignmentDetailStart
  );
  const rejectionAction = dashboardSource.indexOf(
    'value="reject"',
    assignmentDetailStart
  );
  const notesStart = dashboardSource.indexOf(
    "<DetailBlock title={copy.detail.notes}>",
    assignmentDetailStart
  );

  assert.ok(assignmentDetailStart >= 0);
  assert.ok(reassignmentSelect > assignmentDetailStart);
  assert.ok(alternativeLabel > reassignmentSelect);
  assert.ok(rejectionAction > alternativeLabel);
  assert.ok(notesStart > rejectionAction);
});
