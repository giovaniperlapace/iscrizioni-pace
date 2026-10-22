import assert from "node:assert/strict";
import test from "node:test";
import { loadOperationsParticipantPage, usesServerParticipantPage, type OperationsPageRequest } from "../lib/registrations/operations-page.server.ts";
import { loadQuestionnaireSummaries } from "../lib/registrations/questionnaire-summary.server.ts";
import { parseOperationsDashboardFilters } from "../lib/registrations/operations-dashboard.ts";
import { operationsPageDatabase, fixtureId } from "./fixtures/operations-page.ts";
import { loadAllRowsConcurrently } from "../lib/supabase/all-rows.ts";
import { sortOperationsParticipants, participantSortValue } from "../lib/registrations/operations-sort.ts";
import { PARTICIPANT_COLUMNS, parseTablePreferences } from "../lib/registrations/operations-table.ts";

const request = (params: Record<string, string> = {}, changes: Partial<OperationsPageRequest> = {}): OperationsPageRequest => ({
  event: { id: "event", title: "Fixture event", starts_on: "2026-10-25" },
  actorId: "actor", canManage: true, dashboard: "admin", locale: "it",
  params, filters: parseOperationsDashboardFilters(params), ...changes,
});

test("server page covers 5005 registrations; full totals and children, only 100 detailed rows", async () => {
  const { db, calls } = operationsPageDatabase();
  const snapshot = await loadOperationsParticipantPage(db, request({ participantPage: "50" }));
  assert.equal(snapshot.serverPage?.total, 5005);
  assert.equal(snapshot.serverPage?.childrenCount, 715);
  assert.equal(snapshot.serverPage?.pageCount, 51);
  assert.equal(snapshot.participants.length, 100);
  assert.equal(snapshot.participants[0].name, "Anna Test 4900");
  assert.equal(snapshot.participants.at(-1)?.name, "Anna Test 4999");
  assert.equal(snapshot.allParticipants.length, 100);
  assert.equal(snapshot.participants[0].children[0].last_name, "Prova 4900");
  for (const call of calls.filter(call => call.ids)) assert.ok(call.ids!.length <= 100);
  const indexCalls = calls.filter(call => call.table === "registrations");
  assert.ok(indexCalls.every(call => call.filters.some(([key, value]) => key === "event_id" && value === "event")));
  assert.ok(indexCalls.every(call => call.filters.some(([key, value]) => key === "participants.participant_event_services.event_id" && value === "event")));
  const last = await loadOperationsParticipantPage(db, request({ participantPage: "999" }));
  assert.equal(last.serverPage?.page, 51); assert.equal(last.participants.length, 5);
  assert.equal(last.participants.at(-1)?.name, "Anna Test 5004");
});

test("search, combined filters and sort apply globally before taking a page", async () => {
  const { db } = operationsPageDatabase();
  const one = await loadOperationsParticipantPage(db, request({ q: "P5004", contact: "fixture5004@", group: "group", service: "service" }));
  assert.equal(one.serverPage?.total, 1); assert.equal(one.participants[0].registrationId, fixtureId(5004));
  assert.equal(one.participants[0].service?.participantNote, "Nota conservata");
  const combined = await loadOperationsParticipantPage(db, request({ q: "Roma", group: "group", service: "service", tag: "tag", participantPage: "2", direction: "desc" }));
  assert.equal(combined.serverPage?.total, 167);
  assert.equal(combined.participants.length, 67);
  assert.equal(combined.participants[0].name, "Anna Test 1980");
  const none = await loadOperationsParticipantPage(db, request({ q: "not found", participantPage: "30" }));
  assert.equal(none.serverPage?.total, 0); assert.equal(none.serverPage?.page, 1); assert.equal(none.participants.length, 0);
  const without = await loadOperationsParticipantPage(db, request({ view: "without-group", participantPage: "26" }));
  assert.equal(without.serverPage?.total, 2502); assert.equal(without.participants.length, 2);
  assert.ok(without.participants.every(row => row.currentGroupId === null));
});

test("direct off-page sheet is authorized by the event index and does not replace page rows", async () => {
  const { db } = operationsPageDatabase();
  const snapshot = await loadOperationsParticipantPage(db, request({ q: "P1001", edit: fixtureId(5004) }));
  assert.equal(snapshot.participants.length, 1); assert.equal(snapshot.allParticipants.length, 2);
  assert.equal(snapshot.allParticipants[1].registrationId, fixtureId(5004));
  const foreign = await loadOperationsParticipantPage(db, request({ edit: fixtureId(9999) }));
  assert.equal(foreign.allParticipants.length, 100);
});

test("other events and deleted rows never enter the active page; shrinking pages stay valid", async () => {
  const { db, tables } = operationsPageDatabase(101);
  tables.registrations.push({ ...structuredClone(tables.registrations[0]), id: "foreign", event_id: "other" });
  tables.registrations[100].deleted_at = "2026-10-17";
  const active = await loadOperationsParticipantPage(db, request({ participantPage: "2", edit: "foreign" }));
  assert.equal(active.serverPage?.total, 100); assert.equal(active.serverPage?.page, 1);
  assert.equal(active.allParticipants.length, 100);
  const deleted = await loadOperationsParticipantPage(db, request({ view: "deleted" }));
  assert.deepEqual(deleted.participants.map(row => row.registrationId), [fixtureId(100)]);
  const viewer = await loadOperationsParticipantPage(db, request({ view: "deleted" }, { dashboard: "manager", canManage: false }));
  assert.equal(viewer.serverPage?.total, 100); assert.ok(viewer.participants.every(row => !row.deletedAt));
});

