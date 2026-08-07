import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const statisticsSection = readFileSync(
  join(process.cwd(), "app/dashboard/statistics-section.tsx"),
  "utf8"
);
const firstSummaryPosition = statisticsSection.indexOf(
  "        <PanelStatisticsReport"
);
const renderedReports = statisticsSection.slice(
  statisticsSection.lastIndexOf(
    '<ReportBlock name="panels"',
    firstSummaryPosition
  ),
  statisticsSection.indexOf("function TerritoryStatisticsSummary")
);

test("each statistics summary is immediately paired with its detail table", () => {
  const orderedMarkers = [
    "<PanelStatisticsReport",
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
    4
  );
  assert.match(statisticsSection, /data-statistics-report=\{name\}/);
  assert.match(statisticsSection, /border-2 border-\[#bfd8ea\]/);
});
