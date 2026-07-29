import assert from "node:assert/strict";
import test from "node:test";

import {
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

test("campaign recipient selection has no application-level size limit", () => {
  const ids = Array.from({ length: 750 }, (_, index) => `recipient-${index}`);

  assert.equal(
    resolveSelectedCampaignRecipientIds(ids, ids).size,
    750
  );
});
