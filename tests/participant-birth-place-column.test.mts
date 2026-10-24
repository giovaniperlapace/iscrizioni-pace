import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { operationsPageDatabase, fixtureId } from "./fixtures/operations-page.ts";
import { loadQuestionnaireSummaries } from "../lib/registrations/questionnaire-summary.server.ts";
import { loadOperationsParticipantPage } from "../lib/registrations/operations-page.server.ts";
import { parseOperationsDashboardFilters } from "../lib/registrations/operations-dashboard.ts";
import { writeVisibleParticipantsWorkbook } from "../lib/data-quality/workbook.ts";
import { leaderCellText, type LeaderTableRow } from "../lib/groups/leader-table.ts";
import { LEADER_TABLE_COPY } from "../lib/groups/leader-table-copy.ts";
import type { SupportedLocale } from "../lib/i18n/config.ts";

test("birth place uses the latest scoped answer, including a cleared value", async () => {
  const { db, tables } = operationsPageDatabase(2);
  tables.registration_questionnaire_answers = [
    { id: "new", registration_id: fixtureId(0), created_at: "2026-10-02", birthPlace: "  " },
    { id: "old", registration_id: fixtureId(0), created_at: "2026-10-01", birthPlace: "Francia" },
    { id: "other", registration_id: fixtureId(1), created_at: "2026-10-01", birthPlace: "Belgio" },
  ];
  const result = await loadQuestionnaireSummaries(db, [fixtureId(0)]);
  assert.equal(result.birthPlaces.get(fixtureId(0)), null);
  assert.equal(result.birthPlaces.has(fixtureId(1)), false);
});

test("birth place ordering precedes pagination and remains separate from residence", async () => {
  const { db, tables } = operationsPageDatabase(101);
  for (const row of tables.registration_questionnaire_answers) row.birthPlace = "Zambia";
  tables.registration_questionnaire_answers[100].birthPlace = " Albania ";
  const params = { columns: "name,birthPlace,country", sort: "birthPlace" };
  const page = await loadOperationsParticipantPage(db, {
    event: { id: "event", title: "Fixture", starts_on: "2026-10-25" }, actorId: "actor",
    canManage: false, dashboard: "manager", locale: "it", params,
    filters: parseOperationsDashboardFilters({}),
  });
  assert.equal(page.participants[0].registrationId, fixtureId(100));
  assert.equal(page.participants[0].birthPlace, "Albania");
  assert.equal(page.participants[0].country, "Italia");
});

test("Excel and leader columns distinguish birth place, residence and missing answers", async () => {
  const people = [{ name: "Fixture", birthPlace: "Francia", country: "Italia", children: [] },
    { name: "Missing", birthPlace: null, country: "Italia", children: [] }];
  const buffer = await writeVisibleParticipantsWorkbook(people as never, { services: [], tags: [], groups: [] }, ["name", "birthPlace", "country"], null);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer as never);
  const sheet = book.worksheets[0];
  assert.equal(sheet.getCell("B1").value, "Paese / luogo di nascita");
  assert.equal(sheet.getCell("C1").value, "Paese di residenza abituale");
  assert.equal(sheet.getCell("B2").value, "Francia");
  assert.equal(sheet.getCell("C2").value, "Italia");
  assert.equal(sheet.getCell("B3").value, "—");
  for (const locale of Object.keys(LEADER_TABLE_COPY) as SupportedLocale[]) {
    assert.ok(LEADER_TABLE_COPY[locale].columns.birthPlace);
    assert.notEqual(LEADER_TABLE_COPY[locale].columns.birthPlace, LEADER_TABLE_COPY[locale].columns.country);
    assert.equal(leaderCellText(people[0] as unknown as LeaderTableRow, "birthPlace", null, locale), "Francia");
    assert.equal(leaderCellText(people[1] as unknown as LeaderTableRow, "birthPlace", null, locale), "—");
  }
});
