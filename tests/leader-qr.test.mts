import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { encryptQrToken } from "../lib/qrcode/secure-token.ts";
import { renderQrDataUrl } from "../lib/qrcode/render.ts";
import { renderParticipantQrDataUrl } from "../lib/qrcode/participant-card.ts";
const identity = { first_name: "Anna", last_name: "Rossi", public_code: "FIXA" };
import { registrationQrPreview } from "../lib/qrcode/registration-qr.ts";
import { loadLeaderAssignmentQr } from "../lib/groups/leader-qr.server.ts";

function dbFixture(overrides: Record<string, unknown[]> = {}) {
  const secret = process.env.QR_TOKEN_ENCRYPTION_SECRET;
  process.env.QR_TOKEN_ENCRYPTION_SECRET = "synthetic-qr-encryption-secret";
  const tokens = {
    selected: "synthetic-selected-participant-opaque-token",
    operator: "synthetic-operator-opaque-token",
  };
  const encrypted = encryptQrToken(tokens.selected);
  const tables: Record<string, Record<string, unknown>[]> = {
    groups: [
      {
        id: "root",
        event_id: "current",
        parent_group_id: null,
        is_active: true,
      },
      {
        id: "child",
        event_id: "current",
        parent_group_id: "root",
        is_active: true,
      },
      {
        id: "foreign",
        event_id: "current",
        parent_group_id: null,
        is_active: true,
      },
    ],
    group_memberships: [
      {
        id: "membership",
        user_id: "leader",
        role: "capogruppo",
        group_id: "root",
      },
    ],
    participant_group_assignments: [
      {
        id: "selected",
        group_id: "child",
        registration_id: "selected-registration",
        is_current: true,
        registrations: {
          id: "selected-registration",
          event_id: "current",
          deleted_at: null,
          participants: identity,
        },
      },
    ],
    qr_tokens: [
      {
        id: "selected-qr",
        registration_id: "selected-registration",
        status: "active",
        revoked_at: null,
        expires_at: null,
        token_encrypted: encrypted,
        created_at: "2026-09-07T10:00:00Z",
      },
      {
        id: "operator-qr",
        registration_id: "operator-registration",
        status: "active",
        expires_at: null,
        token_encrypted: encryptQrToken(tokens.operator),
        created_at: "2026-09-07T10:00:00Z",
      },
    ],
    ...(overrides as Record<string, Record<string, unknown>[]>),
  };
  let qrReads = 0;
  const db = {
    from(table: string) {
      if (table === "qr_tokens") qrReads++;
      let rows = [...(tables[table] ?? [])];
      let limit = Infinity;
      const order: { key: string; ascending: boolean }[] = [];
      const get = (r: Record<string, unknown>, key: string) =>
        key
          .split(".")
          .reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], r);
      const result = () =>
        rows
          .sort((a, b) => {
            for (const o of order) {
              const cmp = String(get(a, o.key)).localeCompare(
                String(get(b, o.key)),
              );
              if (cmp) return o.ascending ? cmp : -cmp;
            }
            return 0;
          })
          .slice(0, limit);
      const query = {
        select() {
          return query;
        },
        eq(key: string, val: unknown) {
          rows = rows.filter((r) => get(r, key) === val);
          return query;
        },
        is(key: string, val: unknown) {
          rows = rows.filter((r) => get(r, key) === val);
          return query;
        },
        order(key: string, options = { ascending: true }) {
          order.push({ key, ascending: options.ascending });
          return query;
        },
        limit(count: number) {
          limit = count;
          return query;
        },
        range(from: number, to: number) {
          return Promise.resolve({
            data: result().slice(from, to + 1),
            error: null,
          });
        },
        maybeSingle() {
          return Promise.resolve({ data: result()[0] ?? null, error: null });
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return {
    db,
    tables,
    tokens,
    encrypted,
    qrReads: () => qrReads,
    restore: () => {
      if (secret === undefined) delete process.env.QR_TOKEN_ENCRYPTION_SECRET;
      else process.env.QR_TOKEN_ENCRYPTION_SECRET = secret;
    },
  };
}
test("selected participant QR is the exact existing token PNG, never the operator QR", async () => {
  const fixture = dbFixture();
  try {
    const qr = await loadLeaderAssignmentQr(
      fixture.db,
      "leader",
      "current",
      "selected",
    );
    assert.equal(qr.state, "active");
    assert.equal(qr.downloadDataUrl, await renderParticipantQrDataUrl(fixture.tokens.selected, identity));
    assert.equal(qr.dataUrl, await renderQrDataUrl(fixture.tokens.selected));
    assert.notEqual(qr.dataUrl, qr.downloadDataUrl);
    assert.notEqual(qr.downloadDataUrl, await renderParticipantQrDataUrl(fixture.tokens.operator, identity));
    assert.equal(JSON.stringify(qr).includes(fixture.tokens.selected), false);
    assert.deepEqual(Object.keys(qr).sort(), ["dataUrl", "downloadDataUrl", "expiresAt", "state"]);
    assert.deepEqual(
      Buffer.from(qr.dataUrl!.split(",")[1], "base64").subarray(0, 8),
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  } finally {
    fixture.restore();
  }
});
test("no QR lookup for missing membership, outside scope/event, stale or deleted assignment", async () => {
  const cases = [
    { user: "other" },
    { assignment: "unknown" },
    { event: "other-event" },
    { patch: { group_id: "foreign" } },
    { patch: { is_current: false } },
    {
      patch: {
        registrations: {
          id: "selected-registration",
          event_id: "current",
          deleted_at: "2026-09-07",
        },
      },
    },
  ];
  for (const scenario of cases) {
    const fixture = dbFixture();
    try {
      Object.assign(
        fixture.tables.participant_group_assignments[0],
        scenario.patch ?? {},
      );
      const qr = await loadLeaderAssignmentQr(
        fixture.db,
        scenario.user ?? "leader",
        scenario.event ?? "current",
        scenario.assignment ?? "selected",
      );
      assert.equal(qr.dataUrl, null);
      assert.equal(qr.downloadDataUrl, null);
      assert.equal(qr.state, "unavailable");
      assert.equal(fixture.qrReads(), 0);
    } finally {
      fixture.restore();
    }
  }
});
test("newest revoked token does not resurrect an older active token", async () => {
  const fixture = dbFixture();
  try {
    fixture.tables.qr_tokens.push({
      ...fixture.tables.qr_tokens[0],
      id: "latest",
      status: "revoked",
      created_at: "2026-09-07T11:00:00Z",
    });
    const qr = await loadLeaderAssignmentQr(
      fixture.db,
      "leader",
      "current",
      "selected",
    );
    assert.equal(qr.state, "revoked");
    assert.equal(qr.dataUrl, null);
      assert.equal(qr.downloadDataUrl, null);
  } finally {
    fixture.restore();
  }
});
test("expiry, revocation timestamp, missing and undecipherable tokens never generate a downloadable QR", async () => {
  const fixture = dbFixture();
  try {
    const base = {
      status: "active",
      expires_at: null,
      token_encrypted: fixture.encrypted,
    };
    for (const [record, expected] of [
      [{ ...base, expires_at: "2026-09-07T10:00:00Z" }, "expired"],
      [{ ...base, status: "expired" }, "expired"],
      [{ ...base, status: "revoked" }, "revoked"],
      [{ ...base, revoked_at: "2026-09-01" }, "revoked"],
      [{ ...base, token_encrypted: null }, "unavailable"],
      [{ ...base, token_encrypted: "broken" }, "unavailable"],
      [null, "unavailable"],
    ] as const) {
      const qr = await registrationQrPreview(
        record,
        identity,
        Date.parse("2026-09-07T10:00:00Z"),
      );
      assert.equal(qr.state, expected);
      assert.equal(qr.dataUrl, null);
      assert.equal(qr.downloadDataUrl, null);
    }
    assert.equal(
      (
        await registrationQrPreview(
          { ...base, expires_at: "2026-10-28T00:00:00Z" },
          identity,
          Date.parse("2026-09-07"),
        )
      ).state,
      "active",
    );
  } finally {
    fixture.restore();
  }
});
test("page only requests QR after auth and selection in the authorized assignment list; personal QR shares rendering policy", () => {
  const page = readFileSync("app/dashboard/capogruppo/page.tsx", "utf8");
  assert.ok(
    page.indexOf('auth.dashboardRole !== "capogruppo"') <
      page.indexOf("const selectedQr"),
  );
  assert.match(
    page,
    /assignments.find\(\(assignment\) => assignment.id === params.assignmentId\)/,
  );
  assert.match(page, /selectedAssignment\s*\? await loadLeaderAssignmentQr/);
  assert.match(page, /auth.user.id, currentEventId, selectedAssignment.id/);
  assert.match(
    readFileSync("app/dashboard/partecipante/page.tsx", "utf8"),
    /registrationQrPreview\(qrStatus, participant\)/,
  );
});
