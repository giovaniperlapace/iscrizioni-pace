import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

function previewLoader(failAt = 0) {
  const exports: Record<string, unknown> = {};
  let participantReads = 0;
  const service = {
    from(table: string) {
      let ids: string[] = [];
      const query = {
        select() { return query; },
        eq() { return query; },
        order() { return query; },
        in(_column: string, values: string[]) { ids = values; return query; },
        then(resolve: (value: unknown) => unknown) {
          const tooLong = new URLSearchParams({ select: "id,first_name,last_name", id: `in.(${ids.join(",")})` }).toString().length > 8000;
          const failed = table === "participants" && ++participantReads === failAt;
          const data = table === "participants"
            ? ids.map(id => ({ id, first_name: "Person", last_name: id }))
            : table === "participant_contacts"
              ? ids.map(id => ({ participant_id: id, email: `${id}@example.test`, is_primary: true }))
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
    if (id.includes("supabase/service")) return { createSupabaseServiceClient: () => service };
    if (id.includes("operational-users/identity")) return { getOperationalUserIdentities: async () => new Map() };
    return {};
  }, exports);
  return exports.loadCampaignRecipientPreviews as (...args: unknown[]) => Promise<Array<{ recipientKey: string }>>;
}

const recipients = Array.from({ length: 1268 }, (_, i) => {
  const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
  return { recipientKey: `participant:${id}`, recipientType: "participant", participantId: id, registrationId: id, recipientUserId: null, deliveryKind: "direct", delegateUserId: null };
});

test("campaign preview loads every recipient without exceeding the proxy URI limit", async () => {
  const result = await previewLoader()(recipients, new Set(), "event");
  assert.equal(result.length, recipients.length);
  assert.deepEqual(new Set(result.map(row => row.recipientKey)), new Set(recipients.map(row => row.recipientKey)));
});

test("campaign preview rejects a failed later batch instead of returning a partial list", async () => {
  await assert.rejects(previewLoader(2)(recipients, new Set(), "event"), /read failed/);
});
