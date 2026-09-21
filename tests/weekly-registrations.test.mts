import assert from "node:assert/strict";
import test from "node:test";
import { buildRegistrationWeeks } from "../lib/registrations/weekly-registrations.ts";

test("Rome Monday boundary, empty weeks and current incomplete week", () => {
  const result = buildRegistrationWeeks([
    "2026-09-06T21:59:59Z", "2026-09-06T22:00:00Z", "2026-09-07T12:00:00Z",
  ], new Date("2026-09-21T12:00:00Z"));
  assert.deepEqual(result.weeks.map(w => [w.start, w.count, w.current]), [
    ["2026-08-31", 1, false], ["2026-09-07", 2, false],
    ["2026-09-14", 0, false], ["2026-09-21", 0, true],
  ]);
});
test("calendar weeks remain seven days across DST and year boundaries", () => {
  for (const [timestamp, now, expected] of [
    ["2026-03-23T10:00:00Z", "2026-04-06T10:00:00Z", ["2026-03-23", "2026-03-30", "2026-04-06"]],
    ["2026-10-19T10:00:00Z", "2026-11-02T10:00:00Z", ["2026-10-19", "2026-10-26", "2026-11-02"]],
    ["2025-12-29T10:00:00Z", "2026-01-05T10:00:00Z", ["2025-12-29", "2026-01-05"]],
  ] as const) {
    assert.deepEqual(buildRegistrationWeeks([timestamp], new Date(now)).weeks.map(w => w.start), expected);
  }
});
test("empty data and invalid or future dates do not fabricate counts", () => {
  assert.deepEqual(buildRegistrationWeeks([]), { weeks: [], undated: 0 });
  assert.deepEqual(buildRegistrationWeeks([null, undefined, "bad", "2027-01-01"], new Date("2026-09-21")), { weeks: [], undated: 4 });
});

test("pre-August-31 registrations form one historical bucket using Rome midnight", () => {
  const result = buildRegistrationWeeks([
    "2026-07-01T12:00:00Z", "2026-08-30T21:59:59Z", "2026-08-30T22:00:00Z", "2026-09-14T12:00:00Z",
  ], new Date("2026-09-21T12:00:00Z"), "2026-08-31");
  assert.deepEqual(result.weeks.map(w => [w.start, w.count, !!w.historical]), [
    ["2026-06-29", 2, true], ["2026-08-31", 1, false], ["2026-09-07", 0, false], ["2026-09-14", 1, false], ["2026-09-21", 0, false],
  ]);
  assert.equal(result.weeks[0].end, "2026-08-30");
});
