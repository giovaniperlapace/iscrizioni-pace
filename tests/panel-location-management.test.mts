import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";

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
const capacityLimitMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260807120000_allow_underfilled_panel_sections.sql"
  ),
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

test("server actions enforce event scope and keep location capacity protected", () => {
  assert.match(actions, /export async function saveEventLocation/);
  assert.match(actions, /export async function deleteEventLocation/);
  assert.match(actions, /role\.role === "manager" && role\.eventId === eventId/);
  assert.match(actions, /errorMessage\.includes\("capacity limit"\)/);
  assert.match(actions, /\? "published-capacity"/);
  assert.match(actions, /locationError=location-in-use/);
  assert.match(actions, /event_location\.created/);
  assert.match(actions, /event_location\.updated/);
  assert.match(actions, /event_location\.deleted/);
  assert.match(
    capacityLimitMigration,
    /section_capacity > location_capacity/
  );
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
  assert.match(locationSection, /section=panel&panelView=locations&nav=\$\{navMode\}/);
});

test("location actions close the overlay and return to Locations for both nav modes", async () => {
  const ast = ts.createSourceFile("actions.ts", actions, ts.ScriptTarget.Latest, true);
  const names = ["saveEventLocation", "deleteEventLocation", "getPanelLocationsDashboardPath"];
  const source = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text ?? ""))
    .map(node => node.getText(ast).replace(/^export /, "")).join("\n");
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let authorizations = 0;
  const result = { data: { id: "synthetic-location", event_id: "synthetic-event", name: "Sala sintetica", max_capacity: 100 }, count: 0, error: null };
  const query = {
    select() { return query; }, eq() { return query; }, insert() { return query; },
    update() { return query; }, delete() { return query; },
    async single() { return result; }, async maybeSingle() { return result; },
    then(resolve: (value: typeof result) => unknown) { return Promise.resolve(result).then(resolve); },
  };
  const deps = {
    requirePanelAdministrator: async () => { authorizations++; },
    optionalText: (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null,
    normalizeEventLocationName, normalizeEventLocationAddress, parseEventLocationCapacity,
    EVENT_LOCATION_NAME_MAX_LENGTH, EVENT_LOCATION_ADDRESS_MAX_LENGTH,
    createSupabaseServerClient: async () => ({}),
    getCurrentAuthContext: async () => ({ user: { id: "synthetic-admin" }, eventRoles: [{ role: "admin" }] }),
    createSupabaseServiceClient: () => ({ from: () => query }),
    revalidatePath: () => {},
    redirect: (path: string) => { throw new Error(path); },
  };
  const handlers = new Function(...Object.keys(deps), `${code}; return {saveEventLocation, deleteEventLocation};`)(...Object.values(deps)) as Record<string, (form: FormData) => Promise<void>>;
  for (const nav of ["full", "mini"]) {
    for (const operation of ["created", "updated", "deleted", "invalid"]) {
      const form = new FormData();
      for (const [key, value] of Object.entries({ sourceDashboard: "admin", nav, eventId: "synthetic-event", name: "Sala sintetica", maxCapacity: "100" })) form.set(key, value);
      if (operation === "updated" || operation === "deleted") form.set("locationId", "synthetic-location");
      if (operation === "invalid") form.set("maxCapacity", "0");
      const handler = operation === "deleted" ? handlers.deleteEventLocation : handlers.saveEventLocation;
      await assert.rejects(handler(form), (error: Error) => {
        const url = new URL(error.message, "https://example.invalid");
        assert.equal(url.pathname, "/dashboard/admin");
        assert.equal(url.searchParams.get("section"), "panel");
        assert.equal(url.searchParams.get("panelView"), "locations");
        assert.equal(url.searchParams.get("nav"), nav);
        assert.equal(url.searchParams.get(operation === "invalid" ? "locationError" : "locationSaved"), operation);
        assert.equal(url.searchParams.has("locationTool"), false);
        assert.equal(url.searchParams.has("locationId"), false);
        return true;
      });
    }
  }
  assert.equal(authorizations, 8);
});
