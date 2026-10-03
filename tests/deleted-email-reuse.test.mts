import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import * as identity from "../lib/registrations/email-identity.ts";
import * as loaders from "../lib/supabase/all-rows.ts";
import { syncOperationalIdentityByEmail } from "../lib/operational-users/identity.ts";

type Row = Record<string, unknown>;
function database(tables: Record<string, Row[]>, failTable = "") {
  return createClient("https://db.example.test", "test", { auth: { persistSession: false }, global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    assert.ok(url.toString().length < 8000);
    const table = url.pathname.split("/").at(-1)!;
    if (table === failTable) return Response.json({ message: "lookup failed" }, { status: 400 });
    let rows = tables[table] ?? [];
    for (const [key, value] of url.searchParams) {
      if (value.startsWith("in.(")) rows = rows.filter(r => value.slice(4, -1).split(",").includes(String(r[key])));
      if (value.startsWith("eq.")) rows = rows.filter(r => String(r[key]) === value.slice(3));
      if (value.startsWith("neq.")) rows = rows.filter(r => String(r[key]) !== value.slice(4));
      if (value === "is.null") rows = rows.filter(r => r[key] === null);
    }
    if (init?.method === "PATCH") {
      for (const row of rows) Object.assign(row, JSON.parse(String(init.body)));
      return new Response(null, { status: 204 });
    }
    const from = Number(url.searchParams.get("offset"));
    return Response.json(rows.slice(from, from + Number(url.searchParams.get("limit") ?? 1000)));
  } } });
}
function load(name: string) {
  const source = readFileSync("lib/registrations/public-flow.ts", "utf8");
  const ast = ts.createSourceFile("test.ts", source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
  const deps = { ...identity, ...loaders };
  const js = ts.transpileModule(fn.getText(ast).replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(deps), `${js}; return ${name}`)(...Object.values(deps));
}
const check = load("hasExistingRegistrationForEmail");
const link = load("linkParticipantsToUserByEmail");
const email = "reuse@example.test";
function fixture() {
  return {
    participants: [{ id: "old", first_name: "Old", last_name: "Person", auth_user_id: null }, { id: "new", first_name: "New", last_name: "Person", auth_user_id: null }],
    participant_contacts: [{ id: "c1", participant_id: "old", email }, { id: "c2", participant_id: "new", email }],
    registrations: [{ id: "r1", participant_id: "old", event_id: "event", status: "submitted", deleted_at: "2026-09-22" }],
    profiles: [{ id: "account", email, full_name: "Old Person" }],
  };
}
test("deleted email is free, active registration blocks, other events and cancellation do not", async () => {
  const tables = fixture(), db = database(tables);
  assert.equal(await check(db, email, "event"), false);
  tables.registrations.push({ id: "r2", participant_id: "new", event_id: "event", status: "submitted", deleted_at: null as never });
  assert.equal(await check(db, email, "event"), true);
  assert.equal(await check(db, email, "other"), false);
  tables.registrations[1].status = "cancelled";
  assert.equal(await check(db, email, "event"), false);
});
test("registration synchronization and login never overwrite or relink deleted history", async () => {
  const tables = fixture(), db = database(tables);
  const historical = { ...tables.participants[0] };
  await syncOperationalIdentityByEmail(db, { email, firstName: "Different", lastName: "Identity", userId: "account", participantId: "new" });
  await link(db, "account", email);
  assert.deepEqual(tables.participants[0], historical);
  assert.equal(tables.participants[1].first_name, "Different");
  assert.equal(tables.participants[1].auth_user_id, "account");
});
test("people still registered elsewhere and unregistered operational identities remain eligible", async () => {
  const tables = fixture();
  tables.registrations.push({ id: "r2", participant_id: "old", event_id: "other", status: "submitted", deleted_at: null as never });
  assert.deepEqual(await identity.reusableIdentityParticipantIds(database(tables), ["old", "new"]), ["old", "new"]);
});
test("lookup covers more than 1000 old email contacts and fails closed on errors", async () => {
  const tables: Record<string, Row[]> = { participant_contacts: [], registrations: [] };
  for (let i = 0; i < 1205; i++) {
    tables.participant_contacts.push({ id: `c${i}`, participant_id: `p${i}`, email });
    tables.registrations.push({ id: `r${i}`, participant_id: `p${i}`, event_id: "event", status: "submitted", deleted_at: i === 1204 ? null : "deleted" });
  }
  assert.equal(await check(database(tables), email, "event"), true);
  for (const table of ["participant_contacts", "registrations"]) {
    await assert.rejects(check(database(tables, table), email, "event"), /lookup failed/);
  }
});
