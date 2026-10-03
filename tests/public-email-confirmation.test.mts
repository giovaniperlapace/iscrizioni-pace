import assert from "node:assert/strict";
import test from "node:test";
import { parseRegistrationForm } from "../lib/registrations/validation.ts";

function form(token = "") {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    email: "parent@example.org", emailConfirmation: "parent@example.org",
    firstName: "Maria", lastName: "Rossi", birthDate: "1990-01-02",
    birthPlace: "Roma", nationality: "Italian (Italy)", countryOther: "Italia",
    cityOther: "Roma", hasAccessibilityNeeds: "no",
    hasPreviousSantegidioParticipation: "no", availabilityUnknown: "on",
    privacyAccepted: "on", groupRegistrationLinkToken: token,
  })) data.set(key, value);
  return data;
}
for (const token of ["", "group-link"]) {
  test(`email confirmation is required and never included in saved input (${token || "public"})`, () => {
    const data = form(token);
    for (const value of ["", "typo@example.org"]) {
      data.set("emailConfirmation", value);
      const result = parseRegistrationForm(data);
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.errors[0], /email.*coincidere/);
    }
    data.delete("emailConfirmation");
    assert.equal(parseRegistrationForm(data).ok, false);
    data.set("emailConfirmation", " PARENT@Example.org ");
    const result = parseRegistrationForm(data);
    assert.ok(result.ok);
    assert.equal(result.value.email, "parent@example.org");
    assert.equal("emailConfirmation" in result.value, false);
    assert.equal(result.value.groupRegistrationLinkToken, token || null);
    // Editing the original address invalidates a previously matching confirmation.
    data.set("email", "changed@example.org");
    assert.equal(parseRegistrationForm(data).ok, false);
  });
}
