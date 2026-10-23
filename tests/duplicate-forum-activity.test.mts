import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDuplicateForumActivity } from "../lib/data-quality/forum-activity.server.ts";

function database(fail = false) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const rows: Record<string, unknown[]> = {
    event_moments: [{ id: "p10", title: "Forum 10" }, { id: "p2", title: "Forum 2" }],
    moment_attendance_choices: [{ registration_id: "a", moment_id: "p10" }, { registration_id: "a", moment_id: "p2" }],
    panel_waitlist: [
      { registration_id: "b", panel_id: "p2", status: "waiting" },
      { registration_id: "b", panel_id: "p10", status: "offered", expires_at: "2999-01-01" },
      { registration_id: "a", panel_id: "p2", status: "offered", expires_at: "2000-01-01" },
      { registration_id: "a", panel_id: "outside-event", status: "waiting" },
    ],
  };
  const db = { from(table: string) {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "not", "order", "range"]) {
      query[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        if (method === "range") return Promise.resolve({ data: rows[table], error: fail && table === "panel_waitlist" ? { message: "unavailable" } : null });
        return query;
      };
    }
    return query;
  } } as unknown as SupabaseClient;
  return { db, calls };
}

test("duplicate accounts keep distinct Forum activity, numeric order and live offers", async () => {
  const { db, calls } = database();
  const activity = await loadDuplicateForumActivity(db, "event", ["a", "b", "empty"]);
  assert.deepEqual(activity.get("a"), { booked: [{ id: "p2", title: "Forum 2" }, { id: "p10", title: "Forum 10" }], queued: [] });
  assert.deepEqual(activity.get("b"), { booked: [], queued: [{ id: "p2", title: "Forum 2", offered: false }, { id: "p10", title: "Forum 10", offered: true }] });
  assert.deepEqual(activity.get("empty"), { booked: [], queued: [] });
  for (const table of ["event_moments", "panel_waitlist"]) assert.ok(calls.some(c => c.table === table && c.method === "eq" && c.args[0] === "event_id" && c.args[1] === "event"));
  for (const table of ["moment_attendance_choices", "panel_waitlist"]) assert.ok(calls.some(c => c.table === table && c.method === "in" && c.args[0] === "registration_id"));
  assert.ok(calls.some(c => c.method === "not" && c.args[0] === "seat_section_id"));
});

test("read failures never become empty activity", async () => {
  await assert.rejects(loadDuplicateForumActivity(database(true).db, "event", ["a"]), /unavailable/);
});

test("no duplicate rows require no Forum reads", async () => {
  const { db, calls } = database();
  assert.equal((await loadDuplicateForumActivity(db, "event", [])).size, 0);
  assert.equal(calls.length, 0);
});
