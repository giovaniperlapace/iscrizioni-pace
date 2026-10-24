import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDuplicatePair } from "../lib/data-quality/review.ts";
import { loadDuplicateReview } from "../lib/data-quality/review.server.ts";
import { openQualityPayload } from "../lib/data-quality/seal.server.ts";
import { loadQualityPeople } from "../lib/data-quality/data.server.ts";
const ids: [string, string] = ['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002'];
const makeRow = (id: string) => ({ id, event_id: 'event', participant_id: `p-${id}`, status: 'submitted', deleted_at: null, submitted_at: null,
  participants: { first_name: 'Test', last_name: id, birth_date: null, public_code: id, auth_user_id: null }, registration_children: [] });
function fixture({ changed = false, missing = false, fail = false } = {}) {
  const reads: { table: string; filters: Record<string, unknown> }[] = [];
  // The only two allowed identities are embedded in a much larger event.
  const registrations = [...ids.map(makeRow), ...Array.from({length: 15000}, (_, n) => makeRow(`unrelated-${n}`))];
  const db = { from(table: string) {
    const filters: Record<string, unknown> = {};
    const query = {
      select() { return query; }, order() { return query; }, range() { return query; },
      eq(key: string, value: unknown) { filters[key] = value; return query; },
      in(key: string, value: unknown) { filters[key] = value; return query; },
      then(resolve: (value: unknown) => unknown) {
        reads.push({ table, filters });
        const data = table === 'registrations' ? registrations.filter(row => (filters.id as string[]).includes(row.id) && (!missing || row.id !== ids[1])) : [];
        return Promise.resolve({data, error: fail ? {message: 'Read failed'} : null}).then(resolve);
      },
    }; return query;
  } } as unknown as SupabaseClient;
  let versions = 0;
  const service = { async rpc(name: string, args: Record<string, string>) {
    assert.equal(name, 'quality_duplicate_pair_version');
    assert.deepEqual(args, {p_event_id: 'event', p_actor_user_id: 'actor', p_left_id: ids[0], p_right_id: ids[1]});
    return {data: changed && ++versions > 1 ? 'changed' : 'stable', error: null};
  } } as unknown as SupabaseClient;
  return {db, service, reads};
}

test('pair parsing rejects malformed, duplicate and extra IDs and canonicalizes order', () => {
  assert.deepEqual(parseDuplicatePair([...ids].reverse().join(':')), ids);
  for (const value of [null, '', 'one:two', ids[0], `${ids[0]}:${ids[0]}`, `${ids.join(':')}:${ids[0]}`, 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']) assert.equal(parseDuplicatePair(value), null);
});
test('opening comparison reads two registrations out of 15002 and no whole-event catalog or version', async () => {
  const {db, service, reads} = fixture();
  const result = await loadDuplicateReview(db, service, 'event', 'actor', ids, false);
  assert.equal(result.left.id, ids[0]); assert.equal(result.right.id, ids[1]); assert.equal(result.token, '');
  assert.equal(reads.length, 5);
  assert.deepEqual(reads[0].filters, {event_id: 'event', id: ids});
  for (const read of reads.slice(1)) {
    const selection = (read.filters.registration_id ?? read.filters.participant_id) as string[];
    assert.equal(selection.length, 2); assert.ok(selection.every(id => !id.includes('unrelated')));
  }
});
test('changed pair, removed registration and read errors cannot produce a confirmation token', async () => {
  for (const options of [{changed: true}, {missing: true}, {fail: true}]) {
    const {db, service} = fixture(options);
    await assert.rejects(loadDuplicateReview(db, service, 'event', 'actor', ids, true));
  }
});
test('write token is scoped to pair dismissal and bound to actor and event', async () => {
  const prior = process.env.QR_TOKEN_ENCRYPTION_SECRET;
  process.env.QR_TOKEN_ENCRYPTION_SECRET = 'synthetic-duplicate-review-test';
  try {
    const {db, service} = fixture();
    const result = await loadDuplicateReview(db, service, 'event', 'actor', ids, true);
    const payload = openQualityPayload<{kind: string; actor: string; eventId: string; expires: number; scope: string; left: string; right: string; version: string}>(result.token, 'review-v1', 'actor', 'event');
    assert.equal(payload.scope, 'pair-v1'); assert.equal(payload.version, 'stable');
    assert.equal(payload.left, ids[0]); assert.equal(payload.right, ids[1]);
    assert.throws(() => openQualityPayload(result.token, 'review-v1', 'other', 'event'));
    assert.throws(() => openQualityPayload(result.token, 'review-v1', 'actor', 'other'));
  } finally { if (prior === undefined) delete process.env.QR_TOKEN_ENCRYPTION_SECRET; else process.env.QR_TOKEN_ENCRYPTION_SECRET = prior; }
});
test('empty scoped selection never falls back to reading all participants', async () => {
  const {db, reads} = fixture();
  assert.deepEqual(await loadQualityPeople(db, 'event', []), []); assert.equal(reads.length, 0);
});
