import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import { loadConfirmedExportPresences } from "../lib/reception/confirmed-presence-export.server.ts";
import { CONFIRMED_PRESENCE_EXPORT_COPY, confirmedPresenceExportText } from "../lib/reception/confirmed-presence-export.ts";
import { writeVisibleParticipantsWorkbook } from "../lib/data-quality/workbook.ts";

function fixture(failure = false) {
  const active = { status: "submitted", deleted_at: null, cancelled_at: null };
  const base = { event_id: "event", moment_id: null, child_id: null, school_booking_id: null, cancelled_at: null, registration: active };
  const rows = Array.from({ length: 205 }, (_, i) => ({ ...base, id: String(i), registration_id: `r${i}` }));
  const extra = [
    { registration_id: "revoked", cancelled_at: "2026-10-24" },
    { registration_id: "child-only", child_id: "child" },
    { registration_id: "forum-only", moment_id: "forum" },
    { registration_id: "foreign", event_id: "other" },
    { registration_id: "deleted", registration: { ...active, deleted_at: "2026-10-24" } },
    { registration_id: "cancelled", registration: { ...active, cancelled_at: "2026-10-24" } },
    { registration_id: "draft", registration: { ...active, status: "draft" } },
    { registration_id: "outside-scope" },
  ].map((row, i) => ({ ...base, id: `extra${i}`, ...row }));
  const scopes: string[][] = [];
  const db = { from(table: string) {
    assert.equal(table, "check_ins");
    let result: Record<string, unknown>[] = [...rows, ...extra];
    const value = (row: Record<string, unknown>, field: string) => field.split(".").reduce<unknown>((v, key) => (v as Record<string, unknown>)[key], row);
    const query = {
      select(columns: string) { assert.match(columns, /!inner/); return query; },
      eq(field: string, expected: unknown) { result = result.filter(row => value(row, field) === expected); return query; },
      is(field: string, expected: unknown) { return query.eq(field, expected); },
      in(field: string, expected: string[]) { if (field === "registration_id") scopes.push(expected); result = result.filter(row => expected.includes(String(value(row, field)))); return query; },
      order() { return query; },
      range(from: number, to: number) { return Promise.resolve(failure ? { data: null, error: { message: "Unavailable" } } : { data: result.slice(from, to + 1), error: null }); },
    };
    return query;
  }} as unknown as SupabaseClient;
  return { db, scopes, ids: [...rows.map(row => row.registration_id), ...extra.slice(0, -1).map(row => row.registration_id)] };
}

test("confirmed export presence includes only current adult event entries across scoped batches", async () => {
  const { db, scopes, ids } = fixture();
  const result = await loadConfirmedExportPresences(db, "event", ids);
  assert.equal(result.size, 205);
  assert.ok(result.has("r204"));
  for (const id of ids.slice(205)) assert.equal(result.has(id), false, id);
  assert.equal(result.has("outside-scope"), false);
  assert.equal(scopes.length, 3);
  assert.ok(scopes.every(scope => scope.length <= 100));
});

test("presence read failure blocks the export and empty scopes do not query", async () => {
  const { db, scopes } = fixture(true);
  assert.equal((await loadConfirmedExportPresences(db, "event", [])).size, 0);
  assert.equal(scopes.length, 0);
  await assert.rejects(loadConfirmedExportPresences(db, "event", ["r1"]), /Presenze confermate non disponibili/);
});

test("name-only Excel always includes confirmed presence distinct from declared attendance", async () => {
  const people = [
    { name: "Badge", confirmedPresence: true, attendance: [{ day: "2026-10-25", choice: "no" }] },
    { name: "Declared only", confirmedPresence: false, attendance: [{ day: "2026-10-25", choice: "yes" }] },
  ];
  const buffer = await writeVisibleParticipantsWorkbook(people as never, { services: [], tags: [], groups: [] }, ["name"], null);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(buffer as never);
  const sheet = book.worksheets[0];
  assert.equal(sheet.getCell("D1").value, CONFIRMED_PRESENCE_EXPORT_COPY.it.header);
  assert.equal(sheet.getCell("D2").value, "Sì");
  assert.equal(sheet.getCell("D3").value, "No");
  for (const locale of Object.keys(CONFIRMED_PRESENCE_EXPORT_COPY) as (keyof typeof CONFIRMED_PRESENCE_EXPORT_COPY)[]) {
    assert.ok(CONFIRMED_PRESENCE_EXPORT_COPY[locale].header);
    assert.notEqual(confirmedPresenceExportText(true, locale), confirmedPresenceExportText(false, locale));
  }
});
