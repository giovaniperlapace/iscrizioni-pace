import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("ordinary deletion is a transactional lifecycle operation with a reason", () => {
  const route = read("app/dashboard/participants/delete/route.ts");
  assert.match(route, /rpc\(\s*"set_registration_deleted"/);
  assert.doesNotMatch(route, /\.from\("registrations"\)/);
  assert.match(route, /p_actor_user_id: auth.user.id/);
  assert.match(route, /p_reason: data.get\("reason"\)/);
  const table = read("app/dashboard/operations-participants-table.tsx");
  assert.match(
    table,
    /name="reason"\s+required\s+minLength=\{3\}\s+maxLength=\{500\}/,
  );
  assert.match(table, /Ripristina iscrizione/);
});
