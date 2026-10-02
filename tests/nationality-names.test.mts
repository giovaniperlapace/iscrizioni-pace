import assert from "node:assert/strict";
import test from "node:test";
import { nationalityName } from "../lib/registrations/nationality-names.ts";
import { NATIONALITY_OPTIONS } from "../lib/questionnaire/registration.ts";
import { countryCode } from "../lib/registrations/country-names.ts";

test("nationalities preserve canonical values and localize historical full and short labels", () => {
  assert.equal(nationalityName("Italian (Italy)", "it"), "Italia");
  assert.equal(nationalityName("Italian", "fr"), "Italie");
  assert.equal(nationalityName("German (Germany)", "it"), "Germania");
  assert.equal(nationalityName("German (Germany)", "de"), "Deutschland");
  assert.equal(nationalityName("Congo (custom historical value)", "it"), "Congo (custom historical value)");
  assert.equal(nationalityName(null), null);
  for (const value of NATIONALITY_OPTIONS) assert.ok(countryCode(nationalityName(value, "en")), value);
});
