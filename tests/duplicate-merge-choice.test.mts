import test from "node:test";
import assert from "node:assert/strict";
import { suggestedMergeSurvivor } from "../lib/data-quality/merge-choice.ts";
import type { QualityPerson } from "../lib/data-quality/data.server.ts";
const person = (
  id: string,
  submittedAt: string | null,
  authUserId: string | null = null,
) => ({ id, submittedAt, authUserId }) as QualityPerson;
test("suggests latest registration independently of pair order", () => {
  const old = person("old", "2026-09-01"),
    recent = person("new", "2026-09-08");
  assert.equal(suggestedMergeSurvivor(old, recent), "new");
  assert.equal(suggestedMergeSurvivor(recent, old), "new");
});
test("preserves account access and does not choose between two linked accounts", () => {
  const account = person("account", "2026-09-01", "user");
  assert.equal(
    suggestedMergeSurvivor(account, person("new", "2026-09-08")),
    "account",
  );
  assert.equal(
    suggestedMergeSurvivor(person("new", "2026-09-08"), account),
    "account",
  );
  assert.equal(
    suggestedMergeSurvivor(
      account,
      person("other", "2026-09-08", "other-user"),
    ),
    "",
  );
});
test("does not invent recency when dates are missing, invalid or equal", () => {
  for (const date of [null, "invalid", "2026-09-08"]) {
    assert.equal(
      suggestedMergeSurvivor(person("a", date), person("b", "2026-09-08")),
      "",
    );
  }
});
