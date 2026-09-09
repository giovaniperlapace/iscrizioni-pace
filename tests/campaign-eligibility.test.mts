import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isCampaignRecipientOperational } from "../lib/email/campaign-eligibility.ts";

type Registration = { id: string; participant_id: string; event_id: string; deleted_at: string | null; "participants.auth_user_id": string | null };
function database(rows: Registration[], fails = false) {
  return { from() {
    let matching = rows;
    const response = () => ({ data: fails ? null : matching, error: fails ? { message: "offline" } : null });
    const builder = {
      select() { return builder; }, eq(key: keyof Registration, value: string) { matching = matching.filter(row => row[key] === value); return builder; },
      is(key: keyof Registration, value: null) { matching = matching.filter(row => row[key] === value); return builder; },
      not(key: keyof Registration) { matching = matching.filter(row => row[key] !== null); return builder; },
      limit(n: number) { matching = matching.slice(0, n); return builder; },
      async maybeSingle() { const result = response(); return { ...result, data: result.data?.[0] ?? null }; },
      then(resolve: (value: ReturnType<typeof response>) => unknown) { return Promise.resolve(response()).then(resolve); },
    };
    return builder;
  } } as unknown as SupabaseClient;
}
const recipient = { recipientType: "participant", registrationId: "r1", participantId: "p1", recipientUserId: null, delegateUserId: null };
const active: Registration = { id: "r1", participant_id: "p1", event_id: "event1", deleted_at: null, "participants.auth_user_id": "u1" };

test("frozen campaign deliveries reject deleted, missing and cross-event registrations", async () => {
  assert.equal(await isCampaignRecipientOperational(database([active]), "event1", recipient), true);
  assert.equal(await isCampaignRecipientOperational(database([{ ...active, deleted_at: "2026-09-05" }]), "event1", recipient), false);
  assert.equal(await isCampaignRecipientOperational(database([]), "event1", recipient), false);
  assert.equal(await isCampaignRecipientOperational(database([active]), "event2", recipient), false);
  assert.equal(await isCampaignRecipientOperational(database([active]), "event1", { ...recipient, participantId: "different" }), false);
});

test("deleted people cannot receive leader or delegated campaigns for that event", async () => {
  const deletedLeader = { ...active, id: "r2", participant_id: "p2", "participants.auth_user_id": "leader", deleted_at: "2026-09-05" };
  const db = database([active, deletedLeader]);
  assert.equal(await isCampaignRecipientOperational(db, "event1", { ...recipient, delegateUserId: "leader" }), false);
  assert.equal(await isCampaignRecipientOperational(db, "event1", { ...recipient, recipientType: "group_leader", registrationId: null, recipientUserId: "leader" }), false);
  assert.equal(await isCampaignRecipientOperational(db, "event2", { ...recipient, recipientType: "group_leader", registrationId: null, recipientUserId: "leader" }), true);
});

test("eligibility lookup errors stop delivery instead of treating unavailable records as active", async () => {
  await assert.rejects(isCampaignRecipientOperational(database([active], true), "event1", recipient), /Cannot verify/);
});
