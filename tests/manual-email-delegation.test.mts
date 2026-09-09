import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { parseManualRegistrationForm, buildManualRegistrationQuestionnaireAnswers } from "../lib/registrations/manual-registration.ts";
import * as delegate from "../lib/email/participant-delegate.ts";
import type { CampaignRecipient } from "../lib/email/campaign-recipients.server.ts";
import * as allRows from "../lib/supabase/all-rows.ts";

function form(delegated = false) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    groupId: "11111111-1111-4111-8111-111111111111",
    firstName: "Persona", lastName: "Sintetica",
    availabilityUnknown: "on", consentConfirmed: "on",
  })) data.set(key, value);
  if (delegated) data.set("useLeaderEmail", "on");
  return data;
}
test("explicit delegation accepts no personal contacts and discards stale email", () => {
  for (const email of ["", "old@example.org", "invalid"]) {
    const data = form(true);
    data.set("email", email);
    data.set("communicationDelegateUserId", "forged");
    const parsed = parseManualRegistrationForm(data);
    assert.ok(parsed.ok);
    assert.equal(parsed.value.email, null);
    assert.equal(parsed.value.phone, null);
    const snapshot = buildManualRegistrationQuestionnaireAnswers(parsed.value, { id: "group", name: "Group" }, "actor");
    assert.equal(snapshot.contact.communicationDelegateUserId, "actor");
    assert.equal(snapshot.contact.hasEmail, false);
  }
});
test("personal mode requires a valid email even if a phone was supplied", () => {
  const data = form();
  data.set("phone", "+393331234567");
  assert.equal(parseManualRegistrationForm(data).ok, false);
  data.set("email", "invalid");
  assert.equal(parseManualRegistrationForm(data).ok, false);
  data.set("email", " PERSON@example.org ");
  const parsed = parseManualRegistrationForm(data);
  assert.ok(parsed.ok);
  assert.equal(parsed.value.email, "person@example.org");
  assert.equal(parsed.value.useLeaderEmail, false);
});
test("delegation never bypasses consent or invalid phone validation", () => {
  const data = form(true);
  data.delete("consentConfirmed");
  assert.equal(parseManualRegistrationForm(data).ok, false);
  data.set("consentConfirmed", "on");
  data.set("phone", "bad");
  assert.equal(parseManualRegistrationForm(data).ok, false);
});

