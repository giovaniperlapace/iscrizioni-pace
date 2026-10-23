import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPanelRoster, isPanelRosterId } from "../lib/panels/panel-roster.server.ts";
import { writePanelRosterWorkbook } from "../lib/panels/panel-roster-workbook.ts";
import { canViewPanelData } from "../lib/panels/management-access.ts";

const panelId = "11111111-1111-4111-8111-111111111111";
const admin = [{ role: "admin" as const, eventId: null }];
type Row = Record<string, unknown>;
function fixture(overrides: Record<string, Row[]> = {}, failure = "", failFrom = 0) {
  const tables: Record<string, Row[]> = {
    events: [{ id: "event", is_current: true }],
    event_moments: [{ id: panelId, event_id: "event", moment_type: "panel", title: "Dialogo sintetico" }],
    panel_audience_types: [{ id: "i", event_id: "event", name: "Iscritti", booking_channel: "individual" }, { id: "g", event_id: "event", name: "Ospiti", booking_channel: "internal_assignment" }],
    panel_seat_sections: [{ id: "seats", event_id: "event", panel_id: panelId, audience_type_id: "i", capacity: 355 }, { id: "guests", event_id: "event", panel_id: panelId, audience_type_id: "g", capacity: 20 }],
    moment_attendance_choices: [{ id: "choice", moment_id: panelId, registration_id: "r", seat_section_id: "seats", choice: "yes" }],
    registrations: [{ id: "r", event_id: "event", participant_id: "p", status: "submitted", deleted_at: null }],
    participants: [{ id: "p", first_name: "Anna", last_name: "Bianchi", public_code: "FIX1" }],
    panel_child_selections: [{panel_id: panelId, registration_id: "r", child_ids: ["child"]}],
    registration_children: [{ id: "child", registration_id: "r", first_name: "Luca", last_name: "Bianchi", position: 1 }],
    school_panel_reservations: [{ id: "reservation", event_id: "event", panel_id: panelId, booking_id: "b", status: "reserved", student_count: 12, companion_count: 2 }],
    school_bookings: [{ id: "b", event_id: "event", status: "confirmed", school_name: "Scuola sintetica", school_city: "Roma", class_description: "Classe A", student_count: 99, companion_count: 9 }],
    ...overrides,
  };
  const reads: string[] = [];
  const pages: { table: string; from: number }[] = [];
  const db = { from(table: string) {
    reads.push(table); let rows = [...(tables[table] ?? [])];
    const result = (data: unknown, from = 0) => ({ data, error: table === failure && from >= failFrom ? { message: "synthetic failure" } : null });
    const query = {
      select() { return query; }, order() { return query; },
      eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return query; },
      is(key: string, value: unknown) { return query.eq(key, value); },
      neq(key: string, value: unknown) { rows = rows.filter(row => row[key] !== value); return query; },
      in(key: string, values: unknown[]) { rows = rows.filter(row => values.includes(row[key])); return query; },
      async maybeSingle() { return result(rows[0] ?? null); },
      async range(from: number, to: number) { pages.push({ table, from }); return result(rows.slice(from, to + 1), from); },
    }; return query;
  } } as unknown as SupabaseClient;
  return { db, reads, pages };
}

test("panel roster rejects unauthorized roles and invalid IDs before data reads", async () => {
  await assert.rejects(loadPanelRoster(fixture().db, panelId, []));
  for (const role of ["capogruppo", "accoglienza"] as const) {
    const h = fixture();
    await assert.rejects(loadPanelRoster(h.db, panelId, [{ role, eventId: "event" }]));
    assert.deepEqual(h.reads, []);
  }
  const h = fixture();
  assert.equal(await loadPanelRoster(h.db, "invalid", admin), null);
  assert.deepEqual(h.reads, []);
  const missingScopes: Record<string, Row[]>[] = [{ events: [] }, { event_moments: [] }, { event_moments: [{ id: panelId, event_id: "other", moment_type: "panel" }] }];
  for (const overrides of missingScopes) {
    const missing = fixture(overrides);
    assert.equal(await loadPanelRoster(missing.db, panelId, admin), null);
    assert.ok(!missing.reads.includes("registrations"));
  }
});

