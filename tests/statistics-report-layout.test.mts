import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const statisticsSection = readFileSync(
  join(process.cwd(), "app/dashboard/statistics-section.tsx"),
  "utf8"
);
const operationsSection = readFileSync(
  join(process.cwd(), "app/dashboard/operations-participants-table.tsx"),
  "utf8"
);

test("statistics keep five focused reports and remove person-detail tables", () => {
  assert.equal(statisticsSection.match(/<ReportBlock name=/g)?.length, 5);
  assert.match(statisticsSection, /name="territory"/);
  assert.match(statisticsSection, /name="attendance"/);
  assert.match(statisticsSection, /name="age"/);
  assert.doesNotMatch(statisticsSection, /name="combined"/);
  assert.doesNotMatch(statisticsSection, /Tutti i dati statistici/);
  assert.doesNotMatch(statisticsSection, /Persone per età/);
  assert.doesNotMatch(statisticsSection, /Cerca nella tabella/);
});

test("group report uses expandable assignment hierarchy and preserves attendance columns", () => {
  for (const marker of ["buildAssignedGroupTree", "row.type", "attendanceSlots.map", "Totale", "Gruppo o nodo"]) {
    assert.ok(statisticsSection.includes(marker));
  }
  assert.doesNotMatch(statisticsSection, /person\.country|person\.city|territorySummary/);
  assert.match(statisticsSection, /overflow-x-auto overscroll-x-contain/);
});

test("attendance summary groups only morning and afternoon by date", () => {
  assert.match(statisticsSection, /groupAttendanceSlotsByDay/);
  assert.match(statisticsSection, /Mattina e pomeriggio sono raggruppati per data/);
  assert.match(statisticsSection, /Nessuna fascia indicata/);
  assert.doesNotMatch(statisticsSection, /Giornata/);
});

test("every statistics count links to the filtered participant page", () => {
  assert.match(statisticsSection, /serializeStatisticsDrilldown/);
  assert.match(statisticsSection, /section: "iscritti"/);
  assert.match(statisticsSection, /function SummaryKpi/);
  assert.match(statisticsSection, /function SummaryFilterLink/);
  assert.match(statisticsSection, /function AttendanceCountLink/);
  assert.match(statisticsSection, /function CountLink/);
  assert.match(operationsSection, /Filtro dalle statistiche/);
  assert.match(operationsSection, /href=\{paramsFor\(\{[^}]*stat: null,[^}]*\}\)\}[\s\S]*?Azzera filtri\s*<\/Link>/);
  assert.doesNotMatch(operationsSection, /Rimuovi filtro/);
});

test("report containers use all available width without clipping content", () => {
  assert.match(
    statisticsSection,
    /<section className="grid w-full min-w-0 gap-8">/
  );
  assert.match(
    statisticsSection,
    /className="relative grid w-full min-w-0 max-w-full gap-4 overflow-visible/
  );
  assert.doesNotMatch(statisticsSection, /max-w-\[65rem\]/);
});
