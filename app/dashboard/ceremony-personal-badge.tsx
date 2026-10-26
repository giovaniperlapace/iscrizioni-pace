import Image from "next/image";
import { closingBadgeSector, closingBadgeColor, CLOSING_BADGE_COPY } from "@/lib/ceremonies/closing-badges";
import type { SupportedLocale } from "@/lib/i18n/config";
export function CeremonyPersonalBadge({ nomineeId, badgeCode, name, locale, preview = false }: {
  nomineeId: string; badgeCode?: string | null; name: string; locale: SupportedLocale; preview?: boolean;
}) {
  const badge = closingBadgeSector(badgeCode);
  if (!badge) return null;
  const copy = CLOSING_BADGE_COPY[locale];
  const url = `/dashboard/ceremonies/badge?nominee=${encodeURIComponent(nomineeId)}`;
  return <div className="grid justify-items-start gap-2">
    <span className="rounded-full px-3 py-1 text-sm font-semibold text-white" style={{ backgroundColor: badge.hex }}>{copy.badge} {closingBadgeColor(badgeCode, locale)}</span>
    {preview && <Image unoptimized src={`${url}&format=jpg`} alt={`${name} · ${copy.badge} ${closingBadgeColor(badgeCode, locale)}`} width={180} height={320} className="h-auto max-w-full rounded-lg border border-slate-200" />}
    <a href={url} className="text-sm font-semibold underline" download>{copy.download}</a>
  </div>;
}
