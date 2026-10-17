import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { EventAttendanceStore, ATTENDANCE_RECONCILE_MS } from '../lib/reception/attendance-store.ts';
import { notifyEventAttendanceChanged } from '../lib/reception/attendance-events.ts';
import { ReceptionStationSession } from '../lib/reception/station.ts';
import type { ReceptionResult } from '../lib/reception/contracts.ts';

const eventId = '11111111-1111-4111-8111-111111111111';
const at = '2026-10-17T10:00:00Z';
const snapshot = (entered = false) => ({ eventId, updatedAt: new Date().toISOString(),
  entries: entered ? { [`${eventId}:adult`]: at } : {},
  schoolEntries: { school: { checkedInAt: at, students: 10, companions: 2 } },
  totals: { adults: entered ? 1 : 0, children: 0, students: 10, companions: 2, schoolBookings: 1, people: entered ? 13 : 12 },
});
function setup(t: TestContext, fetcher: typeof fetch = async () => Response.json(snapshot())) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse(at) });
  const win = new EventTarget();
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const restore: (() => void)[] = [];
  for (const [key, value] of Object.entries({ window: win, document: doc, BroadcastChannel: undefined })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    restore.push(() => { if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key); });
  }
  const read = t.mock.method(globalThis, 'fetch', fetcher);
  const store = new EventAttendanceStore(eventId);
  const stop = store.start();
  t.after(() => { stop(); restore.forEach(reset => reset()); });
  return { store, stop, read, win, doc };
}

test('reconciles every fifteen minutes; manual and saved changes refresh without ten-second polling', async t => {
  const { store, read } = setup(t);
  await setImmediate();
  assert.equal(read.mock.callCount(), 1);
  t.mock.timers.tick(10_000); await setImmediate();
  assert.equal(read.mock.callCount(), 1);
  t.mock.timers.tick(290_000); await setImmediate();
  assert.equal(read.mock.callCount(), 1, 'no reconciliation at the former five-minute interval');
  t.mock.timers.tick(599_999); await setImmediate();
  assert.equal(read.mock.callCount(), 1);
  t.mock.timers.tick(1); await setImmediate();
  assert.equal(read.mock.callCount(), 2);
  const previous = store.snapshot().data;
  store.refresh(); store.refresh();
  assert.equal(store.snapshot().data, previous, 'no blanking while a refresh is in progress');
  await setImmediate();
  assert.equal(read.mock.callCount(), 3, 'concurrent clicks coalesce');
  assert.equal(store.snapshot().data?.schoolEntries.school, previous?.schoolEntries.school, 'unchanged schools preserve their selector identity');
  notifyEventAttendanceChanged(); await setImmediate();
  assert.equal(read.mock.callCount(), 4);
});

test('hidden tabs do not read; return catches up and rapid focus events do not repeat work', async t => {
  const { read, win, doc } = setup(t);
  await setImmediate();
  win.dispatchEvent(new Event('focus'));
  assert.equal(read.mock.callCount(), 1);
  doc.hidden = true;
  notifyEventAttendanceChanged();
  t.mock.timers.tick(ATTENDANCE_RECONCILE_MS); await setImmediate();
  assert.equal(read.mock.callCount(), 1);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  win.dispatchEvent(new Event('focus')); await setImmediate();
  assert.equal(read.mock.callCount(), 2);
  win.dispatchEvent(new Event('focus')); await setImmediate();
  assert.equal(read.mock.callCount(), 2);
  t.mock.timers.tick(60_000); win.dispatchEvent(new Event('focus')); await setImmediate();
  assert.equal(read.mock.callCount(), 3);
  win.dispatchEvent(new Event('online')); await setImmediate();
  assert.equal(read.mock.callCount(), 4);
});

test('a save during a read discards the stale response and queues exactly one fresh read', async t => {
  const pending: ((response: Response) => void)[] = [];
  const { store, read } = setup(t, () => new Promise(resolve => pending.push(resolve)));
  notifyEventAttendanceChanged(); notifyEventAttendanceChanged();
  assert.equal(read.mock.callCount(), 1);
  pending.shift()!(Response.json(snapshot(false))); await setImmediate();
  assert.equal(store.snapshot().data, null, 'pre-save absence is never published');
  assert.equal(read.mock.callCount(), 2);
  pending.shift()!(Response.json(snapshot(true))); await setImmediate();
  assert.equal(store.snapshot().data?.entries[`${eventId}:adult`], at);
  assert.equal(read.mock.callCount(), 2);
});

