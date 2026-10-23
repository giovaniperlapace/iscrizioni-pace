import { getForumRelayRoom } from "@/lib/events/assisi-2026-relay-rooms";
import { FORUM_RELAY_COPY, relayDirections } from "@/lib/panels/relay-copy";
import type { SupportedLocale } from "@/lib/i18n/config";
import { getForumLanguagesLabel } from "@/lib/events/assisi-2026-forum-languages";

export function ForumLanguages({ panelId, locale }: { panelId: string; locale: SupportedLocale }) {
  const relay = getForumRelayRoom(panelId);
  if (relay) return <span className="block rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-sm leading-6 text-amber-950"><strong className="block">{FORUM_RELAY_COPY[locale].badge}</strong>{FORUM_RELAY_COPY[locale].notice}<span className="mt-2 block font-semibold">{relay.venue} · {relay.address}</span><span className="block">{relayDirections(locale, relay.parking)}</span></span>;
  const label = getForumLanguagesLabel(panelId, locale);
  if (!label) return null;
  return <span className="block text-xs leading-5 text-[var(--peace-muted)]">{label}</span>;
}
