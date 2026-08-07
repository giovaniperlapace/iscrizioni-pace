import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260805230000_panel_publication_management.sql"),
  "utf8"
);
const actions = readFileSync(join(process.cwd(), "app/actions.ts"), "utf8");
const table = readFileSync(
  join(process.cwd(), "app/dashboard/panel-publication-table.tsx"),
  "utf8"
);
const section = readFileSync(
  join(process.cwd(), "app/dashboard/panel-drafts-section.tsx"),
  "utf8"
);
const capacityLimitMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260807120000_allow_underfilled_panel_sections.sql"
  ),
  "utf8"
);

test("P4 publishes a batch atomically after locking and validating every panel", () => {
  assert.match(migration, /create or replace function public\.publish_panels/);
  assert.match(migration, /for update/);
  assert.match(migration, /v_found_count <> v_requested_count/);
  assert.match(migration, /panel section capacity total/);
  assert.match(migration, /update public\.event_moments[\s\S]*publication_status = 'published'/);
  assert.match(migration, /'panel\.batch_published'/);
  assert.match(migration, /grant execute on function public\.publish_panels/);
});

test("P4 updates published panels atomically and protects confirmed seats", () => {
  assert.match(migration, /create or replace function public\.save_published_panel/);
  assert.match(migration, /publication_status = 'published'[\s\S]*for update/);
  assert.match(migration, /moment_attendance_choices[\s\S]*choice\.choice = 'yes'/);
  assert.match(migration, /v_individual_capacity < v_confirmed_count/);
  assert.match(migration, /'panel\.published_updated'/);
  assert.match(migration, /'affected_registration_count'/);
  assert.match(capacityLimitMigration, /v_section_capacity > v_location_capacity/);
});

test("publication accepts unused physical capacity but rejects over-allocation", () => {
  assert.match(capacityLimitMigration, /\) <= location\.max_capacity/);
  assert.match(
    capacityLimitMigration,
    /capacity total exceeds location capacity limit/
  );
});

test("server actions authorize publication and route published edits to the dedicated RPC", () => {
  assert.match(actions, /export async function publishPanels/);
  assert.match(actions, /new Set\([\s\S]*formData[\s\S]*getAll\("panelIds"\)/);
  assert.match(actions, /supabase\.rpc\("publish_panels"/);
  assert.match(actions, /revalidatePath\("\/"\)/);
  assert.match(actions, /"save_published_panel"/);
  assert.match(actions, /panelError=\$\{errorCode\}/);
});

test("responsive catalog supports filtered selection, single publication and confirmation", () => {
  assert.match(table, /Seleziona tutte le bozze filtrate/);
  assert.match(table, /Pubblica selezionati/);
  assert.match(table, /setDialogIds\(\[panel\.id\]\)/);
  assert.match(table, /La pubblicazione è atomica/);
  assert.match(table, /name="panelIds"/);
  assert.match(table, /formatPublicationDate/);
  assert.match(section, /Modifica di un panel già pubblico/);
  assert.match(section, /campaignPanel=\$\{encodeURIComponent\(panel\.id\)\}/);
});
