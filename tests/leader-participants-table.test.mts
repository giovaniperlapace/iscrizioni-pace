import ts from "typescript";
import { toAssignmentView } from "../lib/groups/leader-assignments.ts";
import { toLeaderTableRow } from "../lib/groups/leader-table.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import {
  loadLeaderScope,
  loadLeaderAssignmentRows,
} from "../lib/groups/leader-data.server.ts";
import {
  filterLeaderRows,
  leaderPreferences,
  leaderReturnPath,
  sortLeaderRows,
  leaderCellText,
  type LeaderTableRow,
} from "../lib/groups/leader-table.ts";
import { writeTableWorkbook } from "../lib/data-quality/workbook.ts";
import { LEADER_TABLE_COPY } from "../lib/groups/leader-table-copy.ts";

// In-memory PostgREST transport exercises the real loader's predicates/ranges.
function database(
  tables: Record<string, Record<string, unknown>[]>,
  failAfter?: number,
) {
  let reads = 0;
  return {
    from(table: string) {
      let rows = tables[table] ?? [];
      const value = (row: Record<string, unknown>, key: string): unknown =>
        key
          .split(".")
          .reduce<unknown>(
            (item, part) => (item as Record<string, unknown>)?.[part],
            row,
          );
      const query = {
        select() {
          return query;
        },
        eq(key: string, val: unknown) {
          rows = rows.filter((row) => value(row, key) === val);
          return query;
        },
        is(key: string, val: unknown) {
          rows = rows.filter((row) => value(row, key) === val);
          return query;
        },
        in(key: string, vals: unknown[]) {
          rows = rows.filter((row) => vals.includes(value(row, key)));
          return query;
        },
        order() {
          return query;
        },
        range(from: number, to: number) {
          reads++;
          return Promise.resolve({
            data: rows.slice(from, to + 1),
            error:
              failAfter && reads > failAfter
                ? { message: "connection lost" }
                : null,
          });
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}
const groups = [
  { id: "root", event_id: "current", parent_group_id: null, is_active: true },
  {
    id: "child",
    event_id: "current",
    parent_group_id: "root",
    is_active: true,
  },
  {
    id: "inactive",
    event_id: "current",
    parent_group_id: "root",
    is_active: false,
  },
  {
    id: "sibling",
    event_id: "current",
    parent_group_id: null,
    is_active: true,
  },
  { id: "historic", event_id: "old", parent_group_id: null, is_active: true },
];
const members = [
  { user_id: "leader", role: "capogruppo", group_id: "root" },
  { user_id: "leader", role: "capogruppo", group_id: "historic" },
  { user_id: "someone-else", role: "capogruppo", group_id: "sibling" },
];
test("real leader scope uses their memberships in current event and active descendants; admin gets no implicit global export", async () => {
  const db = database({ groups, group_memberships: members });
  const scope = await loadLeaderScope(db, "leader", "current");
  assert.deepEqual(scope.rootGroupIds, ["root"]);
  assert.deepEqual([...scope.scopedGroupIds], ["root", "child"]);
  assert.equal(
    (await loadLeaderScope(db, "admin-without-membership", "current"))
      .scopedGroupIds.size,
    0,
  );
});
test("scope discovery pages beyond 1000 groups and memberships", async () => {
  const many = Array.from({ length: 1205 }, (_, i) => ({
    id: `g${i}`,
    event_id: "current",
    parent_group_id: null,
    is_active: true,
  }));
  const memberships = many.map((g) => ({
    user_id: "leader",
    role: "capogruppo",
    group_id: g.id,
  }));
  const scope = await loadLeaderScope(
    database({ groups: many, group_memberships: memberships }),
    "leader",
    "current",
  );
  assert.equal(scope.scopedGroupIds.size, 1205);
});
test("all assignments beyond 1000 load; other groups/events, deleted and historic assignments excluded", async () => {
  const records = Array.from({ length: 1205 }, (_, i) => ({
    id: `a${i}`,
    group_id: i % 2 ? "child" : "root",
    is_current: true,
    registrations: { event_id: "current", deleted_at: null },
  }));
  const rejected = [
    { ...records[0], id: "foreign-group", group_id: "sibling" },
    {
      ...records[0],
      id: "foreign-event",
      registrations: { event_id: "old", deleted_at: null },
    },
    {
      ...records[0],
      id: "deleted",
      registrations: { event_id: "current", deleted_at: "2026-09-07" },
    },
    { ...records[0], id: "historic", is_current: false },
  ];
  const loaded = await loadLeaderAssignmentRows(
    database({ participant_group_assignments: [...records, ...rejected] }),
    "current",
    ["root", "child"],
  );
  assert.equal(loaded.length, 1205);
  assert.equal(loaded.at(-1)?.id, "a1204");
  assert.equal(
    (
      await loadLeaderAssignmentRows(
        database({ participant_group_assignments: records }),
        "current",
        [],
      )
    ).length,
    0,
  );
  await assert.rejects(
    loadLeaderAssignmentRows(
      database({ participant_group_assignments: records }, 1),
      "current",
      ["root", "child"],
    ),
    /connection lost/,
  );
});
const row = (
  id: string,
  name: string,
  overrides: Partial<LeaderTableRow> = {},
): LeaderTableRow => ({
  id,
  registrationId: id,
  groupId: "root",
  participantName: name,
  participantCode: id,
  participantPlace: "Roma, Italia",
  participantEmail: `${id}@example.test`,
  participantPhone: "+3912345678",
  participantCountry: "Italia",
  participantCity: "Roma",
  birthDate: "2000-10-26",
  groupName: "Gruppo",
  submittedAt: "2026-09-07T10:00:00Z",
  tagIds: [],
  tags: [],
  serviceLabel: null,
  ...overrides,
});
test("filters and stable locale sorting agree for table/export; tampered group yields no rows", () => {
  const rows = [
    row("b", "Persona 10"),
    row("a", "Persona 2", {
      tagIds: ["tag"],
      tags: [{ id: "tag", label: "Presente", color: "#123456" }],
    }),
  ];
  const prefs = leaderPreferences(
    new URLSearchParams(
      "columns=tags,name,phone,password&sort=name&direction=asc",
    ),
  );
  assert.deepEqual(prefs.columns, ["name", "tags", "phone"]);
  assert.deepEqual(
    sortLeaderRows(rows, prefs, "2026-10-25", "it").map((r) => r.id),
    ["a", "b"],
  );
  assert.deepEqual(
    filterLeaderRows(
      rows,
      new URLSearchParams(
        "q=persona&contact=a%40example.test&group=root&tag=tag",
      ),
    ).map((r) => r.id),
    ["a"],
  );
  assert.equal(
    filterLeaderRows(rows, new URLSearchParams("group=foreign")).length,
    0,
  );
  assert.deepEqual(
    filterLeaderRows(rows, new URLSearchParams("tag=none")).map((r) => r.id),
    ["b"],
  );
  assert.equal(leaderCellText(rows[0], "age", "2026-10-25", "it"), "25");
});
test("Excel contains only visible columns in requested order, all rows, safe literal formula-like strings", async () => {
  const prefs = leaderPreferences(
    new URLSearchParams("columns=phone,name,age&direction=desc"),
  );
  const rows = Array.from({ length: 1205 }, (_, i) =>
    row(String(i), i ? `Persona ${i}` : '=HYPERLINK("https://example.test")'),
  );
  const sorted = sortLeaderRows(rows, prefs, "2026-10-25", "it");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    (await writeTableWorkbook(
      "Iscritti",
      prefs.columns.map((col) => LEADER_TABLE_COPY.it.columns[col]),
      sorted.map((r) =>
        prefs.columns.map((col) => leaderCellText(r, col, "2026-10-25", "it")),
      ),
    )) as never,
  );
  assert.equal(book.worksheets.length, 1);
  const sheet = book.worksheets[0];
  assert.equal(sheet.rowCount, 1206);
  assert.equal(sheet.columnCount, 3);
  assert.deepEqual((sheet.getRow(1).values as unknown[]).slice(1), [
    "Partecipante",
    "Telefono",
    "Età",
  ]);
  assert.equal(sheet.getCell("A2").value, sorted[0].participantName);
  sheet.eachRow((r, number) => {
    if (number > 1)
      r.eachCell((cell) => assert.equal(cell.type, ExcelJS.ValueType.String));
  });
});
test("return paths keep filters and preferences through details and reject external redirects", () => {
  const path = leaderReturnPath(
    "/dashboard/capogruppo?q=Anna&group=root&columns=name,phone&sort=phone&direction=desc&assignmentId=one&tool=manual",
    { assignmentId: null, saved: "1" },
  );
  assert.equal(
    new URL(path, "https://local.invalid").searchParams.get("q"),
    "Anna",
  );
  assert.doesNotMatch(path, /assignmentId|tool/);
  assert.equal(
    leaderReturnPath("https://evil.test/dashboard/capogruppo?q=secret"),
    "/dashboard/capogruppo?",
  );
});
// Run the actual route handler with only request-auth and DB transports replaced.
// This does not emulate Supabase RLS or claim a live authenticated integration.
function exportHandler(
  db: SupabaseClient,
  dashboardRole: string | null,
  userId = "leader",
) {
  let serviceCalls = 0;
  const compiled = ts
    .transpileModule(
      readFileSync("app/dashboard/capogruppo/export/route.ts", "utf8"),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      },
    )
    .outputText.replace(/import[\s\S]*?from ["'][^"']+["'];/g, "")
    .replace(/export /g, "");
  const dependencies = {
    getCurrentAuthContext: async () =>
      dashboardRole ? { dashboardRole, user: { id: userId } } : null,
    createSupabaseServerClient: async () => ({}),
    createSupabaseServiceClient: () => {
      serviceCalls++;
      return db;
    },
    getCurrentOperationalEventId: async () => "current",
    getRequestLocale: async () => "it",
    loadLeaderScope,
    loadLeaderAssignmentRows,
    toAssignmentView,
    toLeaderTableRow,
    filterLeaderRows,
    leaderPreferences,
    sortLeaderRows,
    leaderCellText,
    LEADER_TABLE_COPY,
    writeTableWorkbook,
  };
  const handler = new Function(
    ...Object.keys(dependencies),
    `${compiled}; return GET;`,
  )(...Object.values(dependencies)) as (request: Request) => Promise<Response>;
  return { handler, serviceCalls: () => serviceCalls };
}
test("export denies anonymous/participant/manager before service access and admin without membership", async () => {
  const db = database({ groups, group_memberships: members });
  for (const role of [
    null,
    "partecipante",
    "manager",
    "manager_viewer",
    "accoglienza",
  ]) {
    const route = exportHandler(db, role);
    assert.equal(
      (
        await route.handler(
          new Request("http://localhost/dashboard/capogruppo/export"),
        )
      ).status,
      403,
    );
    assert.equal(route.serviceCalls(), 0);
  }
  const admin = exportHandler(db, "capogruppo", "admin-without-membership");
  assert.equal(
    (
      await admin.handler(
        new Request("http://localhost/dashboard/capogruppo/export"),
      )
    ).status,
    403,
  );
});
test("actual export handler scopes a true leader, ignores forged event/user and exports current filtered cells", async () => {
  const assignment = (
    id: string,
    groupId: string,
    eventId: string,
    deletedAt: string | null = null,
  ) => ({
    id,
    registration_id: id,
    group_id: groupId,
    is_current: true,
    groups: {
      id: groupId,
      name: "Gruppo",
      parent_group_id: null,
      is_assignable: true,
      node_type: "group",
    },
    registrations: {
      id,
      event_id: eventId,
      deleted_at: deletedAt,
      status: "submitted",
      submitted_at: "2026-09-07",
      registration_children: [],
      participants: {
        id,
        first_name: id,
        last_name: "Prova",
        public_code: id,
        birth_date: "2000-01-01",
        country_other: "Italia",
        city_other: "Roma",
        countries: null,
        cities: null,
        participant_contacts: [
          {
            email: `${id}@example.test`,
            phone: "+3912345678",
            is_primary: true,
          },
        ],
        participant_event_services: [],
        participant_operational_tags: [],
      },
    },
  });
  const db = database({
    groups,
    group_memberships: members,
    participant_group_assignments: [
      assignment("Anna", "child", "current"),
      assignment("Zeno", "root", "current"),
      assignment("Outside", "sibling", "current"),
      assignment("Old", "child", "old"),
      assignment("Deleted", "child", "current", "2026-09-07"),
    ],
  });
  const route = exportHandler(db, "capogruppo");
  const response = await route.handler(
    new Request(
      "http://localhost/dashboard/capogruppo/export?userId=someone-else&eventId=old&columns=phone,name&sort=name&direction=desc",
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(await response.arrayBuffer()) as never);
  const sheet = book.worksheets[0];
  assert.equal(sheet.rowCount, 3);
  assert.equal(sheet.columnCount, 2);
  assert.equal(sheet.getCell("A2").value, "Zeno Prova");
  assert.equal(sheet.getCell("A3").value, "Anna Prova");
  const filtered = await route.handler(
    new Request("http://localhost/dashboard/capogruppo/export?group=sibling"),
  );
  const empty = new ExcelJS.Workbook();
  await empty.xlsx.load(Buffer.from(await filtered.arrayBuffer()) as never);
  assert.equal(empty.worksheets[0].rowCount, 1);
});
