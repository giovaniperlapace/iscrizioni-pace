import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDailyRecipientSchedule,
  DAILY_CAMPAIGN_SEND_LIMIT,
} from "../lib/email/campaign-scheduling.ts";

test("campaign scheduling keeps the first 300 recipients on the first day", () => {
  const ids = Array.from(
    { length: DAILY_CAMPAIGN_SEND_LIMIT + 25 },
    (_, index) => `recipient-${index}`
  );
  const schedule = buildDailyRecipientSchedule(
    ids,
    new Map(),
    "2026-07-29"
  );

  assert.equal(
    schedule.filter((item) => item.scheduledFor === "2026-07-29").length,
    300
  );
  assert.equal(
    schedule.filter((item) => item.scheduledFor === "2026-07-30").length,
    25
  );
});

test("campaign scheduling respects capacity already reserved by other campaigns", () => {
  const schedule = buildDailyRecipientSchedule(
    ["one", "two", "three"],
    new Map([["2026-07-29", 299]]),
    "2026-07-29"
  );

  assert.deepEqual(schedule, [
    { recipientKey: "one", scheduledFor: "2026-07-29" },
    { recipientKey: "two", scheduledFor: "2026-07-30" },
    { recipientKey: "three", scheduledFor: "2026-07-30" },
  ]);
});
