import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const registrationForm = readFileSync(
  join(process.cwd(), "app/registrazione/registration-form.tsx"),
  "utf8"
);

test("public attendance choices use cards on mobile and a table on wider screens", () => {
  assert.match(registrationForm, /className="grid grid-cols-2 gap-3 sm:hidden"/);
  assert.match(
    registrationForm,
    /className="hidden overflow-hidden rounded-lg border border-\[var\(--peace-border\)\] sm:block"/
  );
  assert.doesNotMatch(registrationForm, /overflow-x-auto overscroll-x-contain/);
});
