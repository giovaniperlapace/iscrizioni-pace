import assert from "node:assert/strict";
import test from "node:test";
import { parseRegistrationForm } from "../lib/registrations/validation.ts";
import { buildRegistrationQuestionnaireAnswers, REGISTRATION_QUESTIONS } from "../lib/questionnaire/registration.ts";
function form(previous: string, withGroup: string) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    email: "synthetic@example.org", firstName: "Test", lastName: "Persona",
    birthDate: "1990-01-02", birthPlace: "Italia, Roma", nationality: "Italian (Italy)",
    countryOther: "Italia", cityOther: "Roma", hasAccessibilityNeeds: "no",
    hasPreviousSantegidioParticipation: previous, participatesWithGroup: withGroup,
    externalGroupAssociation: "Associazione di prova", availabilityUnknown: "on",
    privacyAccepted: "on", dataProcessingAccepted: "on",
    groupId: "11111111-1111-4111-8111-111111111111",
  })) data.set(key, value);
  return data;
}
for (const previous of ["yes", "no"]) {
  for (const withGroup of ["yes", "no"]) {
    test(`independent answers previous=${previous}, group=${withGroup}`, () => {
      const parsed = parseRegistrationForm(form(previous, withGroup));
      assert.ok(parsed.ok);
      const snapshot = buildRegistrationQuestionnaireAnswers(parsed.value);
      assert.equal(snapshot.previousSantegidioParticipation, previous === "yes");
      assert.equal(snapshot.groupParticipation.participatesWithGroup, withGroup === "yes");
      assert.equal(snapshot.externalGroupAssociation, withGroup === "no" ? "Associazione di prova" : null);
      assert.equal(parsed.value.groupId !== null, withGroup === "yes");
    });
  }
  test(`group answer required independently of previous=${previous}`, () => {
    const result = parseRegistrationForm(form(previous, ""));
    assert.ok(!result.ok);
    assert.ok(result.errors.includes("Indica se parteciperai con un gruppo."));
  });
}
test("association is optional and old hidden group values cannot override No", () => {
  const data = form("yes", "no");
  data.delete("externalGroupAssociation");
  data.set("cannotFindLeader", "on");
  const parsed = parseRegistrationForm(data);
  assert.ok(parsed.ok);
  assert.equal(parsed.value.groupId, null);
  assert.equal(parsed.value.cannotFindLeader, false);
  assert.equal(parsed.value.externalGroupAssociation, null);
});
test("questionnaire inventory has all seven translations for changed questions", () => {
  for (const id of ["previous_santegidio_participation", "group_participation", "external_group_association"]) {
    const question = REGISTRATION_QUESTIONS.find(q => q.id === id)!;
    for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"] as const) assert.ok(question.label[locale]);
  }
});
