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
    '<ReportBlock name="combined"',
    "Tutti i dati statistici",
  ];
  const positions = orderedMarkers.map((marker) => renderedReports.indexOf(marker));

  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((first, second) => first - second));
  assert.equal(
    renderedReports.match(/<ReportBlock name=/g)?.length,
    4
  );
  assert.match(statisticsSection, /data-statistics-report=\{name\}/);
  assert.match(statisticsSection, /border-2 border-\[#bfd8ea\]/);
});

test("only the attendance report uses the centered bounded layout", () => {
  assert.match(
    statisticsSection,
    /<section className="grid w-full min-w-0 gap-8">/
  );
  assert.match(
    statisticsSection,
    /name === "attendance" \? "mx-auto max-w-\[65rem\]" : "max-w-full"/
  );
});

test("attendance details keep the complete scrollable cross-table", () => {
  const attendanceReport = renderedReports.slice(
    renderedReports.indexOf('<ReportBlock name="attendance"'),
    renderedReports.indexOf('<ReportBlock name="age"')
  );

  assert.match(attendanceReport, /max-h-\[34rem\].*overflow-auto/);
  assert.match(attendanceReport, /<table className="w-full min-w-max/);
  assert.doesNotMatch(attendanceReport, /data-attendance-person/);
});

test("the final combined table crosses territory age and attendance", () => {
  const combinedReport = renderedReports.slice(
    renderedReports.indexOf('<ReportBlock name="combined"')
  );

  for (const marker of [
    "Paese",
    "Città",
    "Gruppo",
    "Nascita",
    "Età",
    "Fascia",
    "statistics.attendanceSlots.map",
  ]) {
    assert.ok(combinedReport.includes(marker), `missing combined marker: ${marker}`);
  }
  assert.match(combinedReport, /max-h-\[42rem\].*overflow-auto/);
});
