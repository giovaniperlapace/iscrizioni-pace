import assert from "node:assert/strict";
import test from "node:test";
import { getCampaignLocalDate } from "../lib/email/campaign-scheduling.ts";

test("campaign dates follow Rome in summer and winter", () => {
  assert.equal(getCampaignLocalDate(new Date("2026-07-29T22:30:00Z")), "2026-07-30");
  assert.equal(getCampaignLocalDate(new Date("2026-01-29T22:30:00Z")), "2026-01-29");
});
