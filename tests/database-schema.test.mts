import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260613120000_initial_schema_and_rls.sql"
);
const participantCodeMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260615103000_add_participant_public_code.sql"
);
const groupMatchingMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260616103000_group_tree_matching.sql"
);
const groupLeaderDashboardMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260616143000_group_leader_dashboard_metadata.sql"
);
const groupTreeSeedMigrationPath = join(
  process.cwd(),
  "supabase/migrations/20260617100000_seed_group_tree_from_model_app.sql"
);

const migration = readFileSync(migrationPath, "utf8");
const participantCodeMigration = readFileSync(participantCodeMigrationPath, "utf8");
const groupMatchingMigration = readFileSync(groupMatchingMigrationPath, "utf8");
const groupLeaderDashboardMigration = readFileSync(
  groupLeaderDashboardMigrationPath,
  "utf8"
);
const groupTreeSeedMigration = readFileSync(groupTreeSeedMigrationPath, "utf8");

const createdTables = Array.from(
  migration.matchAll(/create table public\.([a-z_]+) \(/g),
  (match) => match[1]
);

test("initial database migration enables RLS on every created public table", () => {
  assert.ok(createdTables.length > 0);

  for (const table of createdTables) {
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security;`)
    );
  }
});

test("initial database migration defines policies for every created public table", () => {
  for (const table of createdTables) {
    assert.match(
      migration,
      new RegExp(`on public\\.${table} for `),
      `Missing policy for ${table}`
    );
  }
});

test("initial database migration keeps sensitive tables behind scoped helpers", () => {
  const accessibilityPolicies = Array.from(
    migration.matchAll(
      /create policy "[^"]+"\s+on public\.accessibility_needs[\s\S]*?(?=\ncreate policy|\n$)/g
    ),
    (match) => match[0]
  ).join("\n");

  assert.match(migration, /create or replace function app\.can_read_registration/);
  assert.match(migration, /create or replace function app\.can_manage_registration/);
  assert.match(migration, /create or replace function app\.can_check_in/);
  assert.match(migration, /on public\.accessibility_needs for select/);
  assert.doesNotMatch(accessibilityPolicies, /accoglienza/);
});

test("participant public code migration adds a short generated unique code", () => {
  assert.match(
    participantCodeMigration,
    /add column public_code text/
  );
  assert.match(
    participantCodeMigration,
    /check \(public_code ~ '\^\[A-Z0-9\]\{4\}\$'\)/
  );
  assert.match(
    participantCodeMigration,
    /add constraint participants_public_code_key unique \(public_code\)/
  );
  assert.match(
    participantCodeMigration,
    /create trigger set_participant_public_code/
  );
});

test("group matching migration adds tree metadata and assignment rules", () => {
  assert.match(groupMatchingMigration, /parent_group_id uuid references public\.groups/);
  assert.match(groupMatchingMigration, /node_type text not null default 'group'/);
  assert.match(groupMatchingMigration, /community_kind text not null default 'santegidio'/);
  assert.match(groupMatchingMigration, /age_bracket text not null default 'none'/);
  assert.match(groupMatchingMigration, /create table if not exists public\.group_assignment_rules/);
  assert.match(groupMatchingMigration, /alter table public\.group_assignment_rules enable row level security/);
  assert.match(groupMatchingMigration, /groups public read catalog/);
  assert.match(groupMatchingMigration, /participant_group_assignments_current_unique/);
});

test("group leader dashboard migration stores internal decision metadata", () => {
  assert.match(groupLeaderDashboardMigration, /leader_internal_note text/);
  assert.match(groupLeaderDashboardMigration, /leader_decision_by uuid references auth\.users/);
  assert.match(groupLeaderDashboardMigration, /leader_decision_at timestamptz/);
  assert.match(groupLeaderDashboardMigration, /leader_notification_read_at timestamptz/);
  assert.match(groupLeaderDashboardMigration, /participant_group_assignments_leader_review_idx/);
});

test("model app group tree seed includes Roma areas and primary leaders", () => {
  assert.match(groupTreeSeedMigration, /add column if not exists is_primary boolean/);
  assert.match(groupTreeSeedMigration, /group_memberships_one_primary_per_group_idx/);
  assert.match(groupTreeSeedMigration, /'Monterotondo', 'monterotondo'/);
  assert.match(groupTreeSeedMigration, /'Tivoli', 'tivoli'/);
  assert.match(groupTreeSeedMigration, /'Sezze', 'sezze'/);
  assert.match(groupTreeSeedMigration, /'Universitari', 'giovani', 90, 'Stefano Orlando'/);
  assert.match(
    groupTreeSeedMigration,
    /'Giovani per la pace scuole superiori', 'giovani', 110, 'Laura Guida'/
  );
  assert.match(
    groupTreeSeedMigration,
    /'Giovani per la pace scuole medie', 'giovani', 120, 'Alessandro Natali'/
  );
  assert.match(groupTreeSeedMigration, /'Seminario', 'both'/);
  assert.match(groupTreeSeedMigration, /'Regola seed catalogo gruppi modello app.'/);
});
