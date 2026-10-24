import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDraftCommand,
  sectorCounts,
  draftData,
} from "../lib/ceremonies/drafts.ts";
import type { SeatsDesk } from "../lib/ceremonies/seats-desk.ts";
import {
  renderPublicationEmail,
  type PublicationNotice,
} from "../lib/ceremonies/publication-email.ts";
import { processCeremonyPublicationEmails } from "../lib/ceremonies/publication-delivery.ts";
import { EmailDeliveryError } from "../lib/email/smtp.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const notice: PublicationNotice = {
  id: id(1),
  claim: id(2),
  eventId: id(3),
  userId: null,
  registrationId: id(4),
  payload: {
    kind: "opening",
    title: "Inaugurazione",
    startsAt: "2026-10-25T15:30:00Z",
    location: "Sala <Test>",
    lines: [{ name: "Adult & Child", sector: "A<script>" }],
  },
};
test("draft command validates scope, revisions and direct families, forbids numbered/legacy assignment", () => {
  const c = {
    planId: id(1),
    revision: 1,
    requestId: id(2),
    operation: "publish",
    draftId: null,
    data: null,
  };
  assert.ok(parseDraftCommand(c));
  for (const change of [
    { operation: "foo" },
    { revision: -1 },
    { revision: 2147483647 },
    { draftId: id(3) },
    { data: {} },
  ])
    assert.equal(parseDraftCommand({ ...c, ...change }), null);
  const draft = {
    id: id(3),
    sectorId: id(4),
    sector: "A",
    quantity: 2,
    groupId: null,
    groupName: null,
    subjects: [
      { registrationId: id(5), childId: null, name: "Adult" },
      { registrationId: id(5), childId: id(6), name: "Child" },
    ],
  };
  const data = draftData(draft);
  assert.ok(parseDraftCommand({ ...c, operation: "save", data }));
  assert.equal(
    parseDraftCommand({
      ...c,
      operation: "save",
      data: { ...data, action: "assign" },
    }),
    null,
  );
  assert.equal(
    parseDraftCommand({
      ...c,
      operation: "save",
      data: { ...data, seatIds: [id(7), id(8)] },
    }),
    null,
  );
  assert.ok(parseDraftCommand({ ...c, operation: "remove", draftId: id(3) }));
});
test("map counts distinguish published names, pending group names and drafts without double counting", () => {
  const desk = {
    allocations: [
      { id: id(1), sectorId: id(8), groupId: null, quantity: 1 },
      { id: id(2), sectorId: id(8), groupId: id(9), quantity: 4 },
    ],
    nominees: [
      { allocationId: id(1), needsSeat: true },
      { allocationId: id(2), needsSeat: true },
      { allocationId: id(2), needsSeat: false },
    ],
    drafts: [
      { sectorId: id(8), quantity: 3 },
      { sectorId: id(7), quantity: 5 },
    ],
  } as SeatsDesk;
  assert.deepEqual(sectorCounts(desk, id(8)), {
    nominal: 2,
    groupPending: 3,
    draft: 3,
  });
});
test("publication emails include complete Italian and English sections for both ceremonies and roles", () => {
  for (const kind of ["opening", "closing"] as const) {
    for (const leader of [false, true]) {
      const email = renderPublicationEmail(
        {
          ...notice,
          userId: leader ? id(5) : null,
          registrationId: leader ? null : notice.registrationId,
          payload: {
            ...notice.payload,
            kind,
            lines: leader
              ? [{ name: "Group & Friends", sector: "B", quantity: 12 }]
              : notice.payload.lines,
          },
        },
        "https://example.invalid",
      );
      const [italian, english] = email.text.split("\n\n---\n\n");
      assert.ok(italian.startsWith("Italiano\n"));
      assert.ok(english.startsWith("English\n"));
      assert.match(italian, /25 ottobre 2026.*16:30/);
      assert.match(english, /October 25, 2026.*4:30 PM/);
      assert.match(
        email.subject,
        kind === "opening"
          ? /Inaugurazione.*Opening ceremony/
          : /Cerimonia finale.*Closing ceremony/,
      );
      assert.match(italian, leader ? /12 posti/ : /Settore A<script>/);
      assert.match(english, leader ? /12 places/ : /Sector A<script>/);
      assert.match(
        italian,
        leader ? /assegnali nominalmente/ : /area personale/,
      );
      assert.match(
        english,
        leader ? /assign them to your members/ : /personal area/,
      );
      for (const section of [italian, english]) {
        assert.ok(
          section.includes(
            leader
              ? `/capogruppo/cerimonie?kind=${kind}`
              : "/partecipante/cerimonie",
          ),
        );
        assert.ok(section.includes("Sala <Test>"));
        assert.ok(
          section.includes(leader ? "Group & Friends" : "Adult & Child"),
        );
      }
      assert.match(email.html, /<section lang="it">.*<section lang="en">/);
      assert.match(email.html, /Sala &lt;Test&gt;/);
      assert.doesNotMatch(email.html, /<script>/);
      if (!leader)
        assert.equal(email.html.match(/A&lt;script&gt;/g)?.length, 2);
    }
  }
  assert.throws(() => renderPublicationEmail(notice, "javascript:bad"));
});

