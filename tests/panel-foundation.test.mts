import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260805160000_panel_foundation.sql"
  ),
  "utf8"
);

const stagingSeed = readFileSync(
  join(process.cwd(), "supabase/seeds/panel-p1-staging.sql"),
  "utf8"
);

test("panel foundation extends locations and moments without replacing canonical tables", () => {
  assert.match(migration, /alter table public\.event_locations/);
  assert.match(migration, /add column max_capacity integer/);
  assert.match(migration, /add column is_active boolean not null default true/);
  assert.match(migration, /alter table public\.event_moments/);
  assert.match(
    migration,
    /add column moment_type public\.event_moment_type not null default 'general'/
  );
  assert.match(
    migration,
    /add column publication_status public\.panel_publication_status not null default 'draft'/
  );
  assert.doesNotMatch(migration, /create table public\.event_moments/);
});

test("panel audience channels are explicit and inactive types remain historical", () => {
  assert.match(
    migration,
    /create type public\.panel_booking_channel as enum \([\s\S]*'individual'[\s\S]*'school_booking'[\s\S]*'internal_assignment'/
  );
  assert.match(migration, /create table public\.panel_audience_types/);
  assert.match(migration, /is_active boolean not null default true/);
  assert.match(
    migration,
    /audience_type_id uuid not null references public\.panel_audience_types\(id\) on delete restrict/
  );
  assert.match(
    migration,
    /inactive audience types cannot be added to panels/
  );
});

test("seat sections are scoped to one event and unique per panel audience", () => {
  assert.match(migration, /create table public\.panel_seat_sections/);
  assert.match(migration, /event_id uuid not null references public\.events/);
  assert.match(migration, /capacity integer not null check \(capacity >= 0\)/);
  assert.match(
    migration,
    /unique \(panel_id, audience_type_id\)/
  );
  assert.match(migration, /panel section event scope mismatch/);
  assert.match(migration, /seat sections can be assigned only to panel moments/);
});

test("published panel capacity is validated transactionally", () => {
  assert.match(
    migration,
    /create or replace function app\.validate_panel_configuration/
  );
  assert.match(migration, /for update;/);
  assert.match(migration, /published panels require at least one seat section/);
  assert.match(
    migration,
    /panel section capacity total \(%\) must equal location capacity \(%\)/
  );
  assert.match(migration, /deferrable initially deferred/g);
  assert.match(migration, /event_locations_validate_panel_capacity/);
});

test("panels cannot overlap in the same physical location", () => {
  assert.match(
    migration,
    /event_moments_panel_location_no_overlap[\s\S]*exclude using gist/
  );
  assert.match(
    migration,
    /tstzrange\(starts_at, ends_at, '\[\)'\) with &&/
  );
  assert.match(migration, /panel location event scope mismatch/);
});

test("panel publication stays compatible with is_public and is audited", () => {
  assert.match(migration, /new\.is_public := new\.publication_status = 'published'/);
  assert.match(migration, /new\.published_at := now\(\)/);
  assert.match(migration, /new\.published_by := auth\.uid\(\)/);
  assert.match(migration, /'panel\.published'/);
  assert.match(migration, /'panel\.unpublished'/);
  assert.match(migration, /insert into public\.audit_logs/);
});

test("RLS exposes drafts only to operational roles", () => {
  assert.match(migration, /alter table public\.panel_audience_types enable row level security/);
  assert.match(migration, /alter table public\.panel_seat_sections enable row level security/);
  assert.match(
    migration,
    /array\['manager', 'manager_viewer'\]::public\.app_role\[\]/
  );
  assert.match(migration, /app\.is_published_panel\(panel_id\)/);
  assert.match(
    migration,
    /create policy "panel seat sections managers manage"/
  );
  assert.match(
    migration,
    /with check \(app\.has_event_role\(event_id, array\['manager'\]::public\.app_role\[\]\)\)/
  );
});

test("staging seed contains only the approved synthetic P0 fixture", () => {
  assert.match(stagingSeed, /Synthetic P1 fixture for staging only/);
  assert.match(stagingSeed, /'Sala Blu'/);
  assert.match(stagingSeed, /'Sala Verde'/);
  assert.match(stagingSeed, /'Pace e giovani'/);
  assert.match(stagingSeed, /'Dialogo tra generazioni'/);
  assert.match(stagingSeed, /'Citta'' disarmate'/);
  assert.match(stagingSeed, /'registered', 'Iscritti', 'individual'/);
  assert.match(stagingSeed, /'schools', 'Scuole', 'school_booking'/);
  assert.match(stagingSeed, /'guests', 'Ospiti', 'internal_assignment'/);
  assert.doesNotMatch(stagingSeed, /registrationspeace\.santegidio\.org/);
});
