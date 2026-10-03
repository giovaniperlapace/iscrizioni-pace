import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasRecordedEmailDelegation } from "../lib/registrations/email-delegation.ts";
import { loadEmailDelegations } from "../lib/registrations/email-delegation.server.ts";
import { toLeaderTableRow } from "../lib/groups/leader-table.ts";
import type { AssignmentView } from "../lib/groups/leader-assignments.ts";

test("indicator requires a recorded choice, never infers delegation from missing email", () => {
  assert.equal(hasRecordedEmailDelegation({ source: "capogruppo_manual", use_leader_email: true, has_email: false }), true);
  for (const source of ["manager_manual", "admin_manual"]) {
    assert.equal(hasRecordedEmailDelegation({ source, use_leader_email: false, has_email: false }), true);
    assert.equal(hasRecordedEmailDelegation({ source, use_leader_email: false, has_email: true }), false);
  }
  for (const source of [null, "public", "import", "capogruppo_manual", "manager_manual"]) {
    assert.equal(hasRecordedEmailDelegation({ source, use_leader_email: null, has_email: false }), false);
    assert.equal(hasRecordedEmailDelegation({ source, use_leader_email: "true", has_email: false }), false);
  }
});

function database(fail = false) {
  const calls: Array<{ ids: string[]; from: number; to: number }> = [];
  const db = { from(table: string) {
    assert.equal(table, "registration_questionnaire_answers");
    let ids: string[] = [];
    return { select(fields: string) {
      assert.ok(!fields.includes("answers,") && !fields.includes("identity") && !fields.includes("communicationDelegateUserId"));
      return this;
    }, in(field: string, values: string[]) { assert.equal(field, "registration_id"); ids = values; return this; },
    order(field: string) { assert.equal(field, "id"); return this; },
    async range(from: number, to: number) {
      calls.push({ ids, from, to });
      if (fail && ids.includes("r100")) return { data: null, error: { message: "read failed" } };
      return { data: ids.slice(from, to + 1).map(registration_id => ({ registration_id,
        source: "capogruppo_manual", use_leader_email: true, has_email: false })), error: null };
    } };
  } } as unknown as SupabaseClient;
  return { db, calls };
}
test("delegation reads only authorized IDs in bounded batches and fails closed", async () => {
  const { db, calls } = database();
  assert.equal((await loadEmailDelegations(db, [])).size, 0); assert.equal(calls.length, 0);
  const ids = Array.from({ length: 1101 }, (_, i) => `r${i}`);
  const result = await loadEmailDelegations(db, [...ids, ids[0]]);
  assert.deepEqual([...result], ids);
  assert.equal(calls.length, 12); assert.ok(calls.every(call => call.ids.length <= 100 && call.from === 0 && call.to === 499));
  await assert.rejects(loadEmailDelegations(database(true).db, ids), /read failed/);
});
test("leader table mapper preserves the delegation flag independently of personal email", () => {
  const row = toLeaderTableRow({ emailDelegated: true, participantEmail: null, service: null, tags: [], children: [] } as unknown as AssignmentView);
  assert.equal(row.emailDelegated, true); assert.equal(row.participantEmail, null);
});

const require = createRequire(import.meta.url);
const exports: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
new Function("require", "exports", ts.transpileModule(readFileSync(new URL("../components/participant-email-cell.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText)(require, exports);
test("all seven locales distinguish personal email, recorded delegation and unknown contact", () => {
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"]) {
    const render = (email: string | null, delegated?: boolean) => renderToStaticMarkup(createElement(exports.ParticipantEmailCell, { email, delegated, locale }));
    assert.equal(render(null), "—"); assert.equal(render("", false), "—");
    const badge = render(null, true);
    assert.ok(badge.includes(exports.EMAIL_DELEGATION_COPY[locale].label)); assert.ok(badge.includes("<svg"));
    assert.equal(render("personal@example.test", true), "personal@example.test");
  }
});
