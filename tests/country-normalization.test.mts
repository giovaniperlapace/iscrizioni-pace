import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { countryCode, countryName, findCountryId } from "../lib/registrations/country-names.ts";
import { participantGeography } from "../lib/registrations/geography.ts";
import { loadAllRows } from "../lib/supabase/all-rows.ts";
import { parseRegistrationForm } from "../lib/registrations/validation.ts";
import { SUPPORTED_LOCALES } from "../lib/i18n/config.ts";
import { EUROPEAN_COUNTRIES } from "../lib/questionnaire/registration.ts";

const spain = { id: "spain-id", iso2: "ES", name_it: "Spagna", name_en: "Spain" };

test("Spain variants have one identity, canonical label and localized labels", () => {
  const labels = ["Spagna", "Spain", "Espagne", "Spanien", "España", "Spanje", "Іспанія"];
  for (const name of [...labels, " Espana ", "ESPAÑA"]) {
    assert.equal(countryCode(name), "ES");
    assert.equal(countryName(name), "Spagna");
    assert.equal(findCountryId([spain], name), spain.id);
  }
  SUPPORTED_LOCALES.forEach((locale, i) => assert.equal(countryName("Spagna", locale), labels[i]));
});

test("all existing European choices retain their canonical labels", () => {
  for (const name of EUROPEAN_COUNTRIES) {
    assert.ok(countryCode(name), name);
    assert.equal(countryName(name), name);
  }
});

test("outside-catalogue countries remain valid without inventing catalogue IDs", () => {
  assert.equal(countryCode("Malawi"), "MW");
  assert.equal(countryName("Brasil"), "Brasile");
  assert.equal(findCountryId([spain], "Malawi"), null);
  assert.equal(findCountryId([{ id: "legacy", name_it: "Spagna", name_en: "Spain" }], "España"), "legacy");
});

test("no fuzzy matches, guessed ISO inputs or ambiguous catalogue matches", () => {
  for (const name of ["Espagna", "Roma", "RM", "EU", "ES", "Guinea?", "Atlantide"]) {
    assert.equal(countryCode(name), null);
    assert.equal(countryName(name), name);
    assert.equal(findCountryId([spain], name), null);
  }
  assert.equal(countryName("  "), null);
  assert.equal(findCountryId([spain, { ...spain, id: "duplicate" }], "España"), null);
  assert.equal(findCountryId([{ ...spain, iso2: "IT" }], "España"), null);
  assert.notEqual(countryCode("Guinea"), countryCode("Guinea-Bissau"));
  assert.notEqual(countryCode("Congo-Brazzaville"), countryCode("Congo-Kinshasa"));
});

test("historic text is normalized for lists/export/statistics and keeps precedence over old links", () => {
  assert.equal(participantGeography({ country_other: "España", countries: null }).country, "Spagna");
  assert.equal(participantGeography({ country_other: "España", countries: { name_it: "Italia" } }).country, "Spagna");
  assert.equal(participantGeography({ country_other: "Valore storico", countries: { name_it: "Italia" } }).country, "Valore storico");
  assert.equal(participantGeography({ countries: [{ name_it: "Spain" }] }).country, "Spagna");
});

test("public parser canonicalizes accepted country names", () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    email: "synthetic@example.org", firstName: "Test", lastName: "Persona", birthDate: "1990-01-02",
    birthPlace: "Madrid", nationality: "Spanish (Spain)", cityOther: "Madrid", countryOther: "España",
    hasAccessibilityNeeds: "no", hasPreviousSantegidioParticipation: "no", availabilityUnknown: "on", privacyAccepted: "on",
  })) form.set(key, value);
  const parsed = parseRegistrationForm(form);
  assert.ok(parsed.ok);
  assert.equal(parsed.value.countryOther, "Spagna");
});

function loadFunction(name: string, deps: Record<string, unknown>) {
  const path = "../lib/registrations/public-flow.ts";
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(fn);
  const js = ts.transpileModule(fn.getText(ast).replace(/^export /, ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return new Function(...Object.keys(deps), `${js}; return ${name};`)(...Object.values(deps));
}
const findCountryIdByName = loadFunction("findCountryIdByName", { loadAllRows, findCountryId });
const resolveParticipantGeography = loadFunction("resolveParticipantGeography", {
  findCountryIdByName, findCityIdByName: async () => null,
});
const create = loadFunction("createPublicRegistration", {
  getCurrentPublicEvent: async () => ({ id: "event" }),
  hasExistingRegistrationForEmail: async () => false,
  resolveActiveGroupRegistrationLink: async () => null,
  resolveParticipantGeography, countryName,
});
function fixture(fail = false) {
  const writes: Record<string, unknown>[] = [];
  const stop = new Error("stop after participant insert");
  const db = createClient("https://database.example.test", "synthetic", {
    auth: { persistSession: false },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/countries")) {
        assert.equal(url.searchParams.get("is_active"), "eq.true");
        assert.equal(url.searchParams.get("order"), "id.asc");
        if (fail) return Response.json({ message: "catalogue unavailable" }, { status: 500 });
        return Response.json([spain]);
      }
      assert.ok(url.pathname.endsWith("/participants"));
      writes.push(JSON.parse(String(init?.body)));
      return Response.json({ message: stop.message }, { status: 400 });
    } },
  });
  return { db, writes };
}

test("public save links Spanish text to ES and stores the canonical name", async () => {
  const { db, writes } = fixture();
  await assert.rejects(create(db, { countryId: null, countryOther: "España" }, {}, "https://example.test"),
    (error: unknown) => (error as { message: string }).message === "stop after participant insert");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].country_id, spain.id);
  assert.equal(writes[0].country_other, "Spagna");
});

test("catalogue failure stops registration before any write", async () => {
  const { db, writes } = fixture(true);
  await assert.rejects(create(db, { countryId: null, countryOther: "España" }, {}, "https://example.test"), /catalogue unavailable/);
  assert.deepEqual(writes, []);
});
