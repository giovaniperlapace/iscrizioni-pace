import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("leader detail retains service summary without service mutation controls or catalog", () => {
  const page = readFileSync("app/dashboard/capogruppo/page.tsx", "utf8");
  assert.match(page, /<ParticipantServiceSummary service=\{assignment.service\}/);
  assert.doesNotMatch(page, /updateParticipantEventService|name="serviceId"|name="operatorNote"|Salva servizio|getEventServices|serviceOptions/);
});
test("legacy service action checks actual manager/admin roles even with forged dashboard input", () => {
  const file = readFileSync("app/actions.ts", "utf8");
  const action = file.slice(file.indexOf("export async function updateParticipantEventService"), file.indexOf("async function canGroupLeaderTagParticipant"));
  assert.doesNotMatch(action, /await canGroupLeaderTagParticipant/);
  assert.match(action, /const canUpdate = !isCapogruppo && auth.eventRoles.some/);
  assert.match(action, /role.role === "admin"/);
  assert.match(action, /role.role === "manager" && role.eventId === eventId/);
  assert.ok(action.indexOf("if (!canUpdate)") < action.indexOf('.delete()'));
  assert.ok(action.indexOf("if (!canUpdate)") < action.indexOf('.upsert('));
});
