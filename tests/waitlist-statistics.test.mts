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

test("uncovered queue counts unique people by Rome day/half-day against all confirmed Forums", async () => {
  const { countWaitlistedWithoutBooking: count } = await import("../lib/panels/waitlist-statistics.ts");
  const panels = [
    {id:"morning",startsAt:"2026-10-26T08:00:00Z"},
    {id:"morning2",startsAt:"2026-10-26T10:00:00Z"},
    {id:"noon",startsAt:"2026-10-26T11:00:00Z"},
    {id:"late",startsAt:"2026-10-26T16:00:00Z"},
    {id:"tomorrow",startsAt:"2026-10-27T08:00:00Z"},
    {id:"rome-midnight",startsAt:"2026-10-25T23:30:00Z"},
  ];
  const row = (panel_id:string, registration_id="r"): PanelWaitlistEntry => ({panel_id,registration_id,status:"waiting",expires_at:null,reserved_seats:null,registrations:{status:"submitted",deleted_at:null,registration_children:[]}});
  const booking = (panelId:string, registrationId="r") => ({panelId,registrationId,sectionId:"s",choice:"yes",registrationStatus:"confirmed",selectedChildIds:[] as string[]});
  assert.equal(count(panels,[],[row("morning"),row("morning2"),row("late"),row("tomorrow")],[]),1);
  assert.equal(count(panels,[booking("morning2")],[row("morning")],[]),0);
  assert.equal(count(panels,[booking("noon")],[row("late")],[]),0); // 12:00 and 17:00 same afternoon
  assert.equal(count(panels,[booking("rome-midnight")],[row("morning")],[]),0); // UTC day differs
  assert.equal(count(panels,[booking("morning")],[row("late")],[]),1);
  assert.equal(count(panels,[booking("tomorrow")],[row("morning")],[]),1);
  assert.equal(count(panels,[booking("morning")],[row("morning2"),row("late")],[]),1);
  assert.equal(count(panels,[{...booking("morning"),choice:"no"}],[row("morning2")],[]),1);
  assert.equal(count(panels,[{...booking("morning"),registrationStatus:"cancelled"}],[row("morning2")],[]),1);
  assert.equal(count(panels,[booking("morning","other")],[row("morning2")],[]),1);
});

test("uncovered queue handles selected minors individually, active offers and invalid requests", async () => {
  const { countWaitlistedWithoutBooking: count } = await import("../lib/panels/waitlist-statistics.ts");
  const panels=[{id:"p",startsAt:"2026-10-26T09:00:00Z"},{id:"other",startsAt:"2026-10-26T10:00:00Z"}];
  const row:PanelWaitlistEntry={panel_id:"p",registration_id:"r",status:"waiting",expires_at:null,reserved_seats:null,registrations:{status:"submitted",deleted_at:null,registration_children:[{id:"a"},{id:"b"},{id:"unselected"}]}};
  const selections=[{panel_id:"p",registration_id:"r",child_ids:["a","b","foreign"]}];
  const choices=[{panelId:"other",registrationId:"r",sectionId:"s",choice:"yes",registrationStatus:"submitted",selectedChildIds:["a"]}];
  assert.equal(count(panels,[],[row],selections),3);
  assert.equal(count(panels,choices,[row],selections),1); // child b has no confirmed seat
  assert.equal(count(panels,[{...choices[0],selectedChildIds:["a","b"]}],[row],selections),0);
  const now=Date.parse("2026-10-21T00:00:00Z");
  assert.equal(count(panels,[],[{...row,status:"offered",expires_at:"2026-10-21T01:00:00Z"}],selections,now),3);
  for(const invalid of [{...row,status:"offered",expires_at:"2026-10-21T00:00:00Z"},{...row,status:"cancelled"},{...row,status:"accepted"},{...row,panel_id:"foreign"},{...row,registrations:{...row.registrations,status:"cancelled"}},{...row,registrations:{...row.registrations,deleted_at:"2026-10-20"}}]) assert.equal(count(panels,[],[invalid],selections,now),0);
});
