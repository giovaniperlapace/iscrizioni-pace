import { parseStatisticsDrilldown } from "../lib/registrations/event-statistics.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import ExcelJS from "exceljs";
import { accessibilitySummary } from "../lib/registrations/accessibility-summary.ts";
import { loadAccessibilitySummaries } from "../lib/registrations/accessibility-summary.server.ts";
import { CHILDREN_EXPORT_COPY, childrenExportValues } from "../lib/registrations/children-export.ts";
import { parseTablePreferences } from "../lib/registrations/operations-table.ts";
import { writeVisibleParticipantsWorkbook } from "../lib/data-quality/workbook.ts";
import { ACCESSIBILITY_DIFFICULTIES } from "../lib/questionnaire/registration.ts";
import { LEADER_TABLE_COPY } from "../lib/groups/leader-table-copy.ts";
import type { SupportedLocale } from "../lib/i18n/config.ts";

test("accessibility reports only actual boolean declarations using form labels in all languages", () => {
  for (const locale of Object.keys(CHILDREN_EXPORT_COPY) as SupportedLocale[]) {
    assert.equal(accessibilitySummary({hearing: true, walkingOrSteps: true, wheelchairOrMobilityAid: false, needsOperationalSupport: true, arbitrary: true}, locale), ACCESSIBILITY_DIFFICULTIES.slice(0, 2).map(item => item.label[locale]).join("; "));
    assert.equal(LEADER_TABLE_COPY[locale].columns.accessibility, CHILDREN_EXPORT_COPY[locale].accessibility);
  }
  for (const answers of [null, undefined, {}, {hearing: false}, {hearing: "true"}]) assert.equal(accessibilitySummary(answers), "—");
});
test("accessibility reads only scoped IDs, paginates and never returns partial data after errors", async () => {
  const scopes: string[][] = [];
  let fail = false;
  const db = {from(table: string) {
    assert.equal(table, "accessibility_needs");
    return {select(columns: string) {assert.equal(columns, "registration_id,washington_group_answers"); return this;}, in(_key: string, ids: string[]) {scopes.push(ids); return this;}, order() {return this;}, range(from: number) {
      if (from && fail) return Promise.resolve({data: null, error: {message: "failed page"}});
      return Promise.resolve({data: Array.from({length: from ? 1 : 500}, (_, i) => ({registration_id: `r${from + i}`, washington_group_answers: {hearing: true}})), error: null});
    }};
  }};
  const summaries = await loadAccessibilitySummaries(db as never, ["allowed"]);
  assert.equal(summaries.size, 501);
  assert.deepEqual(scopes, [["allowed"], ["allowed"]]);
  fail = true;
  await assert.rejects(loadAccessibilitySummaries(db as never, ["allowed"]), /failed page/);
  scopes.length = 0;
  assert.equal((await loadAccessibilitySummaries(db as never, [])).size, 0);
  assert.equal(scopes.length, 0);
});
const children = [
  {id: "b", position: 2, firstName: "Luca", lastName: "Bianchi"},
  {id: "a", position: 1, firstName: "Anna Maria", lastName: "Rossi"},
];
test("Excel always appends both child columns, preserves full names and exports selected disability", async () => {
  assert.deepEqual(childrenExportValues(children), ["2", "Anna Maria Rossi; Luca Bianchi"]);
  assert.deepEqual(childrenExportValues([]), ["0", ""]);
  const summary = accessibilitySummary({hearing: true, wheelchairOrMobilityAid: true});
  const buffer = await writeVisibleParticipantsWorkbook([{name: "Parent", children, accessibility: summary}] as never, {services: [], tags: [], groups: []}, ["name", "accessibility"], null);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer as never);
  assert.deepEqual(book.worksheets[0].getRow(1).values, [, "Partecipante", "Informazioni sulla disabilità", ...CHILDREN_EXPORT_COPY.it.headers]);
  assert.deepEqual(book.worksheets[0].getRow(2).values, [, "Parent", summary, "2", "Anna Maria Rossi; Luca Bianchi"]);
});
test("actual export GET strips forged disability requests from viewers and reads them for managers", async () => {
  const source = readFileSync("app/dashboard/participants/data-quality/api/route.ts", "utf8").split("// Enforce an actual body budget")[0];
  const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText.replace(/import[\s\S]*?from ["'][^"']+["'];/g, "").replace(/export /g, "");
  for (const canWrite of [false, true]) {
    let readSensitive: boolean | undefined;
    const dependencies = {
      qualityAccess: async () => ({db: {}, auth: {user: {id: "actor"}}, event: {id: "event"}, isAdmin: false, canWrite}),
      loadCatalog: async () => ({services: [], tags: [], groups: []}),
      filteredExportPeople: async (_db: unknown, _event: unknown, _params: unknown, include: boolean) => {readSensitive = include; return {people: [{name: "Parent", children, accessibility: include ? "Sensitive fixture" : undefined}]};},
      parseTablePreferences, parseStatisticsDrilldown, writeVisibleParticipantsWorkbook,
      createSupabaseServiceClient: () => ({from: () => ({insert: async () => ({error: null})})}),
      NextResponse: Response,
    };
    const handler = new Function(...Object.keys(dependencies), `${compiled}; return GET;`)(...Object.values(dependencies));
    const response = await handler({nextUrl: new URL("http://localhost/?kind=export&columns=name,accessibility")});
    assert.equal(response.status, 200); assert.equal(readSensitive, canWrite);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
    assert.equal(book.worksheets[0].columnCount, canWrite ? 4 : 3);
    assert.equal(JSON.stringify(book.worksheets[0].getRow(2).values).includes("Sensitive fixture"), canWrite);
    readSensitive = undefined;
    const filtered = await handler({nextUrl: new URL("http://localhost/?kind=export&columns=name&stat=difficulty%3Dhearing")});
    assert.equal(filtered.status, canWrite ? 200 : 400);
    assert.equal(readSensitive, canWrite ? false : undefined, "viewer blocked before export reads even with disability column hidden");
  }
  assert.equal(parseTablePreferences({sort: "accessibility", columns: ["accessibility"]}, false).sort, "name");
});