test("roster includes no-email people and children, uses panel-specific school quantities and keeps guests separate", async () => {
  const h = fixture();
  const roster = await loadPanelRoster(h.db, panelId, [...admin, { role: "manager", eventId: "event" }]);
  assert.ok(roster);
  assert.equal(roster.individualSeats, 2);
  assert.equal(roster.people[1].accompanyingAdult, "Anna Bianchi");
  assert.equal(roster.people[1].kind, "Minore accompagnato");
  assert.equal(roster.schoolSeats, 14);
  assert.equal(roster.reservedGuestSeats, 20);
  assert.equal(roster.people.length, 2);
  assert.ok(h.reads.every(table => !/qr|contact|profile|email|audit/.test(table)));
  for (const registration of [
    { id: "r", event_id: "event", participant_id: "p", status: "cancelled", deleted_at: null },
    { id: "r", event_id: "event", participant_id: "p", status: "submitted", deleted_at: "deleted" },
    { id: "r", event_id: "other", participant_id: "p", status: "submitted", deleted_at: null },
  ]) {
    assert.equal((await loadPanelRoster(fixture({ registrations: [registration] }).db, panelId, admin))?.individualSeats, 0);
  }
  assert.equal((await loadPanelRoster(fixture({ school_bookings: [{ id: "b", event_id: "event", status: "cancelled" }] }).db, panelId, admin))?.schoolSeats, 0);
  assert.equal((await loadPanelRoster(fixture({ moment_attendance_choices: [], school_panel_reservations: [] }).db, panelId, admin))?.individualSeats, 0);
});

test("all roster reads fail closed, including missing identities", async () => {
  for (const table of ["events", "event_moments", "moment_attendance_choices", "school_panel_reservations", "panel_seat_sections", "panel_audience_types", "registrations", "school_bookings", "participants", "registration_children", "panel_child_selections", "panel_waitlist"]) {
    await assert.rejects(loadPanelRoster(fixture({}, table).db, panelId, admin), table);
  }
  await assert.rejects(loadPanelRoster(fixture({ participants: [] }).db, panelId, admin), /Incomplete/);
});

test("roster pages beyond 1000 people and refuses an incomplete last page", async () => {
  const ids = Array.from({ length: 1205 }, (_, i) => String(i));
  const overrides = {
    moment_attendance_choices: ids.map(id => ({ id, moment_id: panelId, registration_id: id, seat_section_id: "seats", choice: "yes" })),
    registrations: ids.map(id => ({ id, event_id: "event", participant_id: id, status: "confirmed", deleted_at: null })),
    participants: ids.map(id => ({ id, first_name: "Persona", last_name: id, public_code: id })),
    registration_children: [],
  };
  const h = fixture(overrides);
  assert.equal((await loadPanelRoster(h.db, panelId, admin))?.individualSeats, 1205);
  assert.ok(h.pages.some(page => page.table === "moment_attendance_choices" && page.from === 1000));
  await assert.rejects(loadPanelRoster(fixture(overrides, "moment_attendance_choices", 1000).db, panelId, admin));
});

test("Excel contains five sheets, one row per person, numeric seats and literal names", async () => {
  const roster = (await loadPanelRoster(fixture().db, panelId, admin))!;
  roster.people[0].firstName = "=SYNTHETIC()";
  const buffer = await writePanelRosterWorkbook(roster);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  assert.deepEqual(book.worksheets.map(sheet => sheet.name), ["Riepilogo", "Partecipanti", "Lista attesa", "Scuole", "Ospiti riservati"]);
  assert.equal(book.getWorksheet("Partecipanti")!.rowCount, 3);
  assert.equal(book.getWorksheet("Partecipanti")!.getCell("A2").value, "=SYNTHETIC()");
  assert.equal(book.getWorksheet("Partecipanti")!.getCell("F3").value, 1);
  assert.equal(book.getWorksheet("Scuole")!.getCell("F2").value, 14);
  assert.equal(book.getWorksheet("Ospiti riservati")!.getCell("B2").value, 20);
});

