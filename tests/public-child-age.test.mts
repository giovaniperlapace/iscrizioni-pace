import assert from "node:assert/strict";
import test from "node:test";
import { publicChildBirthDateBounds } from "../lib/registrations/public-child-age.ts";
import { parseRegistrationForm } from "../lib/registrations/validation.ts";
import { validateAccompanyingChildren } from "../lib/registrations/registration-children.ts";

function form(birthDate: string, token: string) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    email: "parent@example.org", emailConfirmation: "parent@example.org",
    firstName: "Maria", lastName: "Rossi", birthDate: "1990-01-02",
    birthPlace: "Roma", nationality: "Italian (Italy)", countryOther: "Italia",
    cityOther: "Roma", hasAccessibilityNeeds: "no",
    hasPreviousSantegidioParticipation: "no", availabilityUnknown: "on",
    privacyAccepted: "on", groupRegistrationLinkToken: token,
    participatesWithChildren: "yes", childrenCount: "1",
    child_0_firstName: "Anna", child_0_lastName: "Rossi", child_0_birthDate: birthDate,
  })) data.set(key, value);
  return data;
}

test("inclusive bounds exclude the eighteenth birthday, including leap-day edges", () => {
  assert.deepEqual(publicChildBirthDateBounds("2026-09-21"), { min: "2008-09-22", max: "2026-09-21" });
  assert.deepEqual(publicChildBirthDateBounds("2028-02-29"), { min: "2010-03-01", max: "2028-02-29" });
  assert.equal(publicChildBirthDateBounds("2026-02-28").min, "2008-02-29");
  assert.equal(publicChildBirthDateBounds("2026-03-01").min, "2008-03-02");
  assert.equal(publicChildBirthDateBounds("2026-12-31").min, "2009-01-01");
});

for (const token of ["", "group-link"]) {
  test(`public children must be aged 0–17 (${token || "public"})`, () => {
    const { min, max } = publicChildBirthDateBounds();
    for (const date of [min, max]) {
      const parsed = parseRegistrationForm(form(date, token));
      assert.ok(parsed.ok);
      assert.equal(parsed.value.children[0].birthDate, date);
    }
    const eighteenthBirthday = new Date(`${min}T00:00:00Z`);
    eighteenthBirthday.setUTCDate(eighteenthBirthday.getUTCDate() - 1);
    const future = new Date(`${max}T00:00:00Z`);
    future.setUTCDate(future.getUTCDate() + 1);
    for (const date of [eighteenthBirthday.toISOString().slice(0, 10), "1990-01-01", future.toISOString().slice(0, 10), "", "2020-02-30"]) {
      assert.equal(parseRegistrationForm(form(date, token)).ok, false, date);
    }
    const multiple = form(max, token);
    multiple.set("childrenCount", "2");
    multiple.set("child_1_firstName", "Luca");
    multiple.set("child_1_lastName", "Rossi");
    multiple.set("child_1_birthDate", "1990-01-01");
    assert.equal(parseRegistrationForm(multiple).ok, false);
    multiple.set("participatesWithChildren", "no");
    const withoutChildren = parseRegistrationForm(multiple);
    assert.ok(withoutChildren.ok);
    assert.deepEqual(withoutChildren.value.children, []);
  });
}

test("shared validation for historical and assisted registrations retains adult birth dates", () => {
  assert.deepEqual(validateAccompanyingChildren({ participatesWithChildren: true,
    children: [{ firstName: "Anna", lastName: "Rossi", birthDate: "1990-01-01" }],
  }), []);
});
