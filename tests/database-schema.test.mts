import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20260613120000_initial_schema_and_rls.sql"
);

const migration = readFileSync(migrationPath, "utf8");

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
