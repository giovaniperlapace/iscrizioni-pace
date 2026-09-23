import test from "node:test";
import assert from "node:assert/strict";
import { attendanceSummary, ATTENDANCE_SUMMARY_COPY } from "../lib/registrations/attendance-summary.ts";
import { parseTablePreferences } from "../lib/registrations/operations-table.ts";
import { LEADER_TABLE_COPY } from "../lib/groups/leader-table-copy.ts";
import { loadAttendanceSummaries } from "../lib/registrations/attendance-summary.server.ts";

test("attendance column preserves preferences and distinguishes unknown from absent", () => {
  assert.deepEqual(parseTablePreferences({columns: ["attendance"]}).columns, ["name", "attendance"]);
  assert.equal(attendanceSummary(undefined), "—");
  assert.equal(attendanceSummary([]), "Da comunicare");
  assert.equal(attendanceSummary([{day: "2026-10-01", day_part: null, choice: "no"}]), "—");
});
test("attendance summary orders days, deduplicates parts and expands historical whole days in seven languages", () => {
  const rows = [
    {day: "2026-10-02", day_part: "afternoon", choice: "yes"},
    {day: "2026-10-01", day_part: null, choice: "yes"},
    {day: "2026-10-02", day_part: "afternoon", choice: "yes"},
  ];
  for (const locale of Object.keys(ATTENDANCE_SUMMARY_COPY) as (keyof typeof ATTENDANCE_SUMMARY_COPY)[]) {
    const summary = attendanceSummary(rows, locale);
    assert.equal(summary.split("; ").length, 2);
    assert.ok(summary.includes(ATTENDANCE_SUMMARY_COPY[locale][1]));
    assert.ok(summary.includes(ATTENDANCE_SUMMARY_COPY[locale][2]));
    assert.equal(LEADER_TABLE_COPY[locale].columns.attendance, ATTENDANCE_SUMMARY_COPY[locale][0]);
  }
});
test("attendance loader paginates relations and fails on a later page", async () => {
  let calls = 0;
  let fail = false;
  const db = {from() { return {select() {return this;}, in() {return this;}, order() {return this;}, range(from: number) {
    calls++;
    if (from && fail) return Promise.resolve({data: null, error: {message: "read failed"}});
    return Promise.resolve({data: Array.from({length: from ? 1 : 500}, () => ({registration_id: "r", day: "2026-10-01", day_part: "morning", choice: "yes"})), error: null});
  }}; }};
  const result = await loadAttendanceSummaries(db as never, ["r"]);
  assert.equal(result.get("r")?.length, 501);
  assert.equal(calls, 2);
  fail = true;
  await assert.rejects(loadAttendanceSummaries(db as never, ["r"]), /read failed/);
});

test("visible-column Excel contains the attendance summary", async () => {
  const { writeVisibleParticipantsWorkbook } = await import("../lib/data-quality/workbook.ts");
  const { default: ExcelJS } = await import("exceljs");
  const attendance = [{day: "2026-10-01", day_part: "morning", choice: "yes"}];
  const buffer = await writeVisibleParticipantsWorkbook([{name: "Fixture", attendance}] as never, {services: [], tags: []} as never, ["name", "attendance"], null);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  assert.equal(workbook.worksheets[0].getCell("B1").value, "Giorni di presenza");
  assert.equal(workbook.worksheets[0].getCell("B2").value, attendanceSummary(attendance));
});
