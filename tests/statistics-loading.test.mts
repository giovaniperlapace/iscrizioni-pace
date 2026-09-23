import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadEventStatisticsSnapshot } from "../lib/registrations/event-statistics.server.ts";
import { participantGeography } from "../lib/registrations/geography.ts";
import { filterStatisticsPeople } from "../lib/registrations/event-statistics.ts";

const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const eventId = uuid(9000);
const dates = { eventStartsOn: "2026-10-25", eventEndsOn: "2026-10-27" };
const registrations = Array.from({ length: 1201 }, (_, i) => ({
  submitted_at: "2026-09-07T10:00:00Z", id: uuid(i), event_id: eventId, events: { title: "Assisi" },
  participants: { first_name: "Persona", last_name: String(i), birth_date: "1990-01-01",
    country_other: null, city_other: null, countries: { name_it: "Italia" }, cities: { name: "Roma" } },
  registration_children: i === 0 ? [{ id: uuid(8000), position: 1, first_name: "Figlio", last_name: "Prova", birth_date: "2020-01-01" }] : [],
}));
const groups = Array.from({ length: 1001 }, (_, i) => ({
  id: uuid(5000 + i), event_id: eventId, name: i === 1000 ? "Italia" : i === 999 ? "Roma" : `Gruppo ${i}`,
  is_assignable: true,
  node_type: i === 1000 ? "country" : i === 999 ? "city" : "group",
  parent_group_id: i === 1000 ? null : uuid(i === 999 ? 6000 : 5999),
}));
function fixture(failure?: { table: string; after: number }) {
  const calls: Record<string, number> = {};
  const urls: URL[] = [];
  const client = createClient("https://database.example.test", "synthetic-key", {
    auth: { persistSession: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input)); urls.push(url);
      const table = url.pathname.split("/").at(-1)!;
      calls[table] = (calls[table] ?? 0) + 1;
      if (url.pathname.length + url.search.length > 8192) return new Response("URI too long", { status: 414 });
      if (failure?.table === table && calls[table] > failure.after) return Response.json({ message: "read failed" }, { status: 400 });
      const ids = url.searchParams.get("registration_id")?.slice(4, -1).split(",") ?? [];
      let rows: unknown[];
      if (table === "registrations" || table === "groups") {
        assert.equal(url.searchParams.get("event_id"), `eq.${eventId}`);
        if (table === "registrations") assert.equal(url.searchParams.get("deleted_at"), "is.null");
        rows = table === "registrations" ? registrations : groups;
      } else if (table === "participant_group_assignments") {
        assert.equal(url.searchParams.get("is_current"), "eq.true");
        rows = ids.filter(id => id !== uuid(1200)).map(id => ({ registration_id: id, group_id: uuid(5000) }));
      } else {
        rows = ids.flatMap(id => Array.from({ length: 6 }, (_, i) => ({ registration_id: id, day: `2026-10-${25 + Math.floor(i / 2)}`, day_part: i % 2 ? "afternoon" : "morning", choice: "yes" })));
      }
      const from = Number(url.searchParams.get("offset") ?? 0);
      const limit = Math.min(1000, Number(url.searchParams.get("limit") ?? 1000));
      return Response.json(rows.slice(from, from + limit));
    } },
  });
  return { client, calls, urls };
}

test("statistics paginate all sources, batch UUIDs and preserve family counts and catalogue geography", async () => {
  const { client, calls, urls } = fixture();
  const result = await loadEventStatisticsSnapshot(client, eventId, dates);
  assert.equal(result.summary.totalPeople, 1202);
  assert.ok(urls.filter(url => url.pathname.endsWith("/groups")).every(url => url.searchParams.get("select")?.includes("is_assignable")));
  assert.equal(result.people.find(person => person.registrationId === uuid(0))?.assignedGroupType, "Gruppo effettivo");
  assert.equal(result.registrationTimeline.weeks.reduce((sum, week) => sum + week.count, 0), 1201);
  assert.ok(urls.filter(url => url.pathname.endsWith("/registrations")).every(url => url.searchParams.get("select")?.includes("submitted_at")));
  assert.equal(result.summary.accompanyingChildren, 1);
  assert.equal(result.summary.withoutAttendance, 0);
  assert.equal(result.summary.attendanceSlotCounts["2026-10-27__afternoon"], 1202);
  assert.equal(filterStatisticsPeople(result.people, { group: "Senza gruppo corrente" }).length, 1);
  assert.equal(filterStatisticsPeople(result.people, { city: "Città non indicata" }).length, 0);
  assert.equal(filterStatisticsPeople(result.people, { country: "Italia", city: "Roma" }).length, 1202);
  assert.equal(result.participantBreakdowns.country[0].eventTitle, "Assisi");
  assert.equal(calls.registrations, 3); assert.equal(calls.groups, 3);
  assert.ok(calls.event_attendance_choices > 13);
  assert.ok(urls.every(url => url.searchParams.get("order") === "id.asc"));
});
for (const table of ["registrations", "groups", "participant_group_assignments", "event_attendance_choices"]) {
  test(`statistics reject a later ${table} failure instead of showing partial or missing counts`, async () => {
    const { client } = fixture({ table, after: 1 });
    await assert.rejects(loadEventStatisticsSnapshot(client, eventId, dates), /read failed/);
  });
}

test("catalogue fallback handles object/array joins and preserves explicit updated text", () => {
  assert.deepEqual(participantGeography({ country_other: " ", city_other: null, countries: [{ name_it: "Italia" }], cities: [{ name: "Roma" }] }), { country: "Italia", city: "Roma" });
  assert.deepEqual(participantGeography({ country_other: " Francia ", city_other: " Parigi ", countries: { name_it: "Italia" }, cities: { name: "Roma" } }), { country: "Francia", city: "Parigi" });
  assert.deepEqual(participantGeography(null), { country: null, city: null });
});
