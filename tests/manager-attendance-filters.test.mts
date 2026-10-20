import assert from "node:assert/strict";
import test from "node:test";
import { applyOperationsDashboardFilters, parseOperationsDashboardFilters } from "../lib/registrations/operations-dashboard.ts";
import { operationsReturnPath } from "../lib/registrations/operations-table.ts";
import { loadOperationsParticipantPage } from "../lib/registrations/operations-page.server.ts";
import { operationsPageDatabase } from "./fixtures/operations-page.ts";

const rows = [
  { name: "day", attendance: [{ day: "2026-10-25", day_part: null, choice: "yes" }] },
  { name: "morning", attendance: [{ day: "2026-10-25", day_part: "morning", choice: "yes" }] },
  { name: "no", attendance: [{ day: "2026-10-25", day_part: "morning", choice: "no" }] },
  { name: "empty", attendance: [] },
  { name: "unknown", attendance: [{ day: null, day_part: null, choice: "unknown" }] },
  { name: "unread" },
].map(row => ({ eventId: "event", eventTitle: "event", publicCode: null, place: "", email: null, phone: null, registrationStatus: null, currentGroupId: null, currentGroupName: null, currentGroupStatus: null, ...row }));
const names = (filters: Record<string, string>) => applyOperationsDashboardFilters(rows, parseOperationsDashboardFilters(filters)).map(row => row.name);
test("half-day filters preserve day-level yes, distinguish unknown and combine present/absent", () => {
  assert.deepEqual(names({ attendanceYes: "2026-10-25__morning" }), ["day", "morning"]);
  assert.deepEqual(names({ attendanceNo: "2026-10-25__morning" }), ["no"]);
  assert.deepEqual(names({ attendanceYes: "2026-10-25__morning", attendanceNo: "2026-10-25__afternoon" }), ["morning"]);
  assert.deepEqual(names({ attendanceState: "unknown" }), ["empty", "unknown"]);
  assert.deepEqual(names({ attendanceState: "known" }), ["day", "morning", "no"]);
  assert.deepEqual(names({ attendanceYes: "2026-10-25__morning", attendanceNo: "2026-10-25__morning" }), []);
  assert.equal(parseOperationsDashboardFilters({ attendanceYes: "bad", attendanceState: "bad" }).attendanceYes, "");
});
test("attendance filters cover all 5005 rows before pagination and errors never fabricate absence", async () => {
  const fixture = operationsPageDatabase();
  const params = { attendanceYes: "2026-10-25__morning", participantPage: "26" };
  const request = { event: { id: "event", title: "Event" }, actorId: "actor", canManage: true, dashboard: "manager" as const, locale: "it" as const, params, filters: parseOperationsDashboardFilters(params) };
  const result = await loadOperationsParticipantPage(fixture.db, request);
  assert.equal(result.serverPage?.total, 2503);
  assert.equal(result.participants.length, 3);
  assert.ok(result.participants.every(row => Number(row.registrationId.slice(-12)) % 2 === 0));
  fixture.failWhen(table => table === "event_attendance_choices");
  await assert.rejects(loadOperationsParticipantPage(fixture.db, request), /Synthetic read failure/);
});
test("return paths retain both half-days and communicated state", () => {
  const url = operationsReturnPath("/dashboard/manager?attendanceYes=2026-10-25__morning&attendanceNo=2026-10-26__afternoon&attendanceState=known", "manager");
  for (const name of ["attendanceYes", "attendanceNo", "attendanceState"]) assert.ok(url.includes(name));
});

test("Excel export applies the same attendance filters after loading choices", async () => {
  const { readFileSync } = await import("node:fs");
  const ts = (await import("typescript")).default;
  const source = readFileSync("lib/data-quality/data.server.ts", "utf8");
  const ast = ts.createSourceFile("export.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "filteredExportPeople")!;
  const compiled = ts.transpileModule(fn.getText(ast).replace("export ", ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const choices = [
    { registration_id: "a", day: "2026-10-25", day_part: "morning", choice: "yes" },
    { registration_id: "b", day: "2026-10-25", day_part: "morning", choice: "no" },
  ];
  const deps = { parseStatisticsDrilldown: () => null, loadQualityPeople: async () => ["a", "b", "c"].map(id => ({ ...rows[0], id, registrationId: id, attendance: undefined })),
    loadRowsForIds: async () => ({ data: choices }), applyOperationsDashboardFilters, parseOperationsDashboardFilters };
  const exportPeople = new Function(...Object.keys(deps), `${compiled}; return filteredExportPeople;`)(...Object.values(deps));
  for (const [query, ids] of [["attendanceYes=2026-10-25__morning", ["a"]], ["attendanceNo=2026-10-25__morning", ["b"]], ["attendanceState=unknown", ["c"]]] as const) {
    const result = await exportPeople({}, { id: "event", title: "Event" }, new URLSearchParams(query));
    assert.deepEqual(result.people.map((p: { id: string }) => p.id), ids);
  }
});
