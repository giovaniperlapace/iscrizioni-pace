import assert from "node:assert/strict";
import test from "node:test";
import { renderForumWaitlistEmail } from "../lib/panels/waitlist-email.ts";

const id = "11111111-1111-4111-8111-111111111111";
for (const notificationKind of ["participant", "leader"] as const) {
  for (const locale of [undefined, null, "", "   ", "xx", "invalid-language"]) {
    test(`${notificationKind}: missing or unsupported language ${JSON.stringify(locale)} uses Italian`, () => {
      const offer = { id, claim: id, eventId: id, registrationId: id, panelId: id, sectionId: id,
        notificationKind, name: "Test", email: "test@example.invalid", title: "Forum", location: "Sala",
        startsAt: "2026-10-26T09:00:00Z", endsAt: "2026-10-26T10:00:00Z",
        expiresAt: "2026-10-26T08:00:00Z", seats: 1 };
      assert.deepEqual(renderForumWaitlistEmail({ ...offer, locale }, "https://example.invalid"),
        renderForumWaitlistEmail({ ...offer, locale: "it" }, "https://example.invalid"));
      assert.notEqual(renderForumWaitlistEmail({ ...offer, locale: "en" }, "https://example.invalid").subject,
        renderForumWaitlistEmail({ ...offer, locale }, "https://example.invalid").subject);
    });
  }
}
