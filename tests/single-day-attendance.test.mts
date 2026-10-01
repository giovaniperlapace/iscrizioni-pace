import assert from "node:assert/strict";
import test from "node:test";
import { singleDayStatistics as statistics, singleDayParticipants } from "./fixtures/single-day-attendance.ts";
import { filterStatisticsPeople, parseStatisticsDrilldown, serializeStatisticsDrilldown, describeStatisticsDrilldown, buildEventStatisticsSnapshot } from "../lib/registrations/event-statistics.ts";
import { applyStatisticsDrilldownToOperations } from "../lib/registrations/operations-dashboard.ts";

test("single-day counts distinct dates, includes children, deduplicates half days and supports legacy/arrival attendance", () => {
  assert.equal(statistics.summary.singleDayPeople, 5);
  assert.deepEqual(statistics.summary.singleDayCounts, { "2026-10-25": 3, "2026-10-26": 1, "2026-10-24": 1 });
  assert.equal(Object.values(statistics.summary.singleDayCounts).reduce((a,b) => a+b, 0), 5);
  assert.equal(statistics.summary.totalPeople, 11);
  assert.equal(statistics.summary.attendanceSlotCounts["2026-10-25__morning"], 5, "existing totals stay independent");
  assert.equal(buildEventStatisticsSnapshot({ participants: [], groups: [], attendanceChoices: [] }).summary.singleDayPeople, 0);
});

test("each daily drilldown returns exactly the counted people and their registrations", () => {
  for (const [day, count] of Object.entries(statistics.summary.singleDayCounts)) {
    const filter = { singleAttendanceDay: day };
    assert.deepEqual(parseStatisticsDrilldown(serializeStatisticsDrilldown(filter)), filter);
    assert.equal(filterStatisticsPeople(statistics.people, filter).length, count);
    const selection = applyStatisticsDrilldownToOperations(singleDayParticipants, statistics, filter);
    assert.equal(selection.summary.peopleCount, count);
    assert.equal(selection.summary.visibleRegistrationCount, selection.summary.registrationCount);
  }
  const result = applyStatisticsDrilldownToOperations(singleDayParticipants, statistics, { singleAttendanceDay: "2026-10-25" });
  assert.deepEqual(result.participants.map(p => p.registrationId), ["family", "morning"]);
  assert.match(result.summary.label, /Partecipano solo il 25 ottobre/);
  assert.equal(result.summary.peopleCount, 3);
  assert.equal(result.summary.registrationCount, 2);
  assert.equal(filterStatisticsPeople(statistics.people, { singleAttendanceDay: "2026-10-27" }).length, 0);
  assert.equal(filterStatisticsPeople(statistics.people, { singleAttendanceDay: "2026-10-25", personKind: "child" }).length, 1);
  assert.equal(filterStatisticsPeople(statistics.people, { singleAttendanceDay: "2026-10-25", attendanceSlot: "2026-10-25__afternoon" }).length, 2);
  assert.match(describeStatisticsDrilldown({singleAttendanceDay: "2026-10-25"}, statistics.attendanceSlots), /solo il/);
});

test("malformed or repeated single-day filters are rejected instead of widening the selection", () => {
  for (const value of ["singleDay=", "singleDay=all", "singleDay=2026-02-30", "singleDay=2026-13-01", "singleDay=2026-10-25&singleDay=2026-10-26"]) {
    assert.throws(() => parseStatisticsDrilldown(value), /Filtro statistiche non valido/);
  }
});
