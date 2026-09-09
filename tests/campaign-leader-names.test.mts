import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { splitFullName } from "../lib/operational-users/identity.ts";

function loader(firstName: string, lastName: string, error: Error | null = null) {
  const exports: Record<string, unknown> = {};
  const source = ts.transpileModule(readFileSync(new URL("../lib/email/campaign-delivery.server.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "exports", source)((id: string) => {
    if (id.includes("campaign-eligibility")) return { isCampaignRecipientOperational: async () => true };
    if (id.includes("operational-users/identity")) return {
      splitFullName,
      getOperationalUserIdentities: async () => new Map([["leader", {
        fullName: `${firstName} ${lastName}`, email: "leader@example.test", participantId: "person",
      }]]),
    };
    return {};
  }, exports);
  const service = {
    from(table: string) {
      const q = {
        select(columns: string) {
          if (table === "participants") {
            assert.ok(columns.includes("first_name"));
            assert.ok(columns.includes("last_name"));
          }
          return q;
        },
        eq() { return q; },
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: [] }).then(resolve); },
        maybeSingle: async () => ({ data: { first_name: firstName, last_name: lastName, public_code: "TEST" }, error }),
      };
      return q;
    },
  };
  const load = exports.loadCampaignDeliveryData as (...args: unknown[]) => Promise<{ templateData: {firstName: string; lastName: string} }>;
  return () => load(service, "event", "Event", { recipientType: "group_leader", recipientUserId: "leader" });
}

test("leader email preserves stored compound surnames and given names", async () => {
  for (const [firstName, lastName] of [["Francesco", "De Palma"], ["Maria Luisa", "De Luca"], ["Anna", "Bianchi"]]) {
    const result = await loader(firstName, lastName)();
    assert.equal(result.templateData.firstName, firstName);
    assert.equal(result.templateData.lastName, lastName);
  }
});

test("leader identity read failure does not fall back to an incorrectly split name", async () => {
  await assert.rejects(loader("Francesco", "De Palma", new Error("read failed")), /read failed/);
});
