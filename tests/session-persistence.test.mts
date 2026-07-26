import assert from "node:assert/strict";
import test from "node:test";

import {
  hasSessionBeenInactive,
  sanitizeLastDashboardPath,
  SESSION_IDLE_TIMEOUT_MS,
} from "../lib/auth/session-persistence.ts";

test("session inactivity starts only after 24 hours", () => {
  const now = Date.UTC(2026, 6, 26, 12);

  assert.equal(hasSessionBeenInactive(null, now), false);
  assert.equal(
    hasSessionBeenInactive(String(now - SESSION_IDLE_TIMEOUT_MS + 1), now),
    false
  );
  assert.equal(
    hasSessionBeenInactive(String(now - SESSION_IDLE_TIMEOUT_MS), now),
    true
  );
  assert.equal(hasSessionBeenInactive("invalid", now), true);
});

test("remembered dashboard keeps only stable menu state", () => {
  assert.equal(
    sanitizeLastDashboardPath(
      "/dashboard/manager?section=email&nav=mini&campaignId=secret"
    ),
    "/dashboard/manager?section=email&nav=mini"
  );
  assert.equal(
    sanitizeLastDashboardPath(
      "/dashboard/admin?section=iscritti&edit=participant-id"
    ),
    "/dashboard/admin?section=iscritti"
  );
  assert.equal(
    sanitizeLastDashboardPath("/dashboard/partecipante?overlay=registration"),
    "/dashboard/partecipante"
  );
});

test("remembered dashboard rejects external and unknown paths", () => {
  assert.equal(sanitizeLastDashboardPath("https://example.org/dashboard"), null);
  assert.equal(sanitizeLastDashboardPath("//example.org/dashboard"), null);
  assert.equal(sanitizeLastDashboardPath("/registrazione"), null);
  assert.equal(sanitizeLastDashboardPath("/dashboard/admin/users"), null);
});
