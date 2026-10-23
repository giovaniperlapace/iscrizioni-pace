import { getForumRelayRoom } from "../events/assisi-2026-relay-rooms.ts";
import { FORUM_RELAY_COPY, relayDirections } from "./relay-copy.ts";
import { normalizeLocale } from "../i18n/config.ts";
import { EMAIL_DELIVERY_COPY } from "../i18n/email-delivery.ts";
import { FORUM_WAITLIST_COPY } from "./waitlist-copy.ts";
import { GROUP_WAITLIST_COPY } from "./group-waitlist-copy.ts";
import { parseForumIntent } from "./booking-intent.ts";

export type ForumWaitlistOffer = {
  id: string; claim: string; eventId: string; registrationId: string; panelId: string;
  notificationKind?: "participant" | "leader"; sectionId?: string;
  name: string; email: string; locale?: string | null; title: string; location: string;
  startsAt: string; endsAt: string; expiresAt: string; seats: number;
};

export function renderForumWaitlistEmail(offer: ForumWaitlistOffer, appUrl: string) {
  const locale = normalizeLocale(offer.locale) ?? "it";
  const copy = { ...FORUM_WAITLIST_COPY[locale], ...(offer.notificationKind === "leader" ? GROUP_WAITLIST_COPY[locale] : {}) };
  const id = parseForumIntent(offer.panelId);
  if (!id) throw new Error("Invalid Forum ID");
  const section = parseForumIntent(offer.sectionId);
  if (offer.notificationKind === "leader" && !section) throw new Error("Invalid Forum section ID");
  const link = new URL(offer.notificationKind === "leader"
    ? `/dashboard/capogruppo/panel?section=${section}` : `/forum/${id}`, appUrl);
  if (!["http:", "https:"].includes(link.protocol)) throw new Error("Invalid site URL");
  const format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" });
  const relay = getForumRelayRoom(offer.panelId);
  const relayCopy = FORUM_RELAY_COPY[locale];
  const paragraphs = [offer.name, relay ? relayCopy.emailBody : copy.emailBody, offer.title,
    `${format.format(new Date(offer.startsAt))} – ${format.format(new Date(offer.endsAt))} · ${offer.location}`,
    `${copy.deadline}: ${format.format(new Date(offer.expiresAt))} (Europe/Rome)`,
    copy.swap, copy.emailAccess, EMAIL_DELIVERY_COPY[locale].checkSpam, EMAIL_DELIVERY_COPY[locale].safeSender];
  const directions = relay ? `${relay.venue} — ${relay.address}. ${relayDirections(locale, relay.parking)}` : null;
  return {
    subject: relay ? `${relayCopy.subject} — Forum ${relay.number} · ${relay.venue}` : copy.emailSubject,
    text: [...(relay ? [relayCopy.badge, relayCopy.notice, directions!, relayCopy.queue] : []), ...paragraphs.slice(0, 7), link.href, ...paragraphs.slice(7)].join("\n\n"),
    html: (relay ? `<p><strong>${escapeHtml(relayCopy.badge)}</strong></p><p><strong>${escapeHtml(relayCopy.notice)}</strong></p><p><strong>${escapeHtml(directions!)}</strong></p><p>${escapeHtml(relayCopy.queue)}</p>` : "") + paragraphs.map((text, index) => `<p>${escapeHtml(text)}</p>${index === 6 ? `<p><a href="${escapeHtml(link.href)}">${escapeHtml(copy.accept)}</a></p>` : ""}`).join(""),
  };
}
function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
