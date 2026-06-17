import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_LOCALE,
  normalizeLocale,
  pickLocaleFromAcceptLanguage,
} from "../lib/i18n/config.ts";

test("normalizeLocale accepts supported locales and aliases", () => {
  assert.equal(normalizeLocale("fr-FR"), "fr");
  assert.equal(normalizeLocale("uk-UA"), "uk");
  assert.equal(normalizeLocale("ua"), "uk");
  assert.equal(normalizeLocale("pt-BR"), null);
});

test("pickLocaleFromAcceptLanguage uses browser preference with English fallback", () => {
  assert.equal(
    pickLocaleFromAcceptLanguage("pt-BR,fr;q=0.8,en;q=0.7"),
    "fr"
  );
  assert.equal(pickLocaleFromAcceptLanguage("pt-BR,pl;q=0.8"), DEFAULT_LOCALE);
  assert.equal(pickLocaleFromAcceptLanguage(null), DEFAULT_LOCALE);
});
