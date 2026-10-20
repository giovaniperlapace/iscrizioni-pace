import type { SupportedLocale } from "@/lib/i18n/config";
import { getForumLanguagesLabel } from "@/lib/events/assisi-2026-forum-languages";

export function ForumLanguages({ panelId, locale }: { panelId: string; locale: SupportedLocale }) {
  const label = getForumLanguagesLabel(panelId, locale);
  if (!label) return null;
  return <span className="block text-xs leading-5 text-[var(--peace-muted)]">{label}</span>;
}
