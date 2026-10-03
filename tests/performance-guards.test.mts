import assert from "node:assert/strict";
import test from "node:test";

import {
  checkRateLimit,
  clearExpiredRateLimitBuckets,
} from "../lib/security/rate-limit.ts";
import { createSupabaseServiceClient } from "../lib/supabase/service.ts";

test("service-role Supabase client is reused for unchanged configuration", () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  process.env.SUPABASE_URL = "https://performance-test.example";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "performance-test-key";

  try {
    const initialClient = createSupabaseServiceClient();

    assert.equal(
      initialClient,
      createSupabaseServiceClient()
    );

    process.env.SUPABASE_SERVICE_ROLE_KEY = "performance-test-key-rotated";
    const rotatedClient = createSupabaseServiceClient();

    assert.notEqual(initialClient, rotatedClient);
    assert.equal(rotatedClient, createSupabaseServiceClient());
  } finally {
    restoreEnv("SUPABASE_URL", previousUrl);
    restoreEnv("NEXT_PUBLIC_SUPABASE_URL", previousPublicUrl);
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", previousKey);
  }
});

test("rate limiter removes only expired buckets", () => {
  assert.equal(
    checkRateLimit("performance-expired", { limit: 1, windowMs: 1_000 }, 0),
    true
  );
  assert.equal(
    checkRateLimit("performance-active", { limit: 1, windowMs: 120_000 }, 0),
    true
  );

  assert.equal(clearExpiredRateLimitBuckets(60_000), 1);
  assert.equal(
    checkRateLimit("performance-active", { limit: 1, windowMs: 120_000 }, 60_001),
    false
  );
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
