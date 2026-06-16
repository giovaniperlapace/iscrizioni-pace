import assert from "node:assert/strict";
import test from "node:test";

import {
  formatOpeningReadinessReport,
  validateOpeningReadiness,
} from "../lib/deployment/opening-readiness.ts";

const COMPLETE_PRODUCTION_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://iscrizioni-supabase.stefano-orlando.it",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_URL: "https://iscrizioni-supabase.stefano-orlando.it",
  SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
  QR_TOKEN_ENCRYPTION_SECRET: "0123456789abcdef0123456789abcdef",
  NEXT_PUBLIC_APP_URL: "https://iscrizioni-pace.vercel.app",
  APP_URL: "https://iscrizioni-pace.vercel.app",
  PUBLIC_SITE_URL: "https://iscrizioni-pace.vercel.app",
  EMAIL_FROM: "registrationspeace@santegidio.org",
  EMAIL_USER: "registrationspeace@santegidio.org",
  EMAIL_PASSWORD: "password",
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  EMAIL_DELIVERY_MODE: "smtp",
};

test("opening readiness accepts complete production env", () => {
  const result = validateOpeningReadiness(COMPLETE_PRODUCTION_ENV, {
    production: true,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("opening readiness rejects missing secrets without printing values", () => {
  const result = validateOpeningReadiness(
    {
      ...COMPLETE_PRODUCTION_ENV,
      SUPABASE_SERVICE_ROLE_KEY: "",
      EMAIL_PASSWORD: "",
    },
    { production: true }
  );
  const report = formatOpeningReadinessReport(result);

  assert.equal(result.ok, false);
  assert.match(report, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(report, /EMAIL_PASSWORD/);
  assert.doesNotMatch(report, /service|password/);
});

test("opening readiness rejects preview URLs in production", () => {
  const result = validateOpeningReadiness(
    {
      ...COMPLETE_PRODUCTION_ENV,
      PUBLIC_SITE_URL:
        "https://iscrizioni-pace-jsfy4uk0w-giovaniperlapaces-projects.vercel.app",
    },
    { production: true }
  );

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((issue) => issue.name === "PUBLIC_SITE_URL"));
});
