import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import * as forms from "../lib/forms/result.ts";
import { optionalText, normalizeEmail } from "../lib/registrations/validation.ts";
import { leaderReturnPath } from "../lib/groups/leader-table.ts";
const source = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
const action = source.slice(source.indexOf("export async function updateGroupLeaderParticipantContact("), source.indexOf("export async function createOperationalTag("));
const helpers = source.slice(source.indexOf("function normalizeGroupLeaderContactPhone("));
const compiled = ts.transpileModule(action.replace("export async", "async") + helpers, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
for (const allowed of [true, false]) test(`leader contact save respects assignment scope: ${allowed}`, async () => {
  const writes: Array<{ table: string; body: unknown }> = [];
  const db = createClient("https://example.test", "test", { global: { fetch: async (input, init) => {
    const table = new URL(String(input)).pathname.split("/").pop()!;
    if (init?.method !== "GET") {
      writes.push({ table, body: JSON.parse(String(init?.body)) });
      return new Response(null, { status: 204 });
    }
    return new Response(JSON.stringify([{ id: "contact" }]));
  } } });
  const deps = { ...forms, optionalText, normalizeEmail, leaderReturnPath,
    createSupabaseServerClient: async () => db, createSupabaseServiceClient: () => db,
    getCurrentAuthContext: async () => ({ user: { id: "leader" }, dashboardRole: "capogruppo" }),
    getCurrentOperationalEventId: async () => "event",
    canGroupLeaderTagParticipant: async (_db: unknown, user: string, participant: string, event: string, assignment: string) => {
      assert.deepEqual([user, participant, event, assignment], ["leader", "participant", "event", "assignment"]); return allowed;
    },
    revalidatePath: () => {}, redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
  };
  const save = new Function(...Object.keys(deps), `${compiled}; return updateGroupLeaderParticipantContact;`)(...Object.values(deps));
  const data = new FormData();
  for (const [key, value] of Object.entries({ assignmentId: "assignment", participantId: "participant", firstName: "Updated", lastName: "Person", birthDate: "1985-02-16", city: "Roma", country: "Italia", phone: "+393331234567" })) data.set(key, value);
  if (allowed) {
    await assert.rejects(save(data), /REDIRECT:/);
    assert.deepEqual(writes.find(w => w.table === "participants")?.body, { first_name: "Updated", last_name: "Person", birth_date: "1985-02-16", city_other: "Roma", country_other: "Italia" });
    assert.ok(writes.some(w => w.table === "participant_contacts"));
  } else {
    assert.equal((await save(data)).status, "error");
    assert.deepEqual(writes, []);
  }
});
