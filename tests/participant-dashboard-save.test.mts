import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import * as dashboard from "../lib/registrations/participant-dashboard.ts";
import * as forms from "../lib/forms/result.ts";
import * as slots from "../lib/registrations/attendance-slots.ts";
import { toRegistrationChildRows } from "../lib/registrations/registration-children.ts";

// Run the complete production action with the real PostgREST request builder.
const source = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
const action = source.slice(source.indexOf("export async function updateParticipantDashboard("), source.indexOf("export async function updateEventOpeningState("));
const compiled = ts.transpileModule(action.replace("export async", "async"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const registrationId = "11111111-1111-4111-8111-111111111111";
function fixture({ role = "partecipante", array = false, owner = "self", failure = "", closed = false, cancelled = false } = {}) {
  const writes: Array<{ table: string; method: string; body: Record<string, unknown> | null }> = [];
  const invalidated: string[] = [];
  const db = createClient("https://example.test", "test", { global: { fetch: async (input, init) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").pop()!;
    const method = init?.method ?? "GET";
    if (method !== "GET") {
      writes.push({ table, method, body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response(null, { status: 204 });
    }
    if (failure === table) return new Response(JSON.stringify({ code: "42501", message: "Read denied" }), { status: 403 });
    const event = { starts_on: "2026-10-25", ends_on: "2026-10-27", registration_closes_at: closed ? "2000-01-01" : null };
    const participant = { auth_user_id: owner, first_name: "Original", last_name: "Person" };
    const data: Record<string, unknown> = {
      registrations: { id: registrationId, participant_id: "participant", event_id: "event", status: cancelled ? "cancelled" : "submitted", events: array ? [event] : event, participants: array ? [participant] : participant },
      participant_contacts: [{ id: "contact", phone: "+393331234567", is_primary: true }],
      event_attendance_choices: [{ day: "2026-10-25", day_part: "morning", choice: "yes" }],
      moment_attendance_choices: [],
      accessibility_needs: { washington_group_answers: { hearing: true }, needs_operational_support: true },
      registration_children: [{ first_name: "Child", last_name: "Person", birth_date: "2015-01-01", position: 1 }],
    };
    return new Response(JSON.stringify(data[table] ?? []));
  } } });
  const deps = { ...dashboard, ...forms, ...slots, toRegistrationChildRows,
    createSupabaseServerClient: async () => db, createSupabaseServiceClient: () => db,
    getCurrentAuthContext: async () => ({ user: { id: "self" }, dashboardRole: role }),
    relatedOne: (value: unknown) => Array.isArray(value) ? value[0] ?? null : value,
    revalidatePath: (path: string) => invalidated.push(path), redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); },
  };
  const save = new Function(...Object.keys(deps), `${compiled}; return updateParticipantDashboard;`)(...Object.values(deps));
  return { save, writes, invalidated };
}
function data(edit: string) {
  const form = new FormData();
  form.set("registrationId", registrationId);
  form.set("phone", edit === "phone" ? "+393339876543" : "+393331234567");
  form.append("availabilitySlots", edit === "attendance" ? "2026-10-26__afternoon" : "2026-10-25__morning");
  if (edit === "identity") {
    form.set("updatesIdentity", "on"); form.set("firstName", "Updated"); form.set("lastName", "Surname");
  }
  return form;
}
for (const role of ["partecipante", "manager", "admin", "capogruppo"]) {
  for (const edit of ["identity", "phone", "attendance"]) test(`${role} can save own ${edit} with object relations`, async () => {
    const { save, writes, invalidated } = fixture({ role });
    await assert.rejects(save(data(edit)), /REDIRECT:\/dashboard\/partecipante\?saved=1/);
    assert.deepEqual(invalidated, ["/dashboard/partecipante"]);
    assert.ok(writes.some(w => w.table === "audit_logs"));
    if (edit === "identity") assert.deepEqual(writes.find(w => w.table === "participants")?.body, { first_name: "Updated", last_name: "Surname" });
    if (edit === "phone") assert.equal(writes.find(w => w.table === "participant_contacts")?.body?.phone, "+393339876543");
    if (edit === "attendance") assert.deepEqual(writes.find(w => w.table === "event_attendance_choices" && w.method === "POST")?.body, [{ registration_id: registrationId, day: "2026-10-26", day_part: "afternoon", choice: "yes" }]);
    assert.ok(!writes.some(w => w.table === "registration_children"));
    assert.deepEqual(writes.find(w => w.table === "accessibility_needs")?.body?.washington_group_answers, { hearing: true });
  });
}
test("legacy array relations still save", async () => {
  await assert.rejects(fixture({ array: true }).save(data("identity")), /REDIRECT:/);
});
for (const options of [{ owner: "another-user" }, { closed: true }, { cancelled: true }]) test(`personal action rejects ${JSON.stringify(options)} without writes`, async () => {
  const { save, writes } = fixture(options);
  assert.equal((await save(data("identity"))).status, "error");
  assert.deepEqual(writes, []);
});
for (const failure of ["registrations", "participant_contacts", "event_attendance_choices", "moment_attendance_choices", "accessibility_needs", "registration_children"]) test(`failed ${failure} read cannot overwrite saved data`, async () => {
  const { save, writes } = fixture({ failure });
  assert.equal((await save(data("identity"))).status, "error");
  assert.deepEqual(writes, []);
});
test("event dates from object relation reject out-of-range attendance", async () => {
  const { save, writes } = fixture();
  const form = data("attendance"); form.set("availabilitySlots", "2027-01-01__morning");
  assert.equal((await save(form)).status, "error");
  assert.deepEqual(writes, []);
});
