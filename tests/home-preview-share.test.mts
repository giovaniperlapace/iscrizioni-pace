import assert from "node:assert/strict";
import test from "node:test";
import { createHomePreviewToken, hashHomePreviewToken } from "../lib/panels/home-preview-share.ts";
import { readFileSync } from "node:fs";

test("preview capabilities are unpredictable, bounded and stored only as a digest", () => {
  const tokens = new Set(Array.from({ length: 100 }, createHomePreviewToken));
  assert.equal(tokens.size, 100);
  for (const token of tokens) {
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    const hash = hashHomePreviewToken(token);
    assert.match(hash!, /^[a-f0-9]{64}$/);
    assert.notEqual(hash, token);
    assert.equal(hashHomePreviewToken(token), hash);
  }
  for (const invalid of ["", "test", "a".repeat(10000), "!".repeat(43)]) assert.equal(hashHomePreviewToken(invalid), null);
});

test("shared route and management preserve boundaries, no caching and disabled booking", () => {
  const page = readFileSync(new URL("../app/anteprima-home/[token]/page.tsx", import.meta.url), "utf8");
  assert.ok(page.indexOf("if (!hash) notFound()") < page.indexOf('.rpc("get_shared_home_preview"'));
  assert.match(page, /if \(!data\) notFound\(\)/);
  assert.match(page, /bookingsOpen=\{false\} preview/);
  assert.doesNotMatch(page, /getPanelDraftCatalog|registrations|participant_contacts/);
  const guard = readFileSync(new URL("../lib/panels/home-preview-share.server.ts", import.meta.url), "utf8");
  assert.ok(guard.indexOf('role.role === "admin" && role.eventId === null') < guard.indexOf("const db = createSupabaseServiceClient()"));
  const actions = readFileSync(new URL("../app/dashboard/anteprima-home/condivisione/actions.ts", import.meta.url), "utf8");
  assert.match(actions, /\.eq\("event_id", eventId\)/);
  assert.match(actions, /token_hash: hashHomePreviewToken\(token\)/);
  const config = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
  assert.match(config, /private, no-store/);
  assert.match(config, /no-referrer/);
});
