import assert from "node:assert/strict";
import test from "node:test";

import { renderMagicLinkEmail } from "../lib/email/templates.ts";
import { createOpaqueQrToken, hashQrToken } from "../lib/qrcode/token.ts";
import {
  normalizeEmail,
  parseRegistrationForm,
} from "../lib/registrations/validation.ts";
import { checkRateLimit } from "../lib/security/rate-limit.ts";

test("normalizeEmail trims and lowercases email addresses", () => {
  assert.equal(normalizeEmail("  USER@Example.Org "), "user@example.org");
});

test("parseRegistrationForm validates required public registration fields", () => {
  const formData = new FormData();
  formData.set("email", "maria@example.org");
  formData.set("firstName", "Maria");
  formData.set("lastName", "Rossi");
  formData.set("countryOther", "Italia");
  formData.set("cityOther", "Roma");
  formData.set("privacyAccepted", "on");
  formData.set("dataProcessingAccepted", "on");

  const parsed = parseRegistrationForm(formData);

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.value.email, "maria@example.org");
    assert.equal(parsed.value.preferredLocale, "it");
    assert.equal(parsed.value.attendanceChoice, "unknown");
  }
});

test("parseRegistrationForm rejects missing consents", () => {
  const formData = new FormData();
  formData.set("email", "maria@example.org");
  formData.set("firstName", "Maria");
  formData.set("lastName", "Rossi");
  formData.set("countryOther", "Italia");
  formData.set("cityOther", "Roma");

  const parsed = parseRegistrationForm(formData);

  assert.equal(parsed.ok, false);
});

test("QR tokens are opaque and only hashes are stable", () => {
  const first = createOpaqueQrToken();
  const second = createOpaqueQrToken();

  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, hashQrToken(first.token));
  assert.notEqual(first.tokenHash, first.token);
});

test("magic link template escapes action URLs", () => {
  const rendered = renderMagicLinkEmail({
    actionLink: 'https://example.org/auth?x="<tag>',
  });

  assert.match(rendered.html, /&quot;&lt;tag&gt;/);
});

test("rate limit blocks attempts after the configured threshold", () => {
  assert.equal(checkRateLimit("test-key", { limit: 2, windowMs: 1000 }, 0), true);
  assert.equal(checkRateLimit("test-key", { limit: 2, windowMs: 1000 }, 1), true);
  assert.equal(checkRateLimit("test-key", { limit: 2, windowMs: 1000 }, 2), false);
  assert.equal(checkRateLimit("test-key", { limit: 2, windowMs: 1000 }, 1001), true);
});
