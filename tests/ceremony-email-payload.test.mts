import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import {
  renderPublicationEmail,
  type PublicationNotice,
} from "../lib/ceremonies/publication-email.ts";
import {
  sendTransactionalEmail,
  type SendEmailInput,
} from "../lib/email/smtp.ts";
const id = "00000000-0000-4000-8000-000000000001";
const notice: PublicationNotice = {
  id,
  claim: id,
  eventId: id,
  userId: null,
  registrationId: id,
  payload: {
    kind: "opening",
    title: "Inaugurazione",
    startsAt: "2026-10-25T15:30:00Z",
    location: "Synthetic",
    lines: [{ name: "Synthetic person", sector: "A" }],
  },
};
test("real ceremony preparation sends one bilingual notification per recipient with compliant metadata", async () => {
  const env = { ...process.env },
    originalFetch = globalThis.fetch;
  let calls = 0;
  try {
    process.env.APP_URL = "https://example.invalid";
    process.env.EMAIL_DELIVERY_MODE = "postmark";
    process.env.POSTMARK_SERVER_TOKEN = "synthetic";
    globalThis.fetch = async (_url, init) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(body.Metadata, { ceremony_email_id: id });
      assert.match(body.TextBody, /Italiano[\s\S]*English/);
      assert.match(body.HtmlBody, /lang="it"[\s\S]*lang="en"/);
      assert.match(body.Subject, /Inaugurazione.*Opening ceremony/);
      assert.equal(body.To, "synthetic@example.invalid");
      return Response.json({ ErrorCode: 0, MessageID: "synthetic" });
    };
    const db = {
      from: () => {
        throw Error("Email must not depend on preferred_locale queries");
      },
    };
    const dependencies: Record<string, unknown> = {
      "@/lib/supabase/service": { createSupabaseServiceClient: () => db },
      "@/lib/email/campaign-recipients.server": {
        resolveCurrentParticipantRecipient: async () => ({ participantId: id }),
        loadCampaignRecipientPreviews: async () => [
          { destinationEmail: "synthetic@example.invalid" },
        ],
      },
      "@/lib/operational-users/identity": {
        getOperationalUserIdentities: async () =>
          new Map([[id, { email: "synthetic@example.invalid" }]]),
      },
      "./publication-email": { renderPublicationEmail },
      "./publication-delivery": {
        processCeremonyPublicationEmails: async (
          _db: unknown,
          prepare: (n: PublicationNotice) => Promise<SendEmailInput>,
        ) => {
          for (const n of [
            notice,
            { ...notice, userId: id, registrationId: null },
          ])
            await sendTransactionalEmail(await prepare(n));
        },
      },
    };
    const code = ts.transpileModule(
      readFileSync("lib/ceremonies/publication-delivery.server.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText;
    const exports = {} as {
      processDueCeremonyPublications: () => Promise<void>;
    };
    new Function("require", "exports", code)((name: string) => {
      assert.ok(name in dependencies, name);
      return dependencies[name];
    }, exports);
    await exports.processDueCeremonyPublications();
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env))
      if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
});
