import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as forms from "../lib/forms/result.ts";
import { parseRegistrationForm, normalizeEmail, optionalText } from "../lib/registrations/validation.ts";
import { parseManualRegistrationForm, validateManualRegistrationInput } from "../lib/registrations/manual-registration.ts";

function data() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    groupId: "11111111-1111-4111-8111-111111111111", firstName: "Test", lastName: "Person",
    email: "synthetic@example.test", emailConfirmation: "synthetic@example.test", birthDate: "1990-01-02",
    birthPlace: "Roma", nationality: "Italian (Italy)", countryOther: "Italia", cityOther: "Roma",
    hasAccessibilityNeeds: "no", hasPreviousSantegidioParticipation: "no", availabilityUnknown: "on",
    privacyAccepted: "on", consentConfirmed: "on",
  })) form.set(key, value);
  return form;
}
const invalidDates = [null, "", "   ", "invalid", "2026-02-30", "2100-02-29", "2999-01-01"];
for (const path of ["public", "group-link", "leader", "leader-delegate"]) {
  test(`${path} requires an actual, nonfuture birth date, including requests without the field`, () => {
    const form = data();
    if (path === "group-link") form.set("groupRegistrationLinkToken", "synthetic-link");
    if (path === "leader-delegate") form.set("useLeaderEmail", "on");
    const parse = path.startsWith("leader") ? parseManualRegistrationForm : parseRegistrationForm;
    assert.equal(parse(form).ok, true);
    for (const date of invalidDates) {
      if (date === null) form.delete("birthDate"); else form.set("birthDate", date);
      const result = parse(form);
      assert.equal(result.ok, false, String(date));
      if (!result.ok) assert.ok(result.errors.some(error => /data di nascita/.test(error)));
    }
    for (const date of ["2000-02-29", new Date().toISOString().slice(0, 10)]) {
      form.set("birthDate", date);
      assert.equal(parse(form).ok, true);
    }
  });
}

test("manual input validation itself cannot accept a missing date", () => {
  const parsed = parseManualRegistrationForm(data());
  assert.ok(parsed.ok);
  for (const birthDate of [null, "", "2026-02-30", "2999-01-01"]) {
    assert.ok(validateManualRegistrationInput({ ...parsed.value, birthDate }).some(error => /nascita/.test(error)));
  }
});

const source = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
function action(name: string) {
  const ast = ts.createSourceFile("actions.ts", source, ts.ScriptTarget.Latest, true);
  const node = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!;
  const code = ts.transpileModule(node.getText(ast).replace("export async", "async"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const forbidden = () => { throw new Error("Invalid dates must stop before Auth, database access or email"); };
  const deps = { ...forms, parseManualRegistrationForm, normalizeEmail, optionalText,
    normalizeDateOnly: (value: unknown) => value || null,
    normalizeGroupLeaderContactPhone: (value: unknown) => value || null,
    createSupabaseServerClient: forbidden, createSupabaseServiceClient: forbidden };
  return new Function(...Object.keys(deps), `${code}; return ${name};`)(...Object.values(deps));
}
for (const name of ["createGroupLeaderManualRegistration", "updateGroupLeaderParticipantContact"]) {
  test(`${name} stops missing birth dates before side effects`, async () => {
    const save = action(name);
    for (const date of invalidDates) {
      const form = data();
      form.set("assignmentId", "assignment"); form.set("participantId", "participant");
      if (date === null) form.delete("birthDate"); else form.set("birthDate", date);
      const result = await save(form);
      assert.equal(result.status, "error");
      assert.ok(result.issues.some((issue: forms.FormIssue) => issue.field?.startsWith("birthDate")));
    }
  });
}

test("partial contact updates may omit birth date but never explicitly empty it", () => {
  const form = new FormData(); form.set("phone", "+393331234567");
  assert.deepEqual(forms.validateContactFields(form), []);
  for (const date of ["", "   ", "2026-02-30", "2999-01-01"]) {
    form.set("birthDate", date);
    assert.deepEqual(forms.validateContactFields(form), [{ field: "birthDate", code: "date" }]);
  }
});

for (const parse of [parseRegistrationForm, parseManualRegistrationForm]) {
  test(`${parse.name} accepts valid dates under one year without a confirmation`, () => {
    const form = data();
    for (const date of [new Date().toISOString().slice(0, 10), new Date(Date.now() - 86400000).toISOString().slice(0, 10)]) {
      form.set("birthDate", date);
      assert.equal(parse(form).ok, true);
      assert.deepEqual(forms.validateContactFields(form), []);
    }
  });
}

test("newborn accompanying children remain valid", () => {
  const form = data();
  form.set("participatesWithChildren", "yes"); form.set("childrenCount", "1");
  form.set("child_0_firstName", "Newborn"); form.set("child_0_lastName", "Child");
  form.set("child_0_birthDate", new Date().toISOString().slice(0, 10));
  assert.equal(parseRegistrationForm(form).ok, true);
  assert.equal(parseManualRegistrationForm(form).ok, true);
});
