import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadPresenceSource } from "../lib/presence-exports/data.server.ts";

const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const event = { id: uuid(9000), title: "Prova", starts_on: "2026-10-25", ends_on: "2026-10-27" };
function fixture(failure?: string) {
  const calls: Record<string, number> = {};
  const client = createClient("https://fixture.example.test", "synthetic", { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(String(input));
    assert.ok(url.href.length < 8192);
    assert.doesNotMatch(url.searchParams.get("select") ?? "", /first_name|last_name|email|phone|birth_date|sex|disability/);
    const table = url.pathname.split("/").at(-1)!;
    calls[table] = (calls[table] ?? 0) + 1;
    if (table === failure && calls[table] > 1) return Response.json({ message: "late page failed" }, { status: 400 });
    const ids = (url.searchParams.get("registration_id") ?? url.searchParams.get("participant_id"))?.slice(4, -1).split(",") ?? [];
    let rows: unknown[] = [];
    if (["registrations", "groups", "event_services", "operational_tags"].includes(table)) {
      assert.equal(url.searchParams.get("event_id"), `eq.${event.id}`);
      if (table === "registrations") {
        assert.equal(url.searchParams.get("deleted_at"), "is.null");
        rows = Array.from({ length: 1201 }, (_, i) => ({ id: uuid(i), participant_id: uuid(i + 2000) }));
      } else rows = Array.from({ length: 1001 }, (_, i) => ({ id: uuid(i + 4000), name: `Group ${i}`, label: `Tag/service ${i}`, parent_group_id: null, is_assignable: true }));
    } else {
      assert.ok(ids.length > 0 && ids.length <= 100);
      if (table === "participant_group_assignments") assert.equal(url.searchParams.get("is_current"), "eq.true");
      if (table === "participant_event_services") {
        assert.equal(url.searchParams.get("event_id"), `eq.${event.id}`);
        assert.equal(url.searchParams.get("status"), "eq.assigned");
      }
      if (table === "participant_operational_tags") {
        assert.equal(url.searchParams.get("operational_tags.event_id"), `eq.${event.id}`);
        assert.equal(url.searchParams.get("order"), "participant_id.asc,tag_id.asc");
      }
      rows = ids.flatMap(id => Array.from({ length: table === "event_attendance_choices" || table === "registration_children" ? 7 : 1 }, (_, i) => ({ id: `${id}-${i}`, registration_id: id, participant_id: id, group_id: uuid(4000), tag_id: uuid(4000), service_id: uuid(4000), status: "assigned", day: "2026-10-25", day_part: "morning", choice: "yes" })));
    }
    const start = Number(url.searchParams.get("offset") ?? 0), limit = Math.min(1000, Number(url.searchParams.get("limit") ?? 1000));
    return Response.json(rows.slice(start, start + limit));
  } } });
  return { client, calls };
}
test("presence exports paginate every source and batch all authorized IDs, including children and tags", async () => {
  const f = fixture(); const data = await loadPresenceSource(f.client, event, true);
  assert.equal(data.registrations.length, 1201); assert.equal(data.groups.length, 1001);
  assert.equal(data.children.length, 1201 * 7); assert.equal(data.attendance.length, 1201 * 7);
  assert.equal(data.tagAssignments.length, 1201); assert.equal(data.serviceAssignments.length, 1201);
  assert.ok(f.calls.registration_children > 13);
});
for (const table of ["registrations", "groups", "registration_children", "participant_group_assignments", "event_attendance_choices", "event_services", "operational_tags", "participant_event_services", "participant_operational_tags"]) {
  test(`presence export refuses partial data after a later ${table} error`, async () => {
    await assert.rejects(loadPresenceSource(fixture(table).client, event, true), /late page failed/);
  });
}
test("A reports do not load service or personal tag assignments", async () => {
  const f = fixture(); await loadPresenceSource(f.client, event, false);
  assert.equal(f.calls.event_services, undefined);
  assert.equal(f.calls.participant_event_services, undefined);
  assert.equal(f.calls.participant_operational_tags, undefined);
});
