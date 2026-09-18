import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { SUPPORTED_LOCALES, type SupportedLocale } from "../lib/i18n/config.ts";
import { EMAIL_DELIVERY_COPY } from "../lib/i18n/email-delivery.ts";
import { renderMagicLinkEmail, renderRegistrationConfirmationEmail } from "../lib/email/templates.ts";

const input = { firstName: "Camille", lastName: "Martin", eventTitle: "Assisi 2026", participantCode: "A7K2", siteLink: "https://example.test", qrCodeContentId: "qr@example.test" };
const subjects = { it: "Iscrizione ricevuta", en: "Registration received", fr: "Inscription reçue", de: "Anmeldung erhalten", es: "Inscripción recibida", nl: "Inschrijving ontvangen", uk: "Реєстрацію отримано" };
for (const locale of SUPPORTED_LOCALES) {
  test(`confirmation is complete in ${locale} in both email formats`, () => {
    const result = renderRegistrationConfirmationEmail({ ...input, locale });
    assert.equal(result.subject, `${subjects[locale]} - Assisi 2026`);
    for (const body of [result.text, result.html]) {
      for (const value of ["Camille", "Martin", "A7K2", "Assisi 2026", input.siteLink, EMAIL_DELIVERY_COPY[locale].checkSpam, EMAIL_DELIVERY_COPY[locale].safeSender]) assert.ok(body.includes(value), value);
      assert.doesNotMatch(body, /\{(?:firstName|name|event|code|site)\}/);
      if (locale !== "it") assert.doesNotMatch(body, /Ciao|In allegato|Il tuo codice|Quando sarà|Grazie\.|Controlla anche/);
    }
    assert.ok(result.html.includes(`lang="${locale}"`));
    assert.match(result.html, /cid:qr@example\.test/);
    if (locale !== "it") assert.doesNotMatch(result.html, /alt="QR code personale"/);
  });
}
test("French confirmation has French access instructions and QR description", () => {
  const result = renderRegistrationConfirmationEmail({ ...input, locale: "fr" });
  assert.match(result.text, /pièce jointe/);
  assert.match(result.text, /même adresse e-mail/);
  assert.match(result.html, /alt="QR code personnel"/);
});
test("confirmation escapes all user values once and does not reinterpret placeholders", () => {
  const result = renderRegistrationConfirmationEmail({ ...input, locale: "fr", firstName: '<script>{code}</script>&"', eventTitle: '<img src=x onerror="bad">', siteLink: 'https://example.test/?x=1&y="2"' });
  assert.doesNotMatch(result.html, /<script>|<img src=x|&amp;lt;/);
  assert.match(result.html, /&lt;script&gt;\{code\}&lt;\/script&gt;&amp;&quot;/);
  assert.ok(result.html.includes('href="https://example.test/?x=1&amp;y=&quot;2&quot;"'));
});
test("invalid legacy locale falls back to English and missing CID omits the inline image", () => {
  const result = renderRegistrationConfirmationEmail({ ...input, locale: "invalid" as SupportedLocale, qrCodeContentId: undefined });
  assert.match(result.subject, /^Registration received/);
  assert.doesNotMatch(result.html, /<img/);
});
test("magic link contains Italian and English with the same escaped destination", () => {
  const url = 'https://example.test/auth/callback?token=opaque&x="value"';
  const result = renderMagicLinkEmail({ actionLink: url });
  for (const body of [result.text, result.html]) {
    assert.match(body, /Se non hai richiesto/);
    assert.match(body, /If you did not request/);
  }
  assert.equal(result.text.split(url).length - 1, 2);
  assert.equal(result.html.split('href="https://example.test/auth/callback?token=opaque&amp;x=&quot;value&quot;"').length - 1, 2);
});
test("registration persistence and confirmation use the same resolved locale", () => {
  const source = readFileSync(new URL("../lib/registrations/public-flow.ts", import.meta.url), "utf8");
  assert.match(source, /preferred_locale: input.preferredLocale/);
  assert.match(source, /renderRegistrationConfirmationEmail\(\{\s*locale: input.preferredLocale/);
});

test("request language follows the selector cookie before the browser language", async () => {
  const ts = await import("typescript");
  const { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, normalizeLocale, pickLocaleFromAcceptLanguage } = await import("../lib/i18n/config.ts");
  const source = readFileSync(new URL("../lib/i18n/server.ts", import.meta.url), "utf8");
  const fn = source.slice(source.indexOf("export async function getRequestLocale"));
  const js = ts.transpileModule(fn.replace("export ", ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const [cookie, browser, expected] of [["fr", "it", "fr"], ["uk", "en", "uk"], [undefined, "de-DE", "de"], ["invalid", "es", "es"], [undefined, "pl", "en"]]) {
    const deps = {
      DEFAULT_LOCALE, LOCALE_COOKIE_NAME, normalizeLocale, pickLocaleFromAcceptLanguage,
      cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }),
      headers: async () => ({ get: () => browser }),
    };
    const resolve = new Function(...Object.keys(deps), `${js}; return getRequestLocale;`)(...Object.values(deps));
    assert.equal(await resolve(), expected);
  }
});
