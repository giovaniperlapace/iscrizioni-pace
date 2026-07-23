import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CAMPAIGN_RECIPIENTS,
  resolveSelectedCampaignRecipientIds,
} from "../lib/email/campaign-selection.ts";

test("campaign recipients require an explicit non-empty selection", () => {
  assert.throws(
    () => resolveSelectedCampaignRecipientIds(["available-1"], []),
    /Seleziona almeno un destinatario/
  );
});

test("campaign recipients include only explicitly requested available people", () => {
  assert.deepEqual(
    [
      ...resolveSelectedCampaignRecipientIds(
        ["available-1", "available-2"],
        ["available-2", "not-available"]
      ),
    ],
    ["available-2"]
  );
});

test("campaign recipient selection enforces the limit on chosen people", () => {
  const ids = Array.from(
    { length: MAX_CAMPAIGN_RECIPIENTS + 1 },
    (_, index) => `participant-${index}`
  );

  assert.throws(
    () => resolveSelectedCampaignRecipientIds(ids, ids),
    /al massimo 100 destinatari/
  );
});
