import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadAssociationStatistics } from "../lib/registrations/association-statistics.server.ts";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const event = id(9000);
function fixture({ fail = "", empty = false, removed = false } = {}) {
  const calls: URL[] = [];
  const db = createClient("https://synthetic.example.test", "test", { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(String(input)); calls.push(url);
    const table = url.pathname.split("/").at(-1)!;
    const start = Number(url.searchParams.get("offset") ?? 0);
    const size = Number(url.searchParams.get("limit") ?? 500);
    if (table === fail && (table !== "registrations" || start > 0)) return Response.json({ message: "synthetic failure" }, { status: 400 });
    const ids = url.searchParams.get(table === "registrations" ? "id" : "registration_id")?.slice(4, -1).split(",") ?? [];
    let rows: unknown[] = [];
    if (table === "registrations") {
      assert.equal(url.searchParams.get("event_id"), `eq.${event}`);
      assert.equal(url.searchParams.get("deleted_at"), "is.null");
      rows = url.searchParams.get("select") === "id" ? Array.from({ length: 1002 }, (_, i) => ({ id: id(i) }))
        : ids.filter(value => !removed || value !== id(1001)).map(value => ({ id: value, participants: value === id(1000) ? null : { first_name: "Persona", last_name: value.slice(-4) } }));
    } else if (table === "registration_questionnaire_answers") {
      assert.equal(url.searchParams.get("event_id"), `eq.${event}`);
      assert.equal(url.searchParams.get("select"), "registration_id,association:answers->externalGroupAssociation");
      assert.equal(url.searchParams.get("order"), "created_at.desc,id.desc");
      rows = ids.flatMap(value => [{ registration_id: value, association: empty ? null : value === id(0) ? "  Associazione A\nTesto originale  " : value === id(1) ? " \n " : value === id(2) ? true : value === id(3) ? ["Associazione"] : value === id(4) ? null : "Associazione B" },
        // Older questionnaires must never duplicate people or restore an empty answer.
        ...Array.from({ length: 6 }, () => ({ registration_id: value, association: "Risposta precedente" }))]);
    } else if (table === "event_attendance_choices") {
      rows = ids.flatMap<unknown>(value => value === id(0) ? [
        { registration_id: value, day: "2026-10-24", day_part: null, choice: "yes" },
        { registration_id: value, day: "2026-10-25", day_part: "morning", choice: "yes" },
        { registration_id: value, day: "2026-10-25", day_part: "morning", choice: "yes" },
        { registration_id: value, day: "2026-10-30", day_part: "morning", choice: "yes" },
      ] : value === id(5) ? [{ registration_id: value, day: null, day_part: null, choice: "unknown" }]
        : value === id(6) ? [{ registration_id: value, day: "2026-10-25", day_part: "morning", choice: "no" }] : []);
    } else throw Error(`Unexpected source ${table}`);
    return Response.json(rows.slice(start, start + size));
  } } });
  return { db, calls };
}
const load = (db: Parameters<typeof loadAssociationStatistics>[0]) => loadAssociationStatistics(db, event, "2026-10-25", "2026-10-27");

test("association count uses latest nonblank string once per active registration, across all pages and batches", async () => {
  const { db, calls } = fixture();
  const { people } = await load(db);
  assert.equal(people.length, 998);
  assert.equal(new Set(people.map(p => p.registrationId)).size, 998);
  assert.equal(people.find(p => p.registrationId === id(0))!.association, "Associazione A\nTesto originale");
  assert.equal(people.find(p => p.registrationId === id(1000))!.name, "Nome non disponibile");
  assert.ok(people.some(p => p.registrationId === id(1001)));
  assert.equal(calls.filter(u => u.pathname.endsWith("/registrations") && u.searchParams.get("select") === "id").length, 3);
  assert.ok(calls.some(u => u.pathname.endsWith("/registration_questionnaire_answers") && u.searchParams.get("offset") === "500"));
  assert.ok(calls.every(u => !u.search.includes("registration_children") && !u.search.includes("answers%2C")));
  assert.ok(calls.filter(u => u.searchParams.has("registration_id")).every(u => u.searchParams.get("registration_id")!.slice(4, -1).split(",").length <= 100));
});
test("attendance uses declared event slots, arrival afternoon, no duplicate slots, and unknown stays explicit", async () => {
  const { people } = await load(fixture().db);
  assert.equal(people.find(p => p.registrationId === id(0))!.attendance, "24 ott 2026 (Pomeriggio); 25 ott 2026 (Mattina)");
  assert.equal(people.find(p => p.registrationId === id(5))!.attendance, "Da comunicare");
  assert.equal(people.find(p => p.registrationId === id(6))!.attendance, "Nessuna presenza prevista");
  assert.equal(people.find(p => p.registrationId === id(7))!.attendance, "Da comunicare");
});
test("empty declarations skip names and attendance; concurrent deletion is excluded", async () => {
  const { db, calls } = fixture({ empty: true });
  assert.deepEqual(await load(db), { people: [] });
  assert.ok(!calls.some(u => u.pathname.endsWith("/event_attendance_choices")));
  assert.ok(calls.filter(u => u.pathname.endsWith("/registrations")).every(u => u.searchParams.get("select") === "id"));
  assert.equal((await load(fixture({ removed: true }).db)).people.length, 997);
});
for (const fail of ["registrations", "registration_questionnaire_answers", "event_attendance_choices"]) test(`failed ${fail} reads never become partial counts`, async () => {
  await assert.rejects(load(fixture({ fail }).db), /synthetic failure/);
});
