import assert from "node:assert/strict";
import test from "node:test";

import {
  EVENT_SERVICE_DESCRIPTION_MAX_LENGTH,
  EVENT_SERVICE_LABEL_MAX_LENGTH,
  isEventServiceDescriptionWithinLimit,
  isEventServiceLabelWithinLimit,
  normalizeEventServiceCatalogDescription,
  normalizeEventServiceLabel,
} from "../lib/registrations/event-services.ts";

test("event service labels enforce the shared 40 character limit", () => {
  const validLabel = "a".repeat(EVENT_SERVICE_LABEL_MAX_LENGTH);
  const invalidLabel = `${validLabel}b`;

  assert.equal(isEventServiceLabelWithinLimit(validLabel), true);
  assert.equal(isEventServiceLabelWithinLimit(invalidLabel), false);
  assert.equal(normalizeEventServiceLabel(validLabel), validLabel);
});

test("event service catalog descriptions enforce the shared 160 character limit", () => {
  const validDescription = "a".repeat(EVENT_SERVICE_DESCRIPTION_MAX_LENGTH);
  const invalidDescription = `${validDescription}b`;

  assert.equal(isEventServiceDescriptionWithinLimit(validDescription), true);
  assert.equal(isEventServiceDescriptionWithinLimit(invalidDescription), false);
  assert.equal(normalizeEventServiceCatalogDescription(validDescription), validDescription);
});

test("event service description validation counts normalized whitespace", () => {
  const description = `  ${"a".repeat(80)}   ${"b".repeat(79)}  `;

  assert.equal(isEventServiceDescriptionWithinLimit(description), true);
  assert.equal(
    normalizeEventServiceCatalogDescription(description),
    `${"a".repeat(80)} ${"b".repeat(79)}`
  );
});
