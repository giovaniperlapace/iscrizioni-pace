import assert from "node:assert/strict";
import test from "node:test";
import { getPanelReleaseMode } from "../lib/panels/release.ts";
import { readFileSync } from "node:fs";

for (const mode of ["internal", "catalog", "open"] as const) {
  test(`release uses explicit database mode ${mode}`, async () => {
    assert.equal(await getPanelReleaseMode({ rpc: async () => ({ data: mode, error: null }) } as never), mode);
  });
}
test("missing migration closes public access; failed or malformed reads never enable it", async () => {
  assert.equal(await getPanelReleaseMode({ rpc: async () => ({ error: { code: "PGRST202" } }) } as never), "internal");
  for (const result of [{ error: { code: "42501" } }, { error: { code: "08006" } }, { data: null }, { data: "unknown" }]) {
    await assert.rejects(getPanelReleaseMode({ rpc: async () => result } as never));
  }
});
test("every public mutation checks release state before form processing and side effects", () => {
  const actions = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
  for (const name of ["setParticipantPanelBooking", "submitPublicSchoolBooking", "requestSchoolBookingAccess", "updateTeacherSchoolBooking", "cancelTeacherSchoolBooking"]) {
    assert.match(actions, new RegExp(`export async function ${name}\\(formData: FormData\\) \\{\\s+await requirePublicPanelBookings\\(\\);`));
  }
});

test("all operational panel actions authorize admin before service-role reads or mutations", () => {
  const actions = readFileSync(new URL("../app/actions.ts", import.meta.url), "utf8");
  for (const name of ["saveEventLocation", "deleteEventLocation", "savePanelDraft", "publishPanels", "saveSchoolBooking", "cancelSchoolBooking"]) {
    assert.match(actions, new RegExp(`export async function ${name}\\(formData: FormData\\) \\{\\s+await requirePanelAdministrator\\(\\);`));
  }
});
