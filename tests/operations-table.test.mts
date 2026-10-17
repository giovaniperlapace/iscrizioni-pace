import assert from "node:assert/strict";
import test from "node:test";
import {
  operationsReturnPath,
  parseTablePreferences,
  DEFAULT_TABLE_PREFERENCES,
  paginateParticipants,
} from "../lib/registrations/operations-table.ts";
import { loadAllRows, loadRowsForIds } from "../lib/supabase/all-rows.ts";

test("save return path preserves operational state and never navigates back to statistics", () => {
  const state = new URLSearchParams({
    section: "dashboard",
    q: "Rossi",
    stat: "age:18",
    group: "none",
    service: "servizio",
    tag: "tag",
    status: "submitted",
    contact: "mail",
    sort: "age",
    direction: "desc",
    columns: "name,age,group",
    nav: "mini",
    edit: "registration",
    view: "duplicates",
    duplicatePage: "3",
    participantPage: "4",
    duplicateShow: "dismissed",
  });
  const path = operationsReturnPath(`/dashboard/manager?${state}`, "manager");
  const result = new URL(path, "https://local.test");
  assert.equal(result.searchParams.get("section"), "iscritti");
  for (const [key, value] of state)
    if (key !== "section")
      assert.equal(result.searchParams.get(key), value, key);
  for (const unsafe of [
    "https://evil.test",
    "//evil.test",
    "/dashboard/admin?edit=x",
    "/dashboard/manager-evil?edit=x",
  ]) {
    assert.equal(
      operationsReturnPath(unsafe, "manager"),
      "/dashboard/manager?section=iscritti&nav=full",
    );
  }
});

test("participant pages cover all results once, in the supplied global order", () => {
  const rows = Array.from({ length: 1203 }, (_, id) => ({ id }));
  const first = paginateParticipants(rows, null);
  assert.equal(first.page, 1);
  assert.equal(first.pageCount, 13);
  assert.equal(first.total, 1203);
  assert.equal(first.first, 1);
  assert.equal(first.last, 100);
  assert.equal(first.rows.length, 100);
  const pages = Array.from({ length: first.pageCount }, (_, i) => paginateParticipants(rows, String(i + 1)));
  assert.deepEqual(pages.flatMap(page => page.rows), rows);
  assert.deepEqual(pages.at(-1)?.rows, rows.slice(1200));
  assert.equal(pages.at(-1)?.first, 1201);
  assert.equal(pages.at(-1)?.last, 1203);
  // Filtering and ordering the whole result must precede pagination.
  const filtered = rows.filter(row => row.id >= 900).reverse();
  assert.deepEqual(paginateParticipants(filtered, "2").rows, filtered.slice(100, 200));
  assert.equal(paginateParticipants(filtered, "2").total, 303);
});

test("participant pages handle empty, exact boundaries, invalid URLs and shrinking results", () => {
  assert.deepEqual(paginateParticipants([], "12"), {
    page: 1, pageCount: 1, first: 0, last: 0, total: 0, rows: [],
  });
  const rows = Array.from({ length: 101 }, (_, i) => i);
  for (const value of [null, "", "0", "-1", "abc", "1.5", "Infinity", "9007199254740992"]) {
    assert.equal(paginateParticipants(rows, value).page, 1, String(value));
  }
  assert.equal(paginateParticipants(rows, "99").page, 2);
  assert.deepEqual(paginateParticipants(rows, "99").rows, [100]);
  const shrunk = paginateParticipants(rows.slice(0, 100), "2");
  assert.equal(shrunk.page, 1);
  assert.equal(shrunk.pageCount, 1);
  assert.equal(shrunk.rows.length, 100);
});

test("corrupt preferences have safe defaults and name is always visible", () => {
  assert.deepEqual(parseTablePreferences(null), DEFAULT_TABLE_PREFERENCES);
  assert.deepEqual(
    parseTablePreferences({
      columns: ["age", "age", "unknown", "status"],
      sort: "__proto__",
      direction: "bad",
    }),
    { columns: ["name", "age"], sort: "name", direction: "asc" },
  );
  assert.deepEqual(
    parseTablePreferences({ columns: ["name", "status"], sort: "status" }),
    { columns: ["name"], sort: "name", direction: "asc" },
  );
  assert.deepEqual(
    parseTablePreferences({ columns: [], sort: "age", direction: "desc" }),
    { columns: ["name"], sort: "age", direction: "desc" },
  );
});

test("operations pagination includes old registrations and every related record beyond backend row caps", async () => {
  const records = Array.from({ length: 1201 }, (_, index) => ({ id: index }));
  const result = await loadAllRows(async (from, to) => ({
    data: records.slice(from, to + 1),
    error: null,
  }));
  assert.deepEqual(result.data, records);
  const calls: number[] = [];
  const related = await loadRowsForIds(
    Array.from({ length: 601 }, (_, i) => String(i)),
    async (ids, from, to) => {
      calls.push(ids.length);
      return {
        data: ids
          .flatMap((id) => [
            { id, tag: 1 },
            { id, tag: 2 },
          ])
          .slice(from, to + 1),
        error: null,
      };
    },
  );
  assert.equal(related.data.length, 1202);
  assert.ok(calls.every((count) => count <= 100));
  await assert.rejects(
    loadAllRows(async () => ({
      data: null,
      error: { message: "database unavailable" },
    })),
    /database unavailable/,
  );
});