test('errors never imply absence; access revocation clears data and stops automatic retries', async t => {
  let status = 200;
  const { store, read, win } = setup(t, async () => status === 200 ? Response.json(snapshot(true)) : new Response('{}', { status }));
  await setImmediate();
  status = 503; store.refresh(); await setImmediate();
  assert.equal(store.snapshot().data, null);
  assert.equal(store.snapshot().error, true);
  status = 200; store.refresh(); await setImmediate();
  assert.equal(store.snapshot().error, false);
  status = 403; store.refresh(); await setImmediate();
  assert.equal(store.snapshot().data, null);
  const count = read.mock.callCount();
  t.mock.timers.tick(ATTENDANCE_RECONCILE_MS); win.dispatchEvent(new Event('online'));
  notifyEventAttendanceChanged(); await setImmediate();
  assert.equal(read.mock.callCount(), count);
  status = 200; store.refresh(); await setImmediate();
  assert.equal(store.snapshot().error, false);
});

test('cleanup aborts requests, ignores late responses and removes timers and listeners', async t => {
  let finish!: (response: Response) => void;
  const { store, stop, read } = setup(t, () => new Promise(resolve => { finish = resolve; }));
  const signal = read.mock.calls[0].arguments[1]?.signal;
  stop();
  assert.equal(signal?.aborted, true);
  finish(Response.json(snapshot(true))); await setImmediate();
  assert.equal(store.snapshot().data, null);
  notifyEventAttendanceChanged(); t.mock.timers.tick(ATTENDANCE_RECONCILE_MS);
  assert.equal(read.mock.callCount(), 1);
});

test('event entry and removal notify only after success; inspection, failures and panel writes do not', async t => {
  const { read } = setup(t);
  await setImmediate();
  let fail = false;
  const result: ReceptionResult = { status: 'valid', kind: 'family', revision: 1, outcome: 'verified', registrationStatus: 'confirmed', code: 'TEST', persons: [{ id: eventId, kind: 'adult', firstName: 'Ada', lastName: 'Prova', checkedInAt: null }] };
  const session = new ReceptionStationSession(async command => command.action === 'inspect' ? result : fail ? { status: 'unavailable' } : { ...result, outcome: 'saved' }, () => eventId, 20000, { duty: 'event_entry' }, true);
  await session.inspect({ kind: 'code', value: 'TEST' }); await setImmediate();
  assert.equal(read.mock.callCount(), 1);
  session.selectPresence(); fail = true; await session.submit({ subjectIds: [eventId] }); await setImmediate();
  assert.equal(read.mock.callCount(), 1);
  fail = false; await session.retry(); await setImmediate();
  assert.equal(read.mock.callCount(), 2);
  await session.removeCurrent(); await session.submit({ subjectIds: [eventId] }, true); await setImmediate();
  assert.equal(read.mock.callCount(), 3);
  const panel = new ReceptionStationSession(async () => ({ ...result, persons: [{ ...result.persons[0], eventCheckedIn: true }] }), () => eventId, 20000, { duty: 'panel_entry', panelId: eventId });
  await panel.inspect({ kind: 'code', value: 'TEST' }); await setImmediate();
  assert.equal(read.mock.callCount(), 3);
});

test('same-tab BroadcastChannel delivery does not duplicate the local save notification', async t => {
  const { read } = setup(t);
  const channels = new Set<Channel>();
  class Channel {
    onmessage?: (event: { data: unknown }) => void;
    constructor() { channels.add(this); }
    postMessage(data: unknown) { queueMicrotask(() => { channels.forEach(channel => channel.onmessage?.({ data })); }); }
    close() { channels.delete(this); }
  }
  Object.defineProperty(globalThis, 'BroadcastChannel', { configurable: true, value: Channel });
  const otherProvider = new EventAttendanceStore(eventId);
  const stop = otherProvider.start();
  await setImmediate();
  assert.equal(read.mock.callCount(), 2);
  notifyEventAttendanceChanged(); await setImmediate();
  assert.equal(read.mock.callCount(), 4, 'one read per provider, not one for each transport');
  stop();
});

test('summary report stays on demand and does not react to polling, focus or saved changes', async t => {
  const { stop, read, win } = setup(t);
  stop();
  const summary = new EventAttendanceStore(eventId, true);
  const stopSummary = summary.start();
  await setImmediate();
  const count = read.mock.callCount();
  assert.match(String(read.mock.calls.at(-1)?.arguments[0]), /&summary=1$/);
  notifyEventAttendanceChanged(); t.mock.timers.tick(ATTENDANCE_RECONCILE_MS);
  win.dispatchEvent(new Event('focus')); win.dispatchEvent(new Event('online')); await setImmediate();
  assert.equal(read.mock.callCount(), count);
  summary.refresh(); await setImmediate();
  assert.equal(read.mock.callCount(), count + 1);
  stopSummary();
});
