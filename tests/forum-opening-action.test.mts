import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8")
  .split("export async function updateForumOpeningState(formData: FormData) {")[1]
  .split("\nexport async function updateEventOpeningState")[0].trim().slice(0, -1);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function run(roles: unknown[], values: Record<string, string>, error: unknown = null) {
  const calls: unknown[] = [];
  const action = new AsyncFunction("formData", "createSupabaseServerClient", "getCurrentAuthContext",
    "optionalText", "formFailure", "revalidatePath", "redirect", source);
  const form = new FormData();
  Object.entries(values).forEach(([key, value]) => form.set(key, value));
  const result = await action(form, async () => ({ rpc: async (...args: unknown[]) => {
    calls.push(args); return { error };
  } }), async () => ({ eventRoles: roles }), (v: unknown) => typeof v === "string" ? v : null,
  (issues: unknown) => ({ issues }), (...args: unknown[]) => calls.push(["revalidate", ...args]),
  (path: string) => { calls.push(["redirect", path]); });
  return { calls, result };
}
const values = { eventId: "11111111-1111-1111-1111-111111111111", expectedMode: "internal", open: "true" };
const admin = [{ role: "admin", eventId: null }];
test("Forum opening rejects non-admin and event-scoped roles before RPC", async () => {
  for (const roles of [[], [{ role: "manager", eventId: values.eventId }], [{ role: "admin", eventId: values.eventId }]]) {
    const { calls, result } = await run(roles, values);
    assert.deepEqual(calls, []);
    assert.equal(result.issues[0].code, "forbidden");
  }
});
test("Forum opening validates explicit desired state and IDs", async () => {
  for (const patch of [{ open: "toggle" }, { expectedMode: "bad" }, { eventId: "bad" }]) {
    const { calls, result } = await run(admin, { ...values, ...patch });
    assert.deepEqual(calls, []);
    assert.equal(result.issues[0].code, "invalid");
  }
});
test("Forum opening passes expected state to authenticated RPC; errors do not announce success", async () => {
  const success = await run(admin, values);
  assert.deepEqual(success.calls[0], ["set_forum_bookings_open", {
    p_event: values.eventId, p_expected_mode: "internal", p_open: true,
  }]);
  assert.equal(success.calls.length, 3);
  for (const code of ["40001", "42501", "P0002", "08006"]) {
    const { calls, result } = await run(admin, values, { code });
    assert.equal(calls.length, 1);
    assert.equal(result.issues[0].code, code === "42501" ? "forbidden" : "forumOpeningRefresh");
  }
});
