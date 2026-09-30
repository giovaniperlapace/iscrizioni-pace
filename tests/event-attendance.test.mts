import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AttendanceReadError, loadEventAttendance } from '../lib/reception/attendance.server.ts';
const event = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const at = '2026-09-30T10:00:00Z';
const row = (id: string, extra = {}) => ({ id, registration_id: id, child_id: null, school_booking_id: null, checked_in_at: at, student_count: null, companion_count: null, registration: { status: 'confirmed', deleted_at: null, cancelled_at: null }, school: null, ...extra });
function database({ roles = [{ role: 'manager', event_id: event }], rows = [row('adult')], authenticated = true, failAt = -1, roleError = false } = {}) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'actor' } : null }, error: null }) },
    from(table: string) {
      const query = {
        select(...args: unknown[]) { calls.push({ table, method: 'select', args }); return query; },
        eq(...args: unknown[]) { calls.push({ table, method: 'eq', args }); return query; },
        is(...args: unknown[]) { calls.push({ table, method: 'is', args }); return query; },
        order(...args: unknown[]) { calls.push({ table, method: 'order', args }); return query; },
        or(...args: unknown[]) { calls.push({ table, method: 'or', args }); return Promise.resolve({ data: roles, error: roleError ? {} : null }); },
        range(start: number, end: number) { calls.push({ table, method: 'range', args: [start, end] }); return Promise.resolve({ data: rows.slice(start, end + 1), error: start === failAt ? {} : null }); },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}
test('event attendance counts adult, individual children and school quantities separately; summary omits identifiers', async () => {
  const rows = [row('adult'), row('child', { registration_id: 'adult', child_id: 'child' }), row('school', { registration_id: null, school_booking_id: 'school', school: { status: 'submitted' }, student_count: 10, companion_count: 2 }), row('cancelled-registration', { registration: { status: 'cancelled', deleted_at: null, cancelled_at: at } }), row('deleted', { registration: { status: 'confirmed', deleted_at: at, cancelled_at: null } }), row('cancelled-school', { registration_id: null, school_booking_id: 'cancelled-school', school: { status: 'cancelled' }, student_count: 10, companion_count: 2 })];
  const { db, calls } = database({ rows });
  const result = await loadEventAttendance(db, event);
  assert.deepEqual(result.totals, { adults: 1, children: 1, students: 10, companions: 2, schoolBookings: 1, people: 14 });
  assert.deepEqual(result.entries, { 'adult:adult': at, 'adult:child': at });
  assert.deepEqual(result.schoolEntries, { school: { checkedInAt: at, students: 10, companions: 2 } });
  const summary = await loadEventAttendance(db, event, true);
  assert.deepEqual(summary.entries, {});
  assert.deepEqual(summary.schoolEntries, {});
  assert.ok(calls.some(c => c.table === 'check_ins' && c.method === 'eq' && c.args[0] === 'event_id' && c.args[1] === event));
  for (const column of ['moment_id', 'cancelled_at']) assert.ok(calls.some(c => c.method === 'is' && c.args[0] === column && c.args[1] === null));
  assert.ok(calls.some(c => c.table === 'event_user_roles' && c.method === 'eq' && c.args[0] === 'user_id' && c.args[1] === 'actor'));
});
test('reads every page beyond 1000 and fails instead of exposing a partial total', async () => {
  const rows = Array.from({ length: 1201 }, (_, i) => row(String(i)));
  assert.equal((await loadEventAttendance(database({ rows }).db, event)).totals.people, 1201);
  await assert.rejects(loadEventAttendance(database({ rows, failAt: 1000 }).db, event), (e: unknown) => e instanceof AttendanceReadError && e.status === 503);
});
test('allows global admin, event manager/viewer; rejects other roles, events, missing session and role read failure', async () => {
  for (const role of [{ role: 'admin', event_id: null }, { role: 'manager_viewer', event_id: event }]) {
    const { db } = database({ roles: [role] as { role: string; event_id: string }[] });
    assert.equal((await loadEventAttendance(db, event)).totals.adults, 1);
  }
  for (const role of ['accoglienza', 'capogruppo', 'partecipante', 'admin']) {
    const { db, calls } = database({ roles: [{ role, event_id: event }] });
    await assert.rejects(loadEventAttendance(db, event), { status: 403 });
    assert.equal(calls.some(c => c.table === 'check_ins'), false);
  }
  await assert.rejects(loadEventAttendance(database({ roles: [{ role: 'manager', event_id: other }] }).db, event), { status: 403 });
  await assert.rejects(loadEventAttendance(database({ authenticated: false }).db, event), { status: 401 });
  await assert.rejects(loadEventAttendance(database({ roleError: true }).db, event), { status: 503 });
  await assert.rejects(loadEventAttendance(database().db, 'invalid'), { status: 400 });
});
test('empty check-ins produce zero, not expected attendance or family size', async () => {
  const result = await loadEventAttendance(database({ rows: [] }).db, event);
  assert.equal(result.totals.people, 0);
  assert.deepEqual(result.entries, {});
});

test('school presence rejects invalid timestamps and quantities instead of implying absence', async () => {
  for (const invalid of [{ checked_in_at: 'invalid' }, { student_count: -1 }, { companion_count: null }]) {
    const rows = [row('school', { registration_id: null, school_booking_id: 'school', school: { status: 'confirmed' }, student_count: 10, companion_count: 2, ...invalid })];
    await assert.rejects(loadEventAttendance(database({ rows }).db, event), { status: 503 });
  }
});
