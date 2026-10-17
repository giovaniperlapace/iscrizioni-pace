import assert from "node:assert/strict";
import test from "node:test";
import { schoolPanelSlot, schoolPanelsConflict } from "../lib/panels/school-class-slots.ts";

const panel = (startsAt: string, endsAt: string) => ({ startsAt, endsAt });
test("school class slots use Rome date and noon boundary, including summer time", () => {
  assert.equal(schoolPanelSlot("2026-10-26T10:59:00Z"), "2026-10-26:morning");
  assert.equal(schoolPanelSlot("2026-10-26T11:00:00Z"), "2026-10-26:afternoon");
  assert.equal(schoolPanelSlot("2026-07-01T10:00:00Z"), "2026-07-01:afternoon");
  assert.equal(schoolPanelSlot("2026-10-25T23:30:00Z"), "2026-10-26:morning");
});
test("school class may not select different forums in the same slot even without time overlap", () => {
  assert.equal(schoolPanelsConflict(panel("2026-10-26T08:00:00+01:00", "2026-10-26T09:00:00+01:00"),
    panel("2026-10-26T10:00:00+01:00", "2026-10-26T11:00:00+01:00")), true);
});
test("cross-noon overlaps are still blocked; touching slots and different days are allowed", () => {
  const morning = panel("2026-10-26T09:30:00+01:00", "2026-10-26T12:30:00+01:00");
  assert.equal(schoolPanelsConflict(morning, panel("2026-10-26T12:00:00+01:00", "2026-10-26T13:00:00+01:00")), true);
  assert.equal(schoolPanelsConflict(morning, panel("2026-10-26T12:30:00+01:00", "2026-10-26T15:00:00+01:00")), false);
  assert.equal(schoolPanelsConflict(morning, panel("2026-10-27T09:30:00+01:00", "2026-10-27T12:30:00+01:00")), false);
});
