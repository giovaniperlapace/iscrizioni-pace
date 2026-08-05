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
    '<section className="grid min-w-0 gap-4">',
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
    renderedReports.match(/<section className="grid min-w-0 gap-4">/g)?.length,
    3
  );
});
