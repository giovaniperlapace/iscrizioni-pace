import assert from "node:assert/strict";
import test from "node:test";
import { publicationDeliveryEvidence } from "../lib/ceremonies/publication-report.ts";
const event = {
  Type: "Delivered",
  Recipient: "SYNTHETIC@example.invalid",
  ReceivedAt: "2026-10-24T14:00:00Z",
};
const details = {
  MessageID: "synthetic",
  MessageStream: "outbound",
  MessageEvents: [event],
};
test("delivery reports require matching provider evidence, never infer delivery from acceptance", () => {
  assert.equal(
    publicationDeliveryEvidence(
      { ...details, Status: "Sent", MessageEvents: [] },
      "synthetic",
      "synthetic@example.invalid",
      "outbound",
    ),
    null,
  );
  assert.deepEqual(
    publicationDeliveryEvidence(
      details,
      "synthetic",
      "synthetic@example.invalid",
      "outbound",
    ),
    { state: "delivered", at: "2026-10-24T14:00:00.000Z" },
  );
  for (const change of [
    { MessageID: "another" },
    { MessageStream: "broadcast" },
    { Sandboxed: true },
    { MessageEvents: null },
  ])
    assert.throws(() =>
      publicationDeliveryEvidence(
        { ...details, ...change },
        "synthetic",
        "synthetic@example.invalid",
        "outbound",
      ),
    );
  assert.equal(
    publicationDeliveryEvidence(
      details,
      "synthetic",
      "different@example.invalid",
      "outbound",
    ),
    null,
  );
  assert.equal(
    publicationDeliveryEvidence(
      { ...details, MessageEvents: [{ ...event, ReceivedAt: "invalid" }] },
      "synthetic",
      "synthetic@example.invalid",
      "outbound",
    ),
    null,
  );
});
test("latest bounce supersedes delivery; order and unrelated recipients do not affect outcome", () => {
  const bounce = {
    ...event,
    Type: "Bounced",
    ReceivedAt: "2026-10-24T15:00:00Z",
  };
  for (const events of [
    [bounce, event],
    [event, bounce],
  ])
    assert.equal(
      publicationDeliveryEvidence(
        {
          ...details,
          MessageEvents: [
            ...events,
            {
              ...event,
              Recipient: "else@example.invalid",
              ReceivedAt: "2026-10-25T15:00:00Z",
            },
          ],
        },
        "synthetic",
        "synthetic@example.invalid",
        "outbound",
      )?.state,
      "bounced",
    );
});

import { readFileSync } from "node:fs";
import ts from "typescript";
import { PUBLICATION_EMAIL_LABELS } from "../lib/ceremonies/publication-report.ts";
import { csvCell } from "../lib/email/campaign-report.ts";
import { isMapId } from "../lib/ceremonies/seat-map.ts";
const plan = "00000000-0000-4000-8000-000000000001",
  pub = "00000000-0000-4000-8000-000000000002";
