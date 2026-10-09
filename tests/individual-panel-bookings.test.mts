import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260806120000_individual_panel_bookings.sql"),
  "utf8"
);
const actions = readFileSync(join(process.cwd(), "app/actions.ts"), "utf8");
const dashboard = readFileSync(
  join(process.cwd(), "app/dashboard/partecipante/page.tsx"),
  "utf8"
);
const component = readFileSync(
  join(process.cwd(), "app/dashboard/partecipante/participant-panel-bookings.tsx"),
  "utf8"
);

test("P6 extends canonical moment choices with their individual seat section", () => {
  assert.match(migration, /alter table public\.moment_attendance_choices[\s\S]*add column seat_section_id uuid/);
  assert.match(migration, /references public\.panel_seat_sections\(id\) on delete restrict/);
  assert.match(migration, /confirmed panel choices require a seat section/);
  assert.match(migration, /participant choices require an individual panel section/);
  assert.doesNotMatch(migration, /create table public\.(panel_bookings|individual_panel_bookings)/);
});

test("P6 booking RPC serializes capacity and blocks overlapping choices", () => {
  assert.match(migration, /create or replace function public\.set_individual_panel_booking/);
  assert.match(migration, /from public\.registrations registration[\s\S]*for update/);
  assert.match(migration, /from public\.panel_seat_sections section[\s\S]*order by section\.id[\s\S]*for update/);
  assert.match(migration, /v_occupied \+ v_party_size > v_capacity/);
  assert.match(migration, /tstzrange\(selected_panel\.starts_at, selected_panel\.ends_at, '\[\)'\)/);
  assert.match(migration, /create constraint trigger event_moments_validate_participant_panel_overlaps/);
  assert.match(migration, /on conflict \(registration_id, moment_id\) do update/);
  assert.match(migration, /panel\.individual_booking_confirmed/);
  assert.match(migration, /panel\.individual_booking_cancelled/);
  assert.match(
    migration,
    /revoke all on function app\.panel_section_occupancy\(uuid\) from public, anon, authenticated/
  );
});

test("family-size changes and published capacity reductions remain protected", () => {
  assert.match(migration, /create constraint trigger registration_children_validate_panel_capacity/);
  assert.match(migration, /create constraint trigger panel_sections_validate_booked_capacity/);
  assert.match(migration, /create or replace function public\.replace_owned_registration_children/);
  assert.match(actions, /supabase\.rpc\("replace_owned_registration_children"/);
  assert.match(migration, /1 \+ count\(\*\)::integer[\s\S]*registration_children/);
  assert.match(
    migration,
    /create or replace function public\.replace_owned_registration_children[\s\S]*from public\.registrations registration[\s\S]*for update[\s\S]*from public\.panel_seat_sections section[\s\S]*for update/
  );
});

test("participant UI uses the atomic RPC and never resubmits panel choices as hidden registration fields", () => {
  assert.match(actions, /export async function setParticipantPanelBooking/);
  assert.match(actions, /supabase\.rpc\("set_individual_panel_booking"/);
  assert.match(dashboard, /supabase\.rpc\("get_participant_panel_catalog"/);
  assert.match(dashboard, /generalMomentChoices/);
  assert.match(component, /action=\{setParticipantPanelBooking\}/);
  assert.match(component, /copy\.liveAvailability/);
  assert.match(component, /disabled=\{disabled\}/);
  assert.match(component, /it: \{/);
  assert.match(component, /en: \{/);
  assert.match(component, /fr: \{/);
  assert.match(component, /de: \{/);
  assert.match(component, /es: \{/);
  assert.match(component, /nl: \{/);
  assert.match(component, /uk: \{/);
});

test("public programme availability is section-aware after P6", () => {
  assert.match(migration, /create or replace function public\.get_public_panel_program/);
  assert.match(migration, /bool_or\(app\.panel_section_occupancy\(section\.id\) < section\.capacity\)/);
  assert.doesNotMatch(migration, /location_address text,[\s\S]*capacity (integer|bigint)/);
});
