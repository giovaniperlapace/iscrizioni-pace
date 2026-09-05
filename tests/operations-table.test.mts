import assert from "node:assert/strict";
import test from "node:test";
import {
  operationsReturnPath,
  parseTablePreferences,
  DEFAULT_TABLE_PREFERENCES,
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
    view: "without-group",
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
  assert.ok(calls.every((count) => count <= 300));
  await assert.rejects(
    loadAllRows(async () => ({
      data: null,
      error: { message: "database unavailable" },
    })),
    /database unavailable/,
  );
});