test("real export GET denies forged direct requests before service access and returns a private workbook", async () => {
  const js = ts.transpileModule(readFileSync("app/dashboard/admin/panel-iscritti/export/route.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const roster = (await loadPanelRoster(fixture().db, panelId, admin))!;
  for (const [roles, id, status] of [[null, panelId, 401], [[], panelId, 403], [[{ role: "manager", eventId: "event" }], panelId, 200], [[{ role: "manager_viewer", eventId: "event" }], panelId, 200], [[{ role: "manager", eventId: "other" }], panelId, 403], [admin, "invalid", 400], [admin, panelId, 404], [admin, panelId, 500], [admin, panelId, 200]] as const) {
    let reads = 0;
    const deps: Record<string, unknown> = {
      "@/lib/auth/session": { getCurrentAuthContext: async () => roles === null ? null : { eventRoles: roles } },
      "@/lib/supabase/server": { createSupabaseServerClient: async () => ({}) },
      "@/lib/supabase/service": { createSupabaseServiceClient: () => { reads++; return {}; } },
      "@/lib/panels/management-access": { canViewPanelData },
      "@/lib/panels/panel-roster.server": { isPanelRosterId, loadPanelRoster: async () => {
        if (roles?.some(role => role.role === "manager" && role.eventId === "other")) throw new Error("Panel roster forbidden");
        if (status === 500) throw new Error("Synthetic query failure");
        return status === 404 ? null : roster;
      } },
      "@/lib/panels/panel-roster-workbook": { writePanelRosterWorkbook },
    };
    const exports: { GET?: (request: Request) => Promise<Response> } = {};
    new Function("require", "exports", js)((name: string) => { assert.ok(name in deps); return deps[name]; }, exports);
    const response = await exports.GET!(new Request(`https://example.invalid/dashboard/admin/panel-iscritti/export?panelId=${id}`));
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(reads, [200, 404, 500].includes(status) || roles?.some(role => role.role === "manager" && role.eventId === "other") ? 1 : 0);
    if (status !== 200) assert.ok(!response.headers.get("content-disposition"));
    if (status === 200) {
      assert.ok(response.headers.get("content-type")?.includes("spreadsheetml"));
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(Buffer.from(await response.arrayBuffer()) as unknown as ExcelJS.Buffer);
      assert.equal(book.getWorksheet("Partecipanti")!.rowCount, 3);
    }
  }
});


test("manager roster matches admin, foreign event denied before participant reads", async () => {
  const expected = await loadPanelRoster(fixture().db, panelId, admin);
  assert.deepEqual(await loadPanelRoster(fixture().db, panelId, [{role: "manager", eventId: "event"}]), expected);
  assert.deepEqual(await loadPanelRoster(fixture().db, panelId, [{role: "manager_viewer", eventId: "event"}]), expected);
  assert.deepEqual(await loadPanelRoster(fixture().db, panelId, [{role: "manager", eventId: "other"}, {role: "manager_viewer", eventId: "event"}]), expected);
  for (const roles of [
    [{role: "manager" as const, eventId: "other"}],
    [{role: "manager_viewer" as const, eventId: "other"}],
  ]) {
    const h = fixture();
    await assert.rejects(loadPanelRoster(h.db, panelId, roles), /forbidden/);
    assert.deepEqual(h.reads, ["events"]);
  }
});


test("Forum roster and export exclude unselected linked children", async () => {
  const roster = await loadPanelRoster(fixture({panel_child_selections: []}).db, panelId, admin);
  assert.equal(roster!.individualSeats, 1);
  assert.deepEqual(roster!.people.map(person => person.id), ["r"]);
});

test("roster includes active waiting families and offers, preserves FIFO and confirmed totals, exports separate sheet", async () => {
  const statuses = ["waiting", "offered", "expired", "cancelled", "accepted", "offered", "waiting", "waiting"];
  const queue = statuses.map((status, i) => ({id: `q${i}`, event_id: "event", panel_id: panelId, section_id: "seats", registration_id: `w${i}`, status, sequence: 20 - i, expires_at: i === 5 ? "2020-01-01T00:00:00Z" : "2099-01-01T00:00:00Z"}));
  const overrides = {
    panel_waitlist: [...queue, {...queue[0], registration_id: "r"}, {...queue[0], registration_id: "foreign", event_id: "other"}, {...queue[0], registration_id: "other-panel", panel_id: "other"}],
    registrations: [{id: "r", event_id: "event", participant_id: "p", status: "submitted", deleted_at: null}, ...statuses.map((_, i) => ({id: `w${i}`, event_id: "event", participant_id: `wp${i}`, status: i === 6 ? "cancelled" : "submitted", deleted_at: i === 7 ? "2026-01-01" : null}))],
    participants: [{id: "p", first_name: "Anna", last_name: "Bianchi", public_code: "FIX1"}, ...statuses.map((_, i) => ({id: `wp${i}`, first_name: `Attesa${i}`, last_name: "Persona", public_code: ""}))],
    panel_child_selections: [{panel_id: panelId, registration_id: "w0", child_ids: ["wc"]}],
    registration_children: [{id: "wc", registration_id: "w0", first_name: "Minore", last_name: "Scelto", position: 1}, {id: "excluded", registration_id: "w0", first_name: "Non", last_name: "Scelto", position: 2}],
  };
  const roster = (await loadPanelRoster(fixture(overrides).db, panelId, [{role: "manager", eventId: "event"}]))!;
  assert.equal(roster.individualSeats, 1);
  assert.deepEqual(roster.people.map(row => row.id), ["r"]);
  assert.deepEqual(roster.waitlist.map(row => [row.id, row.status]), [["w1", "offered"], ["w0", "waiting"], ["wc", "waiting"]]);
  assert.equal(roster.waitlist[2].accompanyingAdult, "Attesa0 Persona");
  assert.equal(roster.waitlist[1].expiresAt, null);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await writePanelRosterWorkbook(roster) as unknown as ExcelJS.Buffer);
  assert.equal(book.getWorksheet("Partecipanti")!.rowCount, 2);
  const sheet = book.getWorksheet("Lista attesa")!;
  assert.equal(sheet.rowCount, 4);
  assert.equal(sheet.getCell("F2").value, "Posto offerto da confermare");
  assert.equal(sheet.getCell("F4").value, "In lista d’attesa");
});

test("waiting roster loads over 1000 requests and fails on a missing final page", async () => {
  const ids = Array.from({length: 1003}, (_, i) => `q${i}`);
  const overrides = {
    moment_attendance_choices: [],
    panel_waitlist: ids.map((id, sequence) => ({id, event_id: "event", panel_id: panelId, registration_id: id, section_id: "seats", status: "waiting", sequence, expires_at: null})),
    registrations: ids.map(id => ({id, event_id: "event", participant_id: id, status: "submitted", deleted_at: null})),
    participants: ids.map(id => ({id, first_name: "Persona", last_name: id, public_code: ""})),
  };
  const h = fixture(overrides);
  const roster = (await loadPanelRoster(h.db, panelId, admin))!;
  assert.equal(roster.individualSeats, 0);
  assert.equal(roster.waitlist.length, 1003);
  assert.ok(h.pages.some(page => page.table === "panel_waitlist" && page.from === 1000));
  await assert.rejects(loadPanelRoster(fixture(overrides, "panel_waitlist", 1000).db, panelId, admin));
});
