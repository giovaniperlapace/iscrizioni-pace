import assert from "node:assert/strict";
import test from "node:test";

import {
  formatStagingReadinessReport,
  validateStagingReadiness,
} from "../lib/deployment/staging-readiness.ts";

const COMPLETE_STAGING_ENV = {
  DEPLOYMENT_ENVIRONMENT: "staging",
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase-staging.example.org",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "staging-anon",
  SUPABASE_URL: "https://supabase-staging.example.org",
  SUPABASE_ANON_KEY: "staging-anon",
  SUPABASE_SERVICE_ROLE_KEY: "staging-service-role",
  QR_TOKEN_ENCRYPTION_SECRET: "staging-secret-0123456789abcdef0123456789",
  NEXT_PUBLIC_APP_URL: "https://staging.example.org",
  APP_URL: "https://staging.example.org",
  PUBLIC_SITE_URL: "https://staging.example.org",
  EMAIL_DELIVERY_MODE: "log",
};

test("staging readiness accepts an isolated environment", () => {
  const result = validateStagingReadiness(COMPLETE_STAGING_ENV);

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("staging readiness rejects production Supabase and app URLs", () => {
  const result = validateStagingReadiness({
    ...COMPLETE_STAGING_ENV,
    NEXT_PUBLIC_SUPABASE_URL:
      "https://iscrizioni-supabase.stefano-orlando.it",
    SUPABASE_URL: "https://iscrizioni-supabase.stefano-orlando.it",
    APP_URL: "https://registrationspeace.santegidio.org",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.name === "SUPABASE_URL"));
  assert.ok(result.errors.some((issue) => issue.name === "APP_URL"));
});

test("staging readiness rejects real email delivery without exposing values", () => {
  const result = validateStagingReadiness({
    ...COMPLETE_STAGING_ENV,
    EMAIL_DELIVERY_MODE: "smtp",
  });
  const report = formatStagingReadinessReport(result);

  assert.equal(result.ok, false);
  assert.match(report, /EMAIL_DELIVERY_MODE/);
  assert.doesNotMatch(report, /staging-service-role/);
});

test("staging readiness requires valid HTTPS endpoints", () => {
  const result = validateStagingReadiness({
    ...COMPLETE_STAGING_ENV,
    NEXT_PUBLIC_APP_URL: "http://staging.example.org",
    APP_URL: "not-a-url",
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.name === "NEXT_PUBLIC_APP_URL"));
  assert.ok(result.errors.some((issue) => issue.name === "APP_URL"));
});

test("staging readiness accepts localhost only for the application URL", () => {
  const result = validateStagingReadiness({
    ...COMPLETE_STAGING_ENV,
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    APP_URL: "http://localhost:3000",
    PUBLIC_SITE_URL: "http://localhost:3000",
  });

  assert.equal(result.ok, true);
});
