import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

// Execute the page's actual selection, through Supabase's real query builder.
const page = readFileSync(new URL("../app/dashboard/partecipante/page.tsx", import.meta.url), "utf8");
const start = page.indexOf("  const { data: registrationData");
const end = page.indexOf("  const participant = selectedRegistration", start);
assert.ok(start > 0 && end > start);
const body = ts.transpileModule(`async function select(supabase: unknown, auth: unknown, relatedOne: unknown) {${page.slice(start, end)}return selectedRegistration;}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const select = new Function(`${body}; return select;`)();
const rows = [
  ...Array.from({ length: 1100 }, (_, i) => ({ id: `other-${i}`, submitted_at: "2026-09-18", deleted_at: null, events: { is_current: true }, participants: { auth_user_id: `other-${i}` } })),
  { id: "own-old", submitted_at: "2026-06-16", deleted_at: null, events: { is_current: true }, participants: { auth_user_id: "self" } },
  { id: "own-deleted", submitted_at: "2026-09-20", deleted_at: "2026-09-20", events: { is_current: true }, participants: { auth_user_id: "self" } },
  { id: "own-other-event", submitted_at: "2026-09-20", deleted_at: null, events: { is_current: false }, participants: { auth_user_id: "self" } },
];

for (const role of ["admin", "admin+manager", "partecipante"]) {
  test(`personal registration survives 1,000-row cap for ${role}`, async () => {
    const db = createClient("https://example.test", "test", { global: { fetch: async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get("participants.auth_user_id"), "eq.self");
      assert.equal(url.searchParams.get("limit"), "1");
      assert.equal(url.searchParams.get("order"), "submitted_at.desc,id.desc");
      assert.match(url.searchParams.get("select")!, /participants!inner/);
      let visible = role === "partecipante" ? rows.filter(r => r.participants.auth_user_id === "self") : rows;
      if (url.searchParams.get("deleted_at") === "is.null") visible = visible.filter(r => r.deleted_at === null);
      if (url.searchParams.get("events.is_current") === "eq.true") visible = visible.filter(r => r.events.is_current);
      const user = url.searchParams.get("participants.auth_user_id")?.slice(3);
      if (user) visible = visible.filter(r => r.participants.auth_user_id === user);
      return new Response(JSON.stringify(visible.slice(0, Math.min(1000, Number(url.searchParams.get("limit") || 1000)))));
    } } });
    const result = await select(db, { user: { id: "self" } }, (value: unknown) => value);
    assert.equal(result.id, "own-old");
  });
}

test("no registration remains empty; a foreign row cannot become the personal registration", async () => {
  for (const response of [[], [rows[0]]]) {
    const db = createClient("https://example.test", "test", { global: { fetch: async () => new Response(JSON.stringify(response)) } });
    assert.equal(await select(db, { user: { id: "self" } }, (v: unknown) => v), null);
  }
});

test("database failures are not presented as a missing registration", async () => {
  const db = createClient("https://example.test", "test", { global: { fetch: async () => new Response(JSON.stringify({ message: "database unavailable" }), { status: 500 }) } });
  await assert.rejects(select(db, { user: { id: "self" } }, (v: unknown) => v), /Unable to load personal registration/);
});
