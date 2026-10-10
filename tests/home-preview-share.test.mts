import assert from "node:assert/strict";
import test from "node:test";
import { createHash, randomBytes } from "node:crypto";
import { isHomeApprovalTokenValid } from "../lib/panels/home-preview-share.ts";

test("single approval link denies invalid and expired tokens before reads", () => {
  const token = randomBytes(32).toString("base64url");
  const now = Date.parse("2026-10-10T10:00:00Z");
  const expires = now + 3 * 86400000;
  const config = JSON.stringify({ hash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(expires).toISOString() });
  assert.equal(isHomeApprovalTokenValid(token, config, now), true);
  assert.equal(isHomeApprovalTokenValid(token, config, expires - 1), true);
  assert.equal(isHomeApprovalTokenValid(token, config, expires), false);
  for (const value of [undefined, "", "invalid", "{}", JSON.stringify({ hash: "a".repeat(64), expiresAt: "invalid" })]) assert.equal(isHomeApprovalTokenValid(token, value, now), false);
  assert.equal(isHomeApprovalTokenValid(randomBytes(32).toString("base64url"), config, now), false);
  assert.equal(isHomeApprovalTokenValid("", config, now), false);
});
