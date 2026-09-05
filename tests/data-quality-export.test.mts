import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { filteredExportPeople } from "../lib/data-quality/data.server.ts";
const registrations = Array.from({ length: 1205 }, (_, i) => ({
  id: `r${i}`,
  event_id: "e",
  participant_id: `p${i}`,
  status: i === 1204 ? "cancelled" : "submitted",
  deleted_at: null,
  participants: {
    first_name: `Person ${i}`,
    last_name: "Fixture",
    birth_date: "1990-01-01",
    country_other: i > 1100 ? "France" : "Italia",
    city_other: "Roma",
    public_code: `C${i}`,
    auth_user_id: null,
  },
  registration_children:
    i === 1203
      ? [
          {
            id: "child",
            first_name: "Child",
            last_name: "Fixture",
            birth_date: "2015-01-01",
            position: 1,
          },
        ]
      : [],
}));
const calls: string[] = [];
function database() {
  const tables: Record<string, object[]> = {
    registrations,
    participant_contacts: registrations.map((r, i) => ({
      id: `c${i}`,
      participant_id: r.participant_id,
      email: `p${i}@example.test`,
      phone: null,
    })),
    participant_group_assignments: [],
    participant_event_services: [],
    participant_operational_tags: [],
    event_attendance_choices: [],
    groups: [],
  };
  return {
    from(table: string) {
      let rows = tables[table] ?? [];
      const query = {
        select() {
          return query;
        },
        eq(field: string, value: unknown) {
          if (field === "event_id")
            rows = rows.filter(
              (r) => (r as Record<string, unknown>)[field] === value,
            );
          return query;
        },
        in(field: string, ids: string[]) {
          rows = rows.filter((r) =>
            ids.includes(String((r as Record<string, unknown>)[field])),
          );
          return query;
        },
        order() {
          return query;
        },
        range(from: number, to: number) {
          calls.push(`${table}:${from}`);
          return Promise.resolve({
            data: rows.slice(from, to + 1),
            error: null,
          });
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}
test("export uses all filtered rows after pagination, including a match beyond 1000", async () => {
  const result = await filteredExportPeople(
    database(),
    {
      id: "e",
      title: "Fixture",
      starts_on: "2026-10-25",
      ends_on: "2026-10-27",
    },
    new URLSearchParams("contact=p1203%40example.test"),
  );
  assert.equal(result.people.length, 1);
  assert.equal(result.people[0].id, "r1203");
  assert.ok(calls.includes("registrations:1000"));
  const all = await filteredExportPeople(
    database(),
    { id: "e", title: "Fixture", starts_on: null, ends_on: null },
    new URLSearchParams("status=submitted&view=without-group"),
  );
  assert.equal(all.people.length, 1204);
  const cancelled = await filteredExportPeople(
    database(),
    { id: "e", title: "Fixture", starts_on: null, ends_on: null },
    new URLSearchParams("status=cancelled"),
  );
  assert.equal(cancelled.people[0].id, "r1204");
  const children = await filteredExportPeople(
    database(),
    {
      id: "e",
      title: "Fixture",
      starts_on: "2026-10-25",
      ends_on: "2026-10-27",
    },
    new URLSearchParams({ stat: "kind=child&age=0-14" }),
  );
  assert.deepEqual(
    children.people.map((person) => person.id),
    ["r1203"],
  );
  assert.equal(children.people[0].children.length, 1);
});
