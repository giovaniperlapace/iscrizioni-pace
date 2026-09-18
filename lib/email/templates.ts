import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from "../i18n/config.ts";
import { REGISTRATION_CONFIRMATION_COPY } from "./registration-confirmation-copy.ts";
import { EMAIL_DELIVERY_COPY } from "../i18n/email-delivery.ts";

type MagicLinkTemplateInput = {
  actionLink: string;
};

type RegistrationConfirmationInput = {
  locale: SupportedLocale;
  firstName: string;
  lastName: string;
  participantCode: string;
  eventTitle: string;
  siteLink: string;
  qrCodeContentId?: string;
};


export function renderMagicLinkEmail(input: MagicLinkTemplateInput) {
  const sections = [
    { locale: "it" as const, greeting: "Ciao,", intro: "Usa questo link per accedere alla tua iscrizione:", button: "Accedi alla tua iscrizione", ignore: "Se non hai richiesto tu questo link, puoi ignorare questa email." },
    { locale: "en" as const, greeting: "Hello,", intro: "Use this link to access your registration:", button: "Access your registration", ignore: "If you did not request this link, you can ignore this email." },
  ];
  return {
    subject: "Accesso alla tua iscrizione / Access your registration",
    text: sections.map(copy => [copy.greeting, "", copy.intro, input.actionLink, "", EMAIL_DELIVERY_COPY[copy.locale].checkSpam, EMAIL_DELIVERY_COPY[copy.locale].safeSender, "", copy.ignore].join("\n")).join("\n\n---\n\n"),
    html: sections.map(copy => `<div lang="${copy.locale}"><p>${copy.greeting}</p><p>${copy.intro}</p><p><a href="${escapeHtml(input.actionLink)}">${copy.button}</a></p><p>${escapeHtml(EMAIL_DELIVERY_COPY[copy.locale].checkSpam)} ${escapeHtml(EMAIL_DELIVERY_COPY[copy.locale].safeSender)}</p><p>${copy.ignore}</p></div>`).join("<hr />"),
  };
}

export function renderRegistrationConfirmationEmail(input: RegistrationConfirmationInput) {
  const locale = normalizeLocale(input.locale) ?? DEFAULT_LOCALE;
  const copy = REGISTRATION_CONFIRMATION_COPY[locale];
  const values: Record<string, string> = {
    firstName: input.firstName,
    name: `${input.firstName} ${input.lastName}`.trim(),
    event: input.eventTitle,
    code: input.participantCode,
    site: input.siteLink,
  };
  const paragraphs = [copy.greeting, copy.received, copy.code, copy.qr, copy.access, copy.programme, EMAIL_DELIVERY_COPY[locale].checkSpam, EMAIL_DELIVERY_COPY[locale].safeSender, copy.thanks];
  const interpolate = (value: string, html: boolean) => value.replace(/\{(firstName|name|event|code|site)\}/g, (_match, key: string) => {
    const text = values[key];
    if (!html) return text;
    const escaped = escapeHtml(text);
    if (key === "site") return `<a href="${escaped}">${escaped}</a>`;
    return ["name", "event", "code"].includes(key) ? `<strong>${escaped}</strong>` : escaped;
  });
  return {
    subject: `${copy.subject} - ${input.eventTitle}`,
    text: paragraphs.map(p => interpolate(p, false)).join("\n\n"),
    html: `<div lang="${locale}">` + paragraphs.map((p, i) => `<p>${interpolate(escapeHtml(p), true)}</p>` + (i === 2 && input.qrCodeContentId ? `<p><img src="cid:${escapeHtml(input.qrCodeContentId)}" alt="${escapeHtml(copy.qrAlt)}" width="180" height="180" /></p>` : "")).join("") + "</div>",
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