test("optional sort keys are global; internal data read only for an authorized selected column", async () => {
  const { db, rpcCalls } = operationsPageDatabase(1203);
  const associations = await loadOperationsParticipantPage(db, request({ sort: "association" }));
  assert.equal(associations.participants[0].name, "Anna Test 1202");
  assert.equal(rpcCalls.length, 0);
  const viewer = await loadOperationsParticipantPage(db, request({ sort: "sex", columns: "name,sex" }, { canManage: false, dashboard: "manager" }));
  assert.equal(viewer.serverPage?.sort, "name"); assert.equal(rpcCalls.length, 0);
  await loadOperationsParticipantPage(db, request({ sort: "sex", columns: "name,sex", view: "without-group" }));
  assert.equal(rpcCalls.length, 0, "the fixed without-group columns never include internal sex");
  const sexes = await loadOperationsParticipantPage(db, request({ sort: "sex", columns: "name,sex", participantPage: "7" }));
  assert.equal(sexes.participants[0].registrationId, fixtureId(1201));
  assert.equal(rpcCalls.flat().length, 1203);
  assert.ok(!JSON.stringify(sexes).includes('"female"'));
});

test("merged questionnaire projections preserve cleared latest fields and historical delegation", async () => {
  const { db, tables, calls } = operationsPageDatabase(1);
  tables.registration_questionnaire_answers = [
    { id: "new", registration_id: fixtureId(0), created_at: "2026-10-02", nationality: null, association: "  ", source: "public", has_email: true },
    { id: "old", registration_id: fixtureId(0), created_at: "2026-10-01", nationality: "French", association: "Old", source: "capogruppo_manual", use_leader_email: true },
  ];
  const result = await loadQuestionnaireSummaries(db, [fixtureId(0), fixtureId(0)]);
  assert.equal(result.nationalities.get(fixtureId(0)), null);
  assert.equal(result.associations.get(fixtureId(0)), null);
  assert.ok(result.emailDelegations.has(fixtureId(0)));
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].select.includes('answers,'));
});

test("late read errors reject the entire page; global-purpose views never use the page loader", async () => {
  for (const table of ["registrations", "registration_questionnaire_answers", "registration_children"]) {
    const fixture = operationsPageDatabase(1203);
    fixture.failWhen((target, from) => target === table && (table !== "registrations" || from >= 1000));
    await assert.rejects(loadOperationsParticipantPage(fixture.db, request()), /Synthetic read failure/);
  }
  for (const params of [{ stat: "age:18" }, { view: "children" }, { view: "duplicates" }, { view: "schools" }]) assert.equal(usesServerParticipantPage(params), false);
});

test("bounded concurrent pages have no threshold at 5000/5005, preserve order and reject gaps", async () => {
  for (const count of [0, 500, 1000, 5000, 5005]) {
    const rows = Array.from({ length: count }, (_, i) => i);
    let active = 0, peak = 0;
    const result = await loadAllRowsConcurrently(async (from, to) => {
      active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, from % 2 ? 0 : 1)); active--;
      return { data: rows.slice(from, to + 1), error: null };
    });
    assert.deepEqual(result.data, rows); assert.ok(peak <= 3);
  }
  await assert.rejects(loadAllRowsConcurrently(async from => ({ data: from === 0 ? [] : [1], error: null })), /changed/);
});

test("shared comparator matches previous per-comparison Italian collation for every column", async () => {
  const { db } = operationsPageDatabase(30);
  const { participants } = await loadOperationsParticipantPage(db, request());
  participants[0].name = "Ànna Test 10"; participants[1].name = "anna test 2"; participants[2].email = null;
  for (const column of Object.keys(PARTICIPANT_COLUMNS)) for (const direction of ["asc", "desc"]) {
    const preferences = parseTablePreferences({ sort: column, direction });
    const old = [...participants].sort((a, b) => {
      const av = participantSortValue(a, preferences.sort, "2026-10-25", "it"), bv = participantSortValue(b, preferences.sort, "2026-10-25", "it");
      if (av === null || bv === null) return av === bv ? a.registrationId.localeCompare(b.registrationId) : av === null ? 1 : -1;
      const compare = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "it", { numeric: true, sensitivity: "base" });
      return (direction === "asc" ? compare : -compare) || a.registrationId.localeCompare(b.registrationId);
    });
    assert.deepEqual(sortOperationsParticipants(participants, preferences, "2026-10-25", "it"), old, `${column}/${direction}`);
  }
});

test("ceremony directory prioritizes the exact declared slot globally and retains undeclared attendees", async () => {
  const { db, tables } = operationsPageDatabase(1203);
  tables.event_attendance_choices.push({ id: 'priority', registration_id: fixtureId(1202), day: '2026-10-25', day_part: 'afternoon', choice: 'yes' });
  tables.event_attendance_choices.push({ id: 'unknown-other-day', registration_id: fixtureId(1202), day: '2026-10-26', day_part: 'morning', choice: 'unknown' });
  tables.registrations[0].status = 'cancelled';
  const options = { activeRegistrationsOnly: true, priorityAttendanceSlot: {day:'2026-10-25',part:'afternoon'} };
  const first = await loadOperationsParticipantPage(db, request({}, options));
  assert.equal(first.serverPage?.total,1202);
  assert.equal(first.participants[0].registrationId,fixtureId(1202));
  assert.equal(first.participants[1].registrationId,fixtureId(1));
  assert.equal(first.participants.length,100);
  const second = await loadOperationsParticipantPage(db, request({participantPage:'2'},options));
  assert.equal(second.participants[0].registrationId,fixtureId(100));
  const filtered = await loadOperationsParticipantPage(db, request({q:'P1201'}, options));
  assert.equal(filtered.participants[0].registrationId,fixtureId(1201));
  assert.equal(filtered.serverPage?.total,1);
});