function loadRoute(
  mode: "allowed" | "forbidden" | "foreign" | "error",
  verifyFails = false,
) {
  const filters: [string, string, unknown][] = [];
  const updates: Record<string, unknown>[] = [];
  let providerCalls = 0;
  const row = {
    id: "mail",
    publication_id: pub,
    user_id: null,
    payload: { lines: [{ name: "=Synthetic" }] },
    recipient: "synthetic@example.invalid",
    state: "accepted",
    error_code: null,
    created_at: "2026-10-24T14:00:00Z",
    accepted_at: "2026-10-24T14:00:00Z",
    delivery_state: null,
    delivery_at: null,
    delivery_checked_at: null,
    subject_snapshot: "Saved subject",
    text_snapshot: "Saved text",
    message_id: "synthetic",
  };
  const db = {
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: (key: string, v: unknown) => {
          filters.push([table, key, v]);
          return q;
        },
        or: (value: string) => {
          filters.push([table, "or", value]);
          return q;
        },
        not: () => q,
        order: () => q,
        limit: () => q,
        range: () => q,
        update: (v: Record<string, unknown>) => {
          updates.push(v);
          return q;
        },
        maybeSingle: async () => ({
          data: mode === "foreign" ? null : { id: plan },
          error: mode === "error" ? { message: "private error" } : null,
        }),
        then: (resolve: (v: unknown) => void) =>
          resolve({
            data:
              table === "ceremony_assignment_drafts"
                ? [
                    {
                      id: "draft",
                      publication_id: pub,
                      data: { quantity: 1 },
                      updated_at: row.created_at,
                    },
                  ]
                : [row],
            error: null,
          }),
      };
      return q;
    },
  };
  const deps: Record<string, unknown> = {
    "next/server": {
      NextResponse: {
        json: (d: unknown, o: { status?: number; headers?: HeadersInit }) =>
          new Response(JSON.stringify(d), {
            status: o.status,
            headers: { ...o.headers, "Content-Type": "application/json" },
          }),
      },
    },
    "@/lib/supabase/server": { createSupabaseServerClient: async () => ({}) },
    "@/lib/supabase/service": { createSupabaseServiceClient: () => db },
    "@/lib/ceremonies/service": {
      ceremonyContext: async () => ({
        canManage: mode !== "forbidden",
        event: { id: "current" },
      }),
    },
    "@/lib/ceremonies/seat-map": { isMapId },
    "@/lib/supabase/all-rows": {
      loadAllRows: async (fn: (a: number, b: number) => PromiseLike<unknown>) =>
        await fn(0, 499),
    },
    "@/lib/email/campaign-report": { csvCell },
    "@/lib/email/postmark-reporting": {
      postmarkRead: async () => {
        providerCalls++;
        if (verifyFails) throw Error("private token");
        return details;
      },
    },
    "@/lib/email/config": {
      getEmailConfig: () => ({
        deliveryMode: "postmark",
        transactionalStream: "outbound",
      }),
    },
    "@/lib/ceremonies/publication-report": {
      PUBLICATION_EMAIL_LABELS,
      publicationDeliveryEvidence,
    },
  };
  const code = ts.transpileModule(
    readFileSync("app/dashboard/ceremonies/publications/route.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports = {} as {
    GET: (r: Request) => Promise<Response>;
    POST: (r: Request) => Promise<Response>;
  };
  new Function("require", "exports", code)((id: string) => {
    assert.ok(id in deps, id);
    return deps[id];
  }, exports);
  return { exports, filters, updates, providerCalls: () => providerCalls };
}
for (const mode of ["forbidden", "foreign", "error"] as const)
  test(`publication report ${mode} cannot expose recipients or contact provider`, async () => {
    const r = loadRoute(mode);
    for (const method of ["GET", "POST"] as const) {
      const response = await r.exports[method](
        new Request(
          `https://example.invalid/?planId=${plan}&publication=${pub}`,
        ),
      );
      assert.equal(response.status, mode === "error" ? 503 : 403);
      assert.doesNotMatch(await response.text(), /synthetic|private/);
    }
    assert.equal(r.providerCalls(), 0);
    assert.equal(r.updates.length, 0);
  });
test("report scopes reads to current ceremony and preserves actual recipient and text snapshots", async () => {
  const r = loadRoute("allowed");
  const response = await r.exports.GET(
    new Request(`https://example.invalid/?planId=${plan}&publication=${pub}`),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const result = await response.json();
  assert.equal(result.recipients[0].recipient, "synthetic@example.invalid");
  assert.equal(result.recipients[0].text, "Saved text");
  assert.deepEqual(result.counts, { accepted: 1 });
  assert.ok(
    r.filters.some(
      ([table, key, value]) =>
        table === "ceremony_publication_emails" &&
        key === "event_id" &&
        value === "current",
    ),
  );
  assert.ok(
    r.filters.some(
      ([table, key, value]) =>
        table === "ceremony_publication_emails" &&
        key === "plan_id" &&
        value === plan,
    ),
  );
  assert.equal(r.providerCalls(), 0);
  const csv = await r.exports.GET(
    new Request(
      `https://example.invalid/?planId=${plan}&publication=${pub}&format=csv`,
    ),
  );
  assert.match(await csv.text(), /'=Synthetic/);
});
test("delivery refresh saves matched evidence and never changes send state or requeues", async () => {
  for (const failed of [false, true]) {
    const r = loadRoute("allowed", failed);
    const response = await r.exports.POST(
      new Request(
        `https://example.invalid/?planId=${plan}&publication=${pub}`,
        { method: "POST" },
      ),
    );
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.checked, failed ? 0 : 1);
    assert.equal(result.unavailable, failed ? 1 : 0);
    assert.equal(r.updates.length, failed ? 0 : 2);
    if (!failed) {
      assert.equal(r.updates[0].delivery_state, "delivered");
      assert.ok(r.updates.every((u) => !("state" in u)));
      assert.ok(
        r.filters.some(
          ([, key, value]) =>
            key === "or" && String(value).includes("delivery_at.lt."),
        ),
      );
    }
  }
});
