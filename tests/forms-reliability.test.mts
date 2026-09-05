import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { formFailureFromRedirect, issueFromMessage, validateContactFields } from "../lib/forms/result.ts";
import { FORM_COPY } from "../lib/forms/copy.ts";
import { parseManualRegistrationForm, buildManualRegistrationQuestionnaireAnswers } from "../lib/registrations/manual-registration.ts";
import { parseParticipantDashboardUpdate } from "../lib/registrations/participant-dashboard.ts";

function manualData() {
  const data = new FormData();
  for (const [key, value] of Object.entries({ groupId: "11111111-1111-4111-8111-111111111111", firstName: "Test", lastName: "Persona", phone: "+39 333 1234567", availabilityUnknown: "on", consentConfirmed: "on" })) data.set(key, value);
  return data;
}

test("contacts reject missing international prefixes but preserve valid international formatting", () => {
  const data = manualData();
  assert.deepEqual(validateContactFields(data), []);
  data.set("phone", "3331234567");
  assert.deepEqual(validateContactFields(data), [{ field: "phone", code: "phone" }]);
  assert.equal(parseManualRegistrationForm(data).ok, false);
  data.set("phone", "+33 (6) 12-34-56-78");
  assert.equal(parseManualRegistrationForm(data).ok, true);
  data.set("email", "invalid@");
  assert.equal(parseManualRegistrationForm(data).ok, false);
});

test("manual entry rejects impossible and future birth dates before writing", () => {
  const data = manualData();
  for (const date of ["2026-02-30", "3000-01-01", "invalid"]) {
    data.set("birthDate", date);
    assert.equal(parseManualRegistrationForm(data).ok, false, date);
  }
  const source = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8").split("export async function createGroupLeaderManualRegistration")[1]!.split("export async function createGroupRegistrationLink")[0]!;
  assert.ok(source.indexOf('manualError=invalid-days') < source.indexOf('.from("participants")'));
});

test("validation identifies nested child fields and safe localized server errors", () => {
  assert.deepEqual(issueFromMessage("Inserisci una data di nascita valida per il figlio 2."), { field: "child_1_birthDate", code: "date" });
  assert.deepEqual(formFailureFromRedirect("/dashboard/capogruppo?manualError=duplicate-email"), { status: "error", issues: [{ field: "email", code: "duplicateEmail" }] });
  assert.deepEqual(formFailureFromRedirect("/dashboard/admin?adminError=SQL%20DETAIL%20secret"), { status: "error", issues: [{ field: null, code: "failed" }] });
  for (const copy of Object.values(FORM_COPY)) for (const code of ["phone", "contact", "date", "duplicateEmail", "summary", "failed"] as const) assert.ok(copy[code]);
});

test("retired manual values are ignored even when sent by a stale client", () => {
  const data = manualData();
  data.set("accessibilityNotes", "SYNTHETIC RETIRED VALUE");
  data.set("needsOperationalSupport", "on");
  data.set("hasAccessibilityNeeds", "yes");
  data.set("accessibility_hearing", "on");
  const parsed = parseManualRegistrationForm(data);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  const snapshot = buildManualRegistrationQuestionnaireAnswers(parsed.value, { id: parsed.value.groupId, name: "Test" });
  assert.deepEqual(snapshot.accessibility, { hasAccessibilityNeeds: true, washingtonGroupAnswers: { hearing: true } });
  assert.ok(!JSON.stringify(parsed.value).includes("SYNTHETIC RETIRED VALUE"));
  data.set("hasAccessibilityNeeds", "no");
  const noNeeds = parseManualRegistrationForm(data);
  assert.ok(noNeeds.ok);
  if (noNeeds.ok) assert.deepEqual(noNeeds.value.accessibilityAnswers, {});
});

test("participant editing cannot smuggle additional accessibility fields", () => {
  const data = manualData();
  data.set("registrationId", "11111111-1111-4111-8111-111111111111");
  data.set("hasAccessibilityNeeds", "on");
  data.set("accessibility_hearing", "on");
  data.set("accessibility_privateText", "on");
  data.set("accessibilityNotes", "SYNTHETIC RETIRED VALUE");
  const parsed = parseParticipantDashboardUpdate(data);
  assert.ok(parsed.ok);
  if (parsed.ok) {
    assert.deepEqual(parsed.value.accessibilityAnswers, { hearing: true });
    assert.ok(!JSON.stringify(parsed.value).includes("SYNTHETIC RETIRED VALUE"));
  }
});

test("legacy browser drafts lose only the retired field and keep other values", async () => {
  const { migratePublicRegistrationDrafts } = await import("../lib/forms/public-draft.ts");
  const entries: Record<string, string> = {
    "iscrizioni-pace.registration-form:one@example.org": JSON.stringify({ savedAt: 5, fields: { firstName: ["Test"], accessibilityNotes: ["SYNTHETIC RETIRED VALUE"], accessibility_hearing: ["on"] } }),
    "iscrizioni-pace.registration-form:two@example.org": JSON.stringify({ savedAt: 5, fields: { phone: ["+393331234567"], accessibilityNotes: ["SYNTHETIC RETIRED VALUE"] } }),
  };
  const storage = Object.assign(entries, {});
  Object.defineProperties(storage, {
    getItem: { value: (key: string) => entries[key] ?? null },
    setItem: { value: (key: string, value: string) => { entries[key] = value; } },
    removeItem: { value: (key: string) => { delete entries[key]; } },
  });
  migratePublicRegistrationDrafts(storage as unknown as Storage);
  assert.ok(!JSON.stringify(entries).includes("SYNTHETIC RETIRED VALUE"));
  const first = JSON.parse(entries["iscrizioni-pace.registration-form-v2:one@example.org"]!);
  assert.deepEqual(first.fields, { firstName: ["Test"], accessibility_hearing: ["on"] });
  assert.equal(Object.keys(entries).length, 2);
});