function mockDb(finishFails = false) {
  let claimed = false;
  const updates: Record<string, unknown>[] = [];
  const db = {
    rpc: async () => ({
      data: claimed ? null : ((claimed = true), notice),
      error: null,
    }),
    from: () => ({
      update: (value: Record<string, unknown>) => {
        updates.push(value);
        const q = {
          eq: () => q,
          select: () => q,
          maybeSingle: async () => ({
            data: finishFails && "state" in value ? null : { id: notice.id },
            error: null,
          }),
        };
        return q;
      },
    }),
  } as unknown as SupabaseClient;
  return { db, updates };
}
const email = {
  to: "synthetic@example.invalid",
  subject: "Synthetic",
  html: "<p>Test</p>",
  text: "Test",
};
test("email provider acceptance is persisted separately; no real sends in tests", async () => {
  const { db, updates } = mockDb();
  let calls = 0;
  const result = await processCeremonyPublicationEmails(db, async () => email, {
    mode: "postmark",
    send: async () => {
      calls++;
      return { messageId: "synthetic" };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.accepted, 1);
  assert.equal(updates[0].recipient, email.to);
  assert.equal(updates[1].state, "accepted");
});
test("uncertain provider result is never retried, preparation failures are distinct", async () => {
  for (const error of [
    new EmailDeliveryError("postmark_delivery_unknown"),
    new Error("lost"),
  ]) {
    const { db, updates } = mockDb();
    let calls = 0;
    const result = await processCeremonyPublicationEmails(
      db,
      async () => email,
      {
        mode: "postmark",
        send: async () => {
          calls++;
          throw error;
        },
      },
    );
    assert.equal(calls, 1);
    assert.equal(result.uncertain, 1);
    assert.equal(updates.at(-1)?.state, "uncertain");
  }
  const { db, updates } = mockDb();
  const result = await processCeremonyPublicationEmails(
    db,
    async () => {
      throw Error("missing contact");
    },
    {
      mode: "postmark",
      send: async () => {
        throw Error("must not send");
      },
    },
  );
  assert.equal(result.failed, 1);
  assert.equal(updates[0].state, "failed");
});
test("log mode never consumes queue; lost acknowledgement leaves no automatic resend", async () => {
  await processCeremonyPublicationEmails(
    {
      rpc: async () => {
        throw Error("must not claim");
      },
    } as unknown as SupabaseClient,
    async () => email,
    { mode: "log" },
  );
  const { db } = mockDb(true);
  let calls = 0;
  await assert.rejects(
    processCeremonyPublicationEmails(db, async () => email, {
      mode: "postmark",
      send: async () => {
        calls++;
        return { messageId: "synthetic" };
      },
    }),
    /result_unknown/,
  );
  assert.equal(calls, 1);
});

test("nominal group drafts preserve scope and personal subjects when moved", () => {
  const draft = {
    id: id(10),
    action: "group_nominal" as const,
    sectorId: id(4),
    sector: "A",
    quantity: 2,
    groupId: id(9),
    groupName: "Group",
    subjects: [
      { registrationId: id(5), childId: null, name: "One" },
      { registrationId: id(6), childId: null, name: "Two" },
    ],
  };
  const data = draftData(draft, id(8));
  const c = {
    planId: id(1),
    revision: 2,
    requestId: id(2),
    operation: "save",
    draftId: null,
    data,
  };
  assert.ok(parseDraftCommand(c));
  assert.equal(data.action, "group_nominal");
  assert.equal(data.sectorId, id(8));
  assert.equal(
    parseDraftCommand({ ...c, data: { ...data, groupId: null } }),
    null,
  );
  assert.equal(
    parseDraftCommand({
      ...c,
      data: { ...data, subjects: [data.subjects[0], data.subjects[0]] },
    }),
    null,
  );
  assert.equal(
    parseDraftCommand({ ...c, data: { ...data, quantity: 3 } }),
    null,
  );
});
