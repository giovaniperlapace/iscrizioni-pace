import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import { buildPresenceReport } from "../lib/presence-exports/report.ts";
import { writePresenceWorkbook } from "../lib/presence-exports/workbook.ts";
import { presenceConfigForEvent } from "../lib/presence-exports/config.ts";
import type { PresenceConfig, PresenceSource, PresenceVariant } from "../lib/presence-exports/types.ts";

const config: PresenceConfig = { eventId: "event", version: "test", source: "fixture", zones: [{ id: "roma", label: "Roma" }, { id: "estero", label: "Altri paesi" }],
  groups: [
    { groupId: "g1", sourceName: "Vecchio nome", zoneId: "roma", rollup: "Anziani Roma", operatorTag: "acc_anz" },
    { groupId: "g2", sourceName: "Altri anziani", zoneId: "roma", rollup: "Anziani Roma", operatorTag: "acc_other" },
  ], zoneRoots: [{ groupId: "roma", sourceName: "Roma", zoneId: "roma" }], unmatchedSourceGroups: [] };
function fixture(): PresenceSource {
  return { event: { id: "event", title: "Evento di prova", starts_on: "2026-10-25", ends_on: "2026-10-27" }, extractedAt: "2026-10-01T12:00:00.000Z",
    groups: [{ id: "roma", name: "Roma", parent_group_id: null, is_assignable: false },
      { id: "g1", name: "Nome attuale", parent_group_id: "roma", is_assignable: true },
      { id: "g2", name: "Altri anziani", parent_group_id: "roma", is_assignable: true },
      { id: "g3", name: "Nuovo gruppo", parent_group_id: "roma", is_assignable: true },
      { id: "g4", name: "Senza raccordo", parent_group_id: null, is_assignable: true }],
    registrations: [1, 2, 3, 4, 5, 6].map(i => ({ id: `r${i}`, participant_id: `p${i}` })),
    children: [{ id: "child1", registration_id: "r1" }, { id: "child2", registration_id: "r2" }],
    assignments: [1, 2, 3, 4, 5].map((i) => ({ registration_id: `r${i}`, group_id: `g${i === 5 ? 4 : i === 4 ? 3 : i === 3 ? 2 : 1}` })),
    attendance: [{ registration_id: "r1", day: "2026-10-24", day_part: "afternoon", choice: "yes" },
      { registration_id: "r1", day: "2026-10-24", day_part: "afternoon", choice: "yes" },
      { registration_id: "r2", day: "2026-10-25", day_part: null, choice: "yes" },
      { registration_id: "r3", day: null, day_part: null, choice: "unknown" },
      { registration_id: "r4", day: "2026-10-25", day_part: "morning", choice: "no" },
      { registration_id: "r5", day: "2025-10-25", day_part: "morning", choice: "yes" }],
    services: [{ id: "s1", label: "Servizio attuale" }],
    serviceAssignments: [{ registration_id: "r1", service_id: "s1", status: "assigned" }, { registration_id: "r2", service_id: "s1", status: "assigned" }, { registration_id: "r4", service_id: "s1", status: "proposal_pending" }],
    tags: [{ id: "t1", label: "acc_other" }, { id: "t2", label: "acc_anz" }, { id: "t3", label: "acc_non_configurato" }],
    tagAssignments: [{ participant_id: "p1", tag_id: "t1" }],
  };
}
test("four reports conserve distinct people and slots; operator beats service, children remain in original group", () => {
  const source = fixture();
  const reports = (["a", "a2", "b", "b2"] as PresenceVariant[]).map(kind => buildPresenceReport(source, config, kind));
  for (const report of reports) {
    assert.deepEqual(report.total, [8, 2, 2, 2, 0, 0, 0, 0, 4]);
    assert.deepEqual(report.lines.filter(row => row.kind === "detail").reduce((sum, row) => sum.map((value, index) => value + row.values[index]), Array(9).fill(0)), report.total);
    assert.equal(report.headers[2], "Pomeriggio\n24/10/2026");
    assert.ok(report.lines.some(row => row.key === "no-group" && row.values[0] === 1));
    assert.ok(report.lines.some(row => row.key === "group:g4" && row.zoneId === "non-classificati"));
    assert.doesNotMatch(JSON.stringify(report), /Vecchio nome/);
  }
  const a = reports[0], b = reports[2];
  assert.equal(a.lines.find(row => row.key === "group:g1")?.values[0], 4);
  assert.equal(b.lines.find(row => row.key === "group:g1")?.values[0], 2); // two children
  assert.equal(b.lines.find(row => row.key === "group:g2")?.values[0], 2); // original + operator
  assert.equal(b.lines.find(row => row.key === "service:s1")?.values[0], 1);
  assert.equal(b.lines.find(row => row.key === "group:g3")?.values[0], 1); // proposal is ignored
  assert.equal(reports[1].lines.find(row => row.label === "Anziani Roma")?.values[0], 5);
  assert.equal(reports[3].lines.find(row => row.label === "Anziani Roma")?.values[0], 4);
});
test("ambiguous and unmapped operators are counted once in an explicit unresolved section", () => {
  for (const tag_id of ["t2", "t3"]) {
    const source = fixture(); source.tagAssignments.push({ participant_id: "p1", tag_id });
    const report = buildPresenceReport(source, config, "b");
    assert.equal(report.lines.find(row => row.key === "operator-conflict")?.values[0], 1);
    assert.equal(report.lines.find(row => row.key === "service:s1")?.values[0], 1);
    assert.equal(report.total[0], 8);
    assert.ok(report.warnings.some(message => message.includes("operatori")));
  }
});
test("no fuzzy group names or residential inference; new descendants inherit configured zone, homonyms stay separate", () => {
  const source = fixture();
  source.groups[3].name = "Nome attuale";
  const report = buildPresenceReport(source, config, "a");
  assert.equal(report.lines.filter(row => row.kind === "detail" && row.label.startsWith("Nome attuale [")).length, 2);
  assert.equal(report.lines.find(row => row.key === "group:g3")?.zoneId, "roma");
  assert.equal(report.mapping.find(row => row.groupId === "g3")?.rollup, "");
});
test("malformed assignments and hierarchies fail closed; editions cannot share a configuration", () => {
  assert.throws(() => buildPresenceReport(fixture(), { ...config, eventId: "other" }, "a"), /altro evento/);
  assert.equal(presenceConfigForEvent("another-edition"), null);
  for (const change of [
    (s: PresenceSource) => s.assignments.push(s.assignments[0]),
    (s: PresenceSource) => { s.groups[0].parent_group_id = "g1"; },
    (s: PresenceSource) => { s.groups[0].parent_group_id = "missing"; },
    (s: PresenceSource) => s.serviceAssignments.push(s.serviceAssignments[0]),
    (s: PresenceSource) => s.children.push(s.children[0]),
  ]) { const source = fixture(); change(source); assert.throws(() => buildPresenceReport(source, config, "b")); }
});
test("empty event exports a valid zero total and current labels stay literal, not Excel formulas", async () => {
  const source = fixture(); source.groups[1].name = '=HYPERLINK("https://example.test")';
  for (const kind of ["a", "a2", "b", "b2"] as const) {
    const report = buildPresenceReport(source, config, kind);
    const book = new ExcelJS.Workbook(); await book.xlsx.load(await writePresenceWorkbook(report) as unknown as Parameters<typeof book.xlsx.load>[0]);
    const sheet = book.getWorksheet("Presenze")!;
    assert.equal(sheet.rowCount, report.lines.length + 6);
    assert.equal(sheet.pageSetup.orientation, "landscape");
    assert.equal(sheet.pageSetup.fitToWidth, 1);
    assert.equal(sheet.pageSetup.fitToHeight, 0);
    assert.equal(sheet.pageSetup.printTitlesRow, "6:6");
    assert.match(String(sheet.getCell("A3").value), /01\/10\/26, 14:00:00.*Roma/);
    assert.match(sheet.headerFooter.oddFooter!, /Pagina &P di &N/);
    assert.equal(sheet.lastRow!.getCell(2).result, 8);
    assert.equal(book.getWorksheet("Raccordo")!.getRow(8).getCell(1).value, "Gruppo");
    assert.equal(book.getWorksheet("Raccordo")!.getColumn(6).hidden, true);
    if (kind === "a" || kind === "b") {
      let literal = false; sheet.eachRow(row => { if (row.getCell(1).value === source.groups[1].name) literal = row.getCell(1).type === ExcelJS.ValueType.String; }); assert.ok(literal);
    }
    // Independently evaluate the emitted SUMs to catch double-counted subtotals.
    sheet.eachRow(row => row.eachCell(cell => {
      if (!cell.formula) return;
      const refs = cell.formula.slice(4, -1).split(",");
      const sum = refs.reduce((sum, ref) => {
        if (!ref.includes(":")) return sum + Number(sheet.getCell(ref).result ?? sheet.getCell(ref).value);
        const [start, end] = ref.split(":"); const startCell = sheet.getCell(start), endCell = sheet.getCell(end);
        for (let r = Number(startCell.row); r <= Number(endCell.row); r++) sum += Number(sheet.getRow(r).getCell(Number(startCell.col)).value);
        return sum;
      }, 0);
      assert.equal(cell.result, sum, cell.address);
    }));
  }
  const empty = fixture(); empty.registrations = []; empty.children = []; empty.assignments = []; empty.attendance = []; empty.serviceAssignments = []; empty.tagAssignments = [];
  const report = buildPresenceReport(empty, config, "a"); assert.equal(report.total[0], 0);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(await writePresenceWorkbook(report) as unknown as Parameters<typeof book.xlsx.load>[0]);
  assert.equal(book.getWorksheet("Presenze")!.lastRow!.getCell(2).result, 0);
});
