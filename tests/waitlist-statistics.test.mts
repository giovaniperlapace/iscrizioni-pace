import test from "node:test";
import assert from "node:assert/strict";
import { countPanelWaitlist, loadPanelWaitlistCounts, type PanelWaitlistEntry } from "../lib/panels/waitlist-statistics.ts";

test("queue counts selected minors only, live offers separately, excludes stale and inactive entries", () => {
  const base: PanelWaitlistEntry = { panel_id: "p", registration_id: "r", status: "waiting", expires_at: null, reserved_seats: null,
    registrations: { status: "submitted", deleted_at: null, registration_children: [{ id: "selected" }, { id: "other" }] } };
  const counts = countPanelWaitlist([base,
    { ...base, registration_id: "offered", status: "offered", expires_at: "2026-10-21", reserved_seats: 3 },
    { ...base, status: "offered", expires_at: "2026-10-20", reserved_seats: 9 },
    { ...base, status: "accepted" }, { ...base, status: "cancelled" },
    { ...base, registrations: { ...base.registrations, deleted_at: "2026-10-19" } },
    { ...base, registrations: { ...base.registrations, status: "cancelled" } },
  ], [{ panel_id: "p", registration_id: "r", child_ids: ["selected", "foreign"] }], Date.parse("2026-10-20"));
  assert.deepEqual(counts.get("p"), { waitingPeople: 2, offeredPeople: 3 });
});

test("failed queue reads reject rather than reporting zero", async () => {
  const builder = { select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, range() { return this; }, returns() { return Promise.resolve({ data: null, error: { message: "unavailable" } }); } };
  await assert.rejects(loadPanelWaitlistCounts({ from: () => builder } as never, "event"), /unavailable/);
});

test("queue loader reads all pages and scopes every queue page to its event", async () => {
  const ranges: number[] = [];
  const db = { from(table: string) {
    let event = "";
    return { select() { return this; }, eq(key: string, value: string) { if (key === "event_id") event = value; return this; }, in() { return this; }, order() { return this; },
      range(from: number) {
        if (table === "panel_child_selections") return Promise.resolve({ data: [], error: null });
        assert.equal(event, "event"); ranges.push(from);
        return { returns() { return Promise.resolve({ data: Array.from({ length: from === 0 ? 500 : 1 }, (_, index) => ({ panel_id: "p", registration_id: String(from + index), status: "waiting", expires_at: null, reserved_seats: null, registrations: { status: "submitted", deleted_at: null, registration_children: [] } })), error: null }); } };
      }
    };
  } };
  const result = await loadPanelWaitlistCounts(db as never, "event");
  assert.deepEqual(ranges, [0, 500]);
  assert.deepEqual(result.get("p"), { waitingPeople: 501, offeredPeople: 0 });
});
