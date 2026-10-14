import { normalizeLocale } from "../i18n/config.ts";
import { EMAIL_DELIVERY_COPY } from "../i18n/email-delivery.ts";
import { FORUM_WAITLIST_COPY } from "./waitlist-copy.ts";
import { parseForumIntent } from "./booking-intent.ts";

export type ForumWaitlistOffer = {
  id: string; claim: string; eventId: string; registrationId: string; panelId: string;
  name: string; email: string; locale: string; title: string; location: string;
  startsAt: string; endsAt: string; expiresAt: string; seats: number;
};

export function renderForumWaitlistEmail(offer: ForumWaitlistOffer, appUrl: string) {
  const locale = normalizeLocale(offer.locale) ?? "en";
  const copy = FORUM_WAITLIST_COPY[locale];
  const id = parseForumIntent(offer.panelId);
  if (!id) throw new Error("Invalid Forum ID");
  const link = new URL(`/forum/${id}`, appUrl);
  if (!["http:", "https:"].includes(link.protocol)) throw new Error("Invalid site URL");
  const format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" });
  const paragraphs = [offer.name, copy.emailBody, offer.title,
    `${format.format(new Date(offer.startsAt))} – ${format.format(new Date(offer.endsAt))} · ${offer.location}`,
    `${copy.deadline}: ${format.format(new Date(offer.expiresAt))} (Europe/Rome)`,
    copy.swap, copy.emailAccess, EMAIL_DELIVERY_COPY[locale].checkSpam, EMAIL_DELIVERY_COPY[locale].safeSender];
  return {
    subject: copy.emailSubject,
    text: [...paragraphs.slice(0, 7), link.href, ...paragraphs.slice(7)].join("\n\n"),
    html: paragraphs.map((text, index) => `<p>${escapeHtml(text)}</p>${index === 6 ? `<p><a href="${escapeHtml(link.href)}">${escapeHtml(copy.accept)}</a></p>` : ""}`).join(""),
  };
}
function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
