import assert from "node:assert/strict";
import test from "node:test";

import {
  checkRateLimit,
  clearExpiredRateLimitBuckets,
} from "../lib/security/rate-limit.ts";
import { getEmailConfig } from "../lib/email/config.ts";
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

test("SMTP pool defaults and bounds are deterministic", () => {
  const names = [
    "EMAIL_DELIVERY_MODE",
    "SMTP_POOL",
    "SMTP_MAX_CONNECTIONS",
    "SMTP_MAX_MESSAGES",
  ] as const;
  const previous = new Map(names.map((name) => [name, process.env[name]]));

  process.env.EMAIL_DELIVERY_MODE = "log";
  delete process.env.SMTP_POOL;
  delete process.env.SMTP_MAX_CONNECTIONS;
  delete process.env.SMTP_MAX_MESSAGES;

  try {
    assert.deepEqual(
      pickPoolConfig(getEmailConfig()),
      {
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
      }
    );

    process.env.SMTP_POOL = "false";
    process.env.SMTP_MAX_CONNECTIONS = "11";
    process.env.SMTP_MAX_MESSAGES = "0";

    assert.deepEqual(
      pickPoolConfig(getEmailConfig()),
      {
        pool: false,
        maxConnections: 5,
        maxMessages: 100,
      }
    );

    process.env.SMTP_POOL = "invalid";
    process.env.SMTP_MAX_CONNECTIONS = "3";
    process.env.SMTP_MAX_MESSAGES = "250";

    assert.deepEqual(
      pickPoolConfig(getEmailConfig()),
      {
        pool: true,
        maxConnections: 3,
        maxMessages: 250,
      }
    );
  } finally {
    for (const name of names) {
      restoreEnv(name, previous.get(name));
    }
  }
});

function pickPoolConfig(config: ReturnType<typeof getEmailConfig>) {
  return {
    pool: config.pool,
    maxConnections: config.maxConnections,
    maxMessages: config.maxMessages,
  };
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
