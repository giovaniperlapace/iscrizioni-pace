import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const statisticsSection = readFileSync(
  join(process.cwd(), "app/dashboard/statistics-section.tsx"),
  "utf8"
);
const firstSummaryPosition = statisticsSection.indexOf(
  "      <TerritoryStatisticsSummary"
);
const renderedReports = statisticsSection.slice(
  statisticsSection.lastIndexOf(
    '<ReportBlock name="territory"',
    firstSummaryPosition
  ),
  statisticsSection.indexOf("function TerritoryStatisticsSummary")
);

test("each statistics summary is immediately paired with its detail table", () => {
  const orderedMarkers = [
    "<TerritoryStatisticsSummary",
    'id="statistics-territory-table"',
    "<AttendanceStatisticsSummary",
    'id="statistics-attendance-table"',
    "<AgeStatisticsSummary",
    'id="statistics-age-table"',
  ];
  const positions = orderedMarkers.map((marker) => renderedReports.indexOf(marker));

  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((first, second) => first - second));
  assert.equal(
    renderedReports.match(/<ReportBlock name=/g)?.length,
    3
  );
  assert.match(statisticsSection, /data-statistics-report=\{name\}/);
  assert.match(statisticsSection, /border-2 border-\[#bfd8ea\]/);
});

test("statistics reports stay bounded and centered in the dashboard", () => {
  assert.match(
    statisticsSection,
    /<section className="mx-auto grid w-full min-w-0 max-w-\[65rem\] gap-8">/
  );
  assert.match(
    statisticsSection,
    /className="relative mx-auto grid w-full min-w-0 max-w-full gap-4 overflow-hidden/
  );
});

test("attendance details show every day without horizontal scrolling", () => {
  const attendanceReport = renderedReports.slice(
    renderedReports.indexOf('<ReportBlock name="attendance"'),
    renderedReports.indexOf('<ReportBlock name="age"')
  );

  assert.match(attendanceReport, /data-attendance-person/);
  assert.match(attendanceReport, /overflow-x-hidden overflow-y-auto/);
  assert.doesNotMatch(attendanceReport, /min-w-max|overflow-x-auto|overflow-auto/);
});
