import * as allRows from "../lib/supabase/all-rows.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function previewLoader(failAt = 0, attendance: Record<string, string[]> = {}, failAttendance = false) {
  const exports: Record<string, unknown> = {};
  let participantReads = 0;
  const service = {
    from(table: string) {
      let ids: string[] = [];
      const query = {
        select() { return query; },
        eq() { return query; },
        order() { return query; },
        not() { return query; },
        range() { return query; },
        in(_column: string, values: string[]) { ids = values; return query; },
        then(resolve: (value: unknown) => unknown) {
          const tooLong = new URLSearchParams({ select: "id,first_name,last_name", id: `in.(${ids.join(",")})` }).toString().length > 8000;
          const failed = (table === "participants" && ++participantReads === failAt) || (table === "event_attendance_choices" && failAttendance);
          const data = table === "event_attendance_choices"
            ? ids.flatMap(id => (attendance[id] ?? []).map(choice => ({ registration_id: id, choice })))
            : table === "participants"
            ? ids.map(id => ({ id, first_name: "Person", last_name: id }))
            : table === "participant_contacts"
              ? ids.map(id => ({ participant_id: id, email: `${id}@example.test`, is_primary: true }))
              : table === "moment_attendance_choices"
                ? ids.map(id => ({ registration_id: id, moment_id: "panel-confirmed" }))
                : [];
          return Promise.resolve({ data, error: tooLong || failed ? { message: tooLong ? "URI too long" : "read failed" } : null }).then(resolve);
        },
      };
      return query;
    },
  };
  const source = ts.transpileModule(readFileSync(new URL("../lib/email/campaign-recipients.server.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", source)((id: string) => {
    if (id.includes("supabase/all-rows")) return allRows;
    if (id.includes("supabase/service")) return { createSupabaseServiceClient: () => service };
    if (id.includes("operational-users/identity")) return { getOperationalUserIdentities: async () => new Map() };
    return {};
  }, exports);
  return exports.loadCampaignRecipientPreviews as (...args: unknown[]) => Promise<Array<{ recipientKey: string; panelIds: string[]; attendancePending?: boolean }>>;
}

const recipients = Array.from({ length: 1268 }, (_, i) => {
  const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  return { recipientKey: `participant:${id}`, recipientType: "participant", participantId: id, registrationId: id, recipientUserId: null, deliveryKind: "direct", delegateUserId: null };
});

test("campaign preview loads every recipient without exceeding the proxy URI limit", async () => {
  const result = await previewLoader()(recipients, new Set(), "event");
  assert.equal(result.length, recipients.length);
  assert.ok(result.every(row => row.panelIds.length === 1 && row.panelIds[0] === "panel-confirmed"));
  assert.deepEqual(new Set(result.map(row => row.recipientKey)), new Set(recipients.map(row => row.recipientKey)));
});

test("campaign preview rejects a failed later batch instead of returning a partial list", async () => {
  await assert.rejects(previewLoader(2)(recipients, new Set(), "event"), /read failed/);
});


test("campaign attendance distinguishes missing/unknown days from communicated yes/no and does not use panel bookings", async () => {
  const source = recipients.slice(0, 5);
  const choices = {
    [source[1].registrationId]: ["unknown"],
    [source[2].registrationId]: ["yes", "no"],
    [source[3].registrationId]: ["no"],
    [source[4].registrationId]: ["yes", "unknown"],
  };
  const result = await previewLoader(0, choices)(source, new Set(), "event");
  const values = new Map(result.map(row => [row.recipientKey, row.attendancePending]));
  assert.deepEqual(source.map(row => values.get(row.recipientKey)), [true, true, false, false, true]);
});

test("campaign attendance errors fail the preview rather than treating unread days as missing", async () => {
  await assert.rejects(previewLoader(0, {}, true)(recipients, new Set(), "event"), /read failed/);
});
