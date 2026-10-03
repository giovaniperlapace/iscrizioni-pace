import assert from "node:assert/strict";
import test from "node:test";
import { isCountryName } from "../lib/registrations/country-validation.ts";
import { EUROPEAN_COUNTRIES } from "../lib/questionnaire/registration.ts";
import { parseRegistrationForm } from "../lib/registrations/validation.ts";

test("country validation includes all existing options and countries outside Europe in supported languages", () => {
  for (const name of [...EUROPEAN_COUNTRIES, "Malawi", "Camerun", "Côte d’Ivoire", "United States", "Brasil", "  italia  ", "Deutschland", "Nederland", "Україна", "Czech Republic", "Italia"]) assert.ok(isCountryName(name), name);
  for (const name of ["Roma", "RM", "Milano", "EU", "Atlantide", "", "Altro / non in lista"]) assert.equal(isCountryName(name), false, name);
});

test("public form rejects a city/province as country before any database write", () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    email: "synthetic@example.org", firstName: "Test", lastName: "Persona", birthDate: "1990-01-02", birthPlace: "Italia, Roma", nationality: "Italian (Italy)", cityOther: "Roma", hasAccessibilityNeeds: "no", hasPreviousSantegidioParticipation: "no", availabilityUnknown: "on", privacyAccepted: "on",
  })) data.set(key, value);
  for (const country of ["RM", "Roma", "Italia", "Malawi"]) {
    data.set("countryOther", country);
    data.set("emailConfirmation", String(data.get("email") ?? ""));
    const parsed = parseRegistrationForm(data);
    assert.equal(parsed.ok, ["Italia", "Malawi"].includes(country));
    if (!parsed.ok) assert.ok(parsed.errors.some(error => error.includes("paese valido")));
  }
});
