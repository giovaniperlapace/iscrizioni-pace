import assert from "node:assert/strict";
import test from "node:test";
import { filterGroupPanelParticipants, toggleVisiblePanelSelection, validGroupBookingSelection, groupBookingError, type GroupPanelParticipant } from "../lib/panels/group-bookings.ts";
const rows: GroupPanelParticipant[] = [
  {registrationId: "a", name: "Anna Test", code: "PACE01", groupId: "rome", groupName: "Roma", seats: 2, status: "available"},
  {registrationId: "b", name: "Bruno Test", code: "PACE02", groupId: "milan", groupName: "Milano", seats: 1, status: "available"},
  {registrationId: "c", name: "Carlo Test", code: "PACE03", groupId: "rome", groupName: "Roma", seats: 1, status: "selected"},
  {registrationId: "d", name: "Dora Test", code: null, groupId: "rome", groupName: "Roma", seats: 1, status: "conflict"},
  {registrationId: "e", name: "Eva Test", code: null, groupId: "rome", groupName: "Roma", seats: 4, status: "full"},
];
test("filtered select-all preserves hidden selections and excludes already booked, conflicting and full rows", () => {
  const rome = filterGroupPanelParticipants(rows, "", "rome");
  assert.deepEqual(toggleVisiblePanelSelection(["b"], rome), ["b", "a"]);
  assert.deepEqual(toggleVisiblePanelSelection(["a", "b"], rome), ["b"]);
  assert.deepEqual(toggleVisiblePanelSelection(["b"], []), ["b"]);
});
test("name/code search combines with the group filter without changing the source", () => {
  assert.deepEqual(filterGroupPanelParticipants(rows, " pace01 ", "rome").map(r=>r.registrationId), ["a"]);
  assert.deepEqual(filterGroupPanelParticipants(rows, "ANNA", "milan"), []);
  assert.equal(rows.length, 5);
});
test("booking requires explicit UUID selection, never an implicit all", () => {
  const id="11111111-1111-4111-8111-111111111111";
  assert.equal(validGroupBookingSelection(id, [id]), true);
  for (const ids of [undefined, null, [], [null], ["all"], id]) assert.equal(validGroupBookingSelection(id, ids), false);
  assert.equal(validGroupBookingSelection("all", [id]), false);
});
test("database failures become actionable messages without exposing infrastructure errors", () => {
  assert.deepEqual(groupBookingError({code:"42501", message:"secret"}), {error:"scopeError"});
  assert.deepEqual(groupBookingError({code:"23P01", message:"secret"}), {error:"conflictError"});
  assert.deepEqual(groupBookingError({message:"panel section is full"}), {error:"fullError"});
  assert.deepEqual(groupBookingError({code:"22023", message:"secret"}), {error:"unavailable"});
  assert.deepEqual(groupBookingError({code:"XX000", message:"secret"}), {error:"failure"});
});