// Run the actual campaign resolver against an in-memory PostgREST transport.
type DbRow = Record<string, unknown>;
type DbResult = { data: DbRow[]; error: { message: string } | null };
type Query = {
  select(): Query; eq(k: string, v: unknown): Query; neq(k: string, v: unknown): Query;
  is(k: string, v: unknown): Query; not(k: string, op: string, v: unknown): Query;
  in(k: string, vs: unknown[]): Query; order(): Query; range(from: number, to: number): Query;
  then(resolve: (value: DbResult) => unknown, reject: (reason: unknown) => unknown): Promise<unknown>;
};
function resolver(tables: Record<string, DbRow[]>, failTable?: string) {
  const service = {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const val = (row: DbRow, key: string) => key.split(".").reduce<unknown>((v, k) => (v as DbRow)?.[k], row);
      const q: Query = {
        select: () => q,
        eq: (k: string, v: unknown) => { rows = rows.filter(r => val(r, k) === v); return q; },
        neq: (k: string, v: unknown) => { rows = rows.filter(r => val(r, k) !== v); return q; },
        is: (k: string, v: unknown) => { rows = rows.filter(r => val(r, k) === v); return q; },
        not: (k: string, _op: string, v: unknown) => { rows = rows.filter(r => val(r, k) !== v); return q; },
        in: (k: string, vs: unknown[]) => { rows = rows.filter(r => vs.includes(val(r, k))); return q; },
        order: () => q,
        range: (from: number, to: number) => { rows = rows.slice(from, to + 1); return q; },
        then: (resolve, reject) => Promise.resolve({
          data: rows, error: table === failTable ? { message: "synthetic read failure" } : null,
        }).then(resolve, reject),
      };
      return q;
    },
  };
  const output = ts.transpileModule(readFileSync(new URL("../lib/email/campaign-recipients.server.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", output)((id: string) => {
    if (id.includes("participant-delegate")) return delegate;
    if (id.includes("all-rows")) return allRows;
    if (id.includes("supabase/service")) return { createSupabaseServiceClient: () => service };
    if (id.includes("operational-users/identity")) return {};
    throw new Error(id);
  }, exports);
  return exports as { resolveCurrentParticipantRecipient(eventId: string, registrationId: string): Promise<CampaignRecipient | null> };
}
function tables() {
  return {
    registrations: [{ id: "reg", participant_id: "person", event_id: "event", status: "confirmed", source: "capogruppo", created_by: "creator", deleted_at: null as string | null }],
    participant_contacts: [] as DbRow[],
    participant_group_assignments: [{ registration_id: "reg", group_id: "child", is_current: true }],
    groups: [
      { id: "child", event_id: "event", is_active: true, parent_group_id: "root" },
      { id: "root", event_id: "event", is_active: true, parent_group_id: null },
    ],
    group_memberships: [
      { group_id: "child", user_id: "other", role: "capogruppo", is_primary: true },
      { group_id: "root", user_id: "creator", role: "capogruppo", is_primary: false },
    ],
    profiles: [{ id: "creator", email: "creator@example.org" }, { id: "other", email: "other@example.org" }],
    registration_questionnaire_answers: [{
      registration_id: "reg", event_id: "event",
      answers: { contact: { useLeaderEmail: true, communicationDelegateUserId: "creator" } },
    }],
  };
}
test("campaigns use the actual creator, including parent-group scope, and switch to personal email", async () => {
  const db = tables();
  const resolve = resolver(db).resolveCurrentParticipantRecipient;
  assert.equal((await resolve("event", "reg"))?.delegateUserId, "creator");
  db.participant_contacts.push({ participant_id: "person", email: "personal@example.org", is_primary: true });
  const direct = await resolve("event", "reg");
  assert.equal(direct?.deliveryKind, "direct");
  assert.equal(direct?.delegateUserId, null);
  assert.equal(await resolve("other-event", "reg"), null);
});
test("explicit delegation never falls back to a different leader when scope is lost", async () => {
  const db = tables();
  db.group_memberships = db.group_memberships.filter(row => row.user_id !== "creator");
  assert.equal(await resolver(db).resolveCurrentParticipantRecipient("event", "reg"), null);
});
test("forged delegate, deleted registration and unavailable recipient cannot receive messages", async () => {
  const forged = tables();
  forged.registration_questionnaire_answers[0].answers.contact.communicationDelegateUserId = "other";
  assert.equal(await resolver(forged).resolveCurrentParticipantRecipient("event", "reg"), null);
  const deleted = tables();
  deleted.registrations[0].deleted_at = "2026-09-08";
  assert.equal(await resolver(deleted).resolveCurrentParticipantRecipient("event", "reg"), null);
  const unavailable = tables();
  unavailable.profiles = unavailable.profiles.filter(row => row.id !== "creator");
  assert.equal(await resolver(unavailable).resolveCurrentParticipantRecipient("event", "reg"), null);
});
test("legacy delegation remains compatible and read failures stop resolution", async () => {
  const db = tables();
  db.registration_questionnaire_answers = [];
  assert.equal((await resolver(db).resolveCurrentParticipantRecipient("event", "reg"))?.delegateUserId, "other");
  await assert.rejects(() => resolver(tables(), "registration_questionnaire_answers")
    .resolveCurrentParticipantRecipient("event", "reg"), /synthetic read failure/);
});

test("a queued delegated delivery is refreshed before rendering and sending to a newly assigned email", async () => {
  const current: CampaignRecipient = {
    recipientKey: "participant:person", recipientType: "participant",
    schoolTeacherId: null,
    participantId: "person", registrationId: "reg", recipientUserId: null,
    deliveryKind: "direct", delegateUserId: null,
  };
  const checked: CampaignRecipient[] = [];
  const exports: Record<string, unknown> = {};
  const output = ts.transpileModule(readFileSync(new URL("../lib/email/campaign-delivery.server.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", output)((id: string) => {
    if (id.includes("campaign-recipients.server")) return {
      resolveCurrentParticipantRecipient: async () => current,
    };
    if (id.includes("campaign-eligibility")) return {
      isCampaignRecipientOperational: async (_db: unknown, _event: string, recipient: CampaignRecipient) => {
        checked.push(recipient); return true;
      },
    };
    return {};
  }, exports);
  const service = {
    from(table: string) {
      assert.notEqual(table, "profiles", "stale delegate address must not be loaded");
      const data = table === "participants"
        ? { first_name: "Persona", last_name: "Sintetica", public_code: "SYNTH" }
        : table === "participant_group_assignments"
          ? { groups: { name: "Gruppo" } }
          : { email: "personal@example.org" };
      const q = {
        select() { return q; }, eq() { return q; }, not() { return q; },
        order() { return q; }, limit() { return q; },
        single: async () => ({ data }), maybeSingle: async () => ({ data }),
      };
      return q;
    },
  };
  const load = exports.loadCampaignDeliveryData as (
    service: unknown, event: string, title: string, recipient: CampaignRecipient
  ) => Promise<{ email: string; recipient: CampaignRecipient }>;
  const result = await load(service, "event", "Evento", {
    ...current, deliveryKind: "delegated", delegateUserId: "old-delegate",
  });
  assert.equal(result.email, "personal@example.org");
  assert.equal(result.recipient.deliveryKind, "direct");
  assert.equal(result.recipient.delegateUserId, null);
  assert.deepEqual(checked, [current]);
});
