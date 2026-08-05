import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const migration = await readFile(join(process.cwd(), "supabase/migrations/20260806160000_school_panel_bookings.sql"), "utf8");
const actions = await readFile(join(process.cwd(), "app/actions.ts"), "utf8");
const component = await readFile(join(process.cwd(), "app/dashboard/school-bookings-section.tsx"), "utf8");

test("P7 keeps school identities and bookings separate from participants", () => {
  assert.match(migration, /create table public\.school_booking_teachers/);
  assert.match(migration, /create table public\.school_bookings/);
  assert.match(migration, /create table public\.school_panel_reservations/);
  assert.doesNotMatch(migration, /insert into public\.(participants|registrations)/);
  assert.match(migration, /unique \(event_id, email\)/);
});

test("P7 reserves only school sections atomically and blocks overlap", () => {
  assert.match(migration, /create or replace function public\.save_school_booking/);
  assert.match(migration, /audience\.booking_channel = 'school_booking'/);
  assert.match(migration, /for update/);
  assert.match(migration, /app\.validate_panel_section_booking_capacity/);
  assert.match(migration, /create or replace function app\.validate_school_booking_overlaps/);
  assert.match(migration, /using errcode = '23P01'/);
  assert.match(migration, /create or replace function public\.cancel_school_booking/);
});

test("P7 uses verified session email ownership and preserves viewer read-only access", () => {
  assert.match(migration, /auth\.jwt\(\) ->> 'email'/);
  assert.match(migration, /app\.owns_school_booking/);
  assert.match(migration, /array\['manager', 'manager_viewer'\]::public\.app_role\[\]/);
  assert.match(migration, /array\['manager'\]::public\.app_role\[\]/);
  assert.doesNotMatch(migration, /grant (insert|update|delete).*school_bookings.*authenticated/);
});

test("P7 creates an opaque group QR without exposing teacher or school data", () => {
  assert.match(migration, /create table public\.school_booking_qr_tokens/);
  assert.match(migration, /token_hash text not null unique/);
  assert.match(migration, /token_encrypted text not null/);
  assert.match(actions, /createOpaqueQrToken\(\)/);
  assert.match(actions, /encryptQrToken\(qrToken\.token\)/);
  const qrTable = migration.match(/create table public\.school_booking_qr_tokens \([\s\S]*?\n\);/)?.[0] ?? "";
  assert.doesNotMatch(qrTable, /teacher|email|phone|school_name|class_description/i);
});

test("P7 exposes shared manager and admin school backoffice controls", () => {
  assert.match(component, /Prenotazioni scuole/);
  assert.match(component, /Scuola \/ classe/);
  assert.match(component, /Docente/);
  assert.match(component, /Panel/);
  assert.match(component, /Quantità/);
  assert.match(component, /Vista in sola lettura/);
  assert.match(actions, /supabase\.rpc\("save_school_booking"/);
  assert.match(actions, /supabase\.rpc\("cancel_school_booking"/);
});
