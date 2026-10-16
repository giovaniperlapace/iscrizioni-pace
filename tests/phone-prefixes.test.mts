import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as phonePrefixes from "../lib/registrations/phone-prefixes.ts";
import { parseRegistrationForm } from "../lib/registrations/validation.ts";

// Read the actual JSX attribute values: quoted JSX does not unescape backslashes.
function phonePatterns(path: string) {
  const source = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const patterns: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === "pattern") {
      const value = node.initializer;
      if (value && ts.isStringLiteral(value)) patterns.push(value.text);
      else if (value && ts.isJsxExpression(value) && value.expression && ts.isIdentifier(value.expression)) {
        const pattern = phonePrefixes[value.expression.text as keyof typeof phonePrefixes];
        assert.equal(typeof pattern, "string");
        patterns.push(pattern as string);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(patterns.length, 2);
  return patterns.map(pattern => new RegExp(`^(?:${pattern})$`, "v"));
}

for (const path of ["../app/registrazione/registration-form.tsx", "../app/dashboard/capogruppo/manual-phone-fields.tsx"]) {
  test(`${path}: phone inputs accept custom international prefixes and formatted numbers`, () => {
    const [number, prefix] = phonePatterns(path);
    for (const value of ["+1", "+39", "+976", "+234", "+351", "+1234"]) assert.ok(prefix!.test(value), value);
    for (const value of ["976", "+", "+0", "+0976", "+12345", "+97a", "\\976"]) assert.ok(!prefix!.test(value), value);
    for (const value of ["99123456", "9912 3456", "99-12-34-56", "(99) 123456", "99.123456"]) assert.ok(number!.test(value), value);
    for (const value of ["123", "+97699123456", "phone", "9912/3456", "9912\\3456", "123456789012345"]) assert.ok(!number!.test(value), value);
  });
}

test("public registration accepts and normalizes a Mongolian phone number", () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    email: "synthetic@example.invalid", emailConfirmation: "synthetic@example.invalid",
    firstName: "Test", lastName: "Persona", birthDate: "1990-01-02",
    birthPlace: "Mongolia, Ulaanbaatar", nationality: "Mongolian (Mongolia)",
    countryOther: "Mongolia", cityOther: "Ulaanbaatar", phone: "+976 99-12-34-56",
    hasAccessibilityNeeds: "no", hasPreviousSantegidioParticipation: "no",
    participatesWithGroup: "no", availabilityUnknown: "on", privacyAccepted: "on",
  })) data.set(key, value);
  const parsed = parseRegistrationForm(data);
  assert.ok(parsed.ok, JSON.stringify(parsed));
  if (parsed.ok) assert.equal(parsed.value.phone, "+97699123456");
});

test("worldwide phone menu localizes unique country choices and preserves calling codes", () => {
  const expected = { MN: "+976", NG: "+234", US: "+1", CA: "+1", KZ: "+7", RU: "+7", VA: "+39", XK: "+383" };
  for (const locale of ["it", "en", "fr", "de", "es", "nl", "uk"] as const) {
    const options = phonePrefixes.localizedPhonePrefixes(locale);
    assert.equal(options.length, 245);
    assert.equal(new Set(options.map(option => option.selection)).size, options.length);
    for (const option of options) {
      assert.ok(option.label.includes(new Intl.DisplayNames([locale], { type: "region" }).of(option.country)!));
      assert.equal(phonePrefixes.phonePrefixValue(option.selection), option.value);
      assert.equal(phonePrefixes.phonePrefixSelection(option.selection), option.selection);
      assert.match(option.value, /^\+[1-9][0-9]{0,2}$/);
    }
    for (const [country, prefix] of Object.entries(expected)) {
      assert.equal(options.find(option => option.country === country)?.value, prefix);
    }
  }
  assert.equal(phonePrefixes.phonePrefixSelection("+39"), "+39:IT");
  assert.equal(phonePrefixes.phonePrefixSelection("+1"), "+1:US");
  assert.equal(phonePrefixes.phonePrefixSelection("+44"), "+44:GB");
  assert.equal(phonePrefixes.phonePrefixSelection("+61"), "+61:AU");
  assert.equal(phonePrefixes.phonePrefixSelection("other"), "other");
  assert.equal(phonePrefixes.phonePrefixValue("+976"), "+976");
});
