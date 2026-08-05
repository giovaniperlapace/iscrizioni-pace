import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  EVENT_LOCATION_ADDRESS_MAX_LENGTH,
  EVENT_LOCATION_NAME_MAX_LENGTH,
  filterEventLocations,
  normalizeEventLocationAddress,
  normalizeEventLocationName,
  normalizeEventLocationSearch,
  parseEventLocationCapacity,
  type EventLocationOption,
} from "../lib/panels/event-locations.ts";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260805200000_panel_location_management.sql"
  ),
  "utf8"
);
const actions = readFileSync(join(process.cwd(), "app/actions.ts"), "utf8");
const locationSection = readFileSync(
  join(process.cwd(), "app/dashboard/panel-locations-section.tsx"),
  "utf8"
);
const managerDashboard = readFileSync(
  join(process.cwd(), "app/dashboard/manager/page.tsx"),
  "utf8"
);
const adminDashboard = readFileSync(
  join(process.cwd(), "app/dashboard/admin/page.tsx"),
  "utf8"
);

test("location fields normalize whitespace and reject invalid capacities", () => {
  assert.equal(normalizeEventLocationName("  Sala   Blu  "), "Sala Blu");
  assert.equal(normalizeEventLocationAddress("  Via   di Test 1  "), "Via di Test 1");
  assert.equal(normalizeEventLocationAddress("   "), null);
  assert.equal(parseEventLocationCapacity("120"), 120);
  assert.equal(parseEventLocationCapacity("0"), null);
  assert.equal(parseEventLocationCapacity("-1"), null);
  assert.equal(parseEventLocationCapacity("2.5"), null);
  assert.equal(parseEventLocationCapacity("abc"), null);
});

test("location search covers name, address and associated panel titles", () => {
  const locations: EventLocationOption[] = [
    {
      id: "one",
      eventId: "event",
      name: "Sala Blu",
      address: "Via della Pace 1",
      maxCapacity: 120,
      isActive: true,
      panels: [
        { id: "panel", title: "Dialogo tra generazioni", publicationStatus: "published" },
      ],
    },
    {
      id: "two",
      eventId: "event",
      name: "Sala Verde",
      address: null,
      maxCapacity: null,
      isActive: true,
      panels: [],
    },
  ];

  assert.deepEqual(filterEventLocations(locations, "pace").map((row) => row.id), ["one"]);
  assert.deepEqual(filterEventLocations(locations, "generazioni").map((row) => row.id), ["one"]);
  assert.equal(normalizeEventLocationSearch(`  ${"a".repeat(100)}  `).length, 80);
});

test("P2 database guardrails allow managers but not manager viewers to write", () => {
  assert.match(migration, /event_locations_name_not_blank/);
  assert.match(migration, /length\(btrim\(name\)\) between 1 and 100/);
  assert.match(migration, /event_locations_address_length/);
  assert.match(migration, /create policy "event locations managers manage"/);
  assert.match(migration, /array\['manager'\]::public\.app_role\[\]/);
  assert.doesNotMatch(migration, /array\['manager', 'manager_viewer'\].*manage/);
});

test("server actions enforce event scope and protect locations in use", () => {
  assert.match(actions, /export async function saveEventLocation/);
  assert.match(actions, /export async function deleteEventLocation/);
  assert.match(actions, /role\.role === "manager" && role\.eventId === eventId/);
  assert.match(actions, /\.eq\("publication_status", "published"\)/);
  assert.match(actions, /locationError=published-capacity/);
  assert.match(actions, /locationError=location-in-use/);
  assert.match(actions, /event_location\.created/);
  assert.match(actions, /event_location\.updated/);
  assert.match(actions, /event_location\.deleted/);
});

test("shared responsive UI exposes overlays and read-only manager viewer state", () => {
  assert.match(locationSection, /md:hidden/);
  assert.match(locationSection, /hidden overflow-x-auto md:block/);
  assert.match(locationSection, /role="dialog"/);
  assert.match(locationSection, /aria-modal="true"/);
  assert.match(locationSection, /Vista in sola lettura/);
  assert.match(locationSection, /min=\{1\}/);
  assert.match(locationSection, /step=\{1\}/);
  assert.match(locationSection, new RegExp(`maxLength=\\{EVENT_LOCATION_NAME_MAX_LENGTH\\}`));
  assert.equal(EVENT_LOCATION_NAME_MAX_LENGTH, 100);
  assert.equal(EVENT_LOCATION_ADDRESS_MAX_LENGTH, 240);
});

test("admin and manager share the Panel location section and preserve nav mode", () => {
  assert.match(managerDashboard, /key: "panel"/);
  assert.match(adminDashboard, /key: "panel"/);
  assert.match(managerDashboard, /<PanelLocationsSection/);
  assert.match(adminDashboard, /<PanelLocationsSection/);
  assert.match(locationSection, /section=panel&nav=\$\{navMode\}/);
});
