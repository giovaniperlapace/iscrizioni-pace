import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
import { CurtainIcon } from "@/components/curtain-icon";
import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";
import type { SupportedLocale } from "@/lib/i18n/config";
import { GROUP_BOOKING_COPY } from "@/lib/panels/group-booking-copy";

export function LeaderSectionNavigation({ active, locale, showPanels = true }: {
  active: "participants" | "panels" | "ceremonies";
  locale: SupportedLocale;
  showPanels?: boolean;
}) {
  const copy = GROUP_BOOKING_COPY[locale];
  return (
    <nav aria-label={`${copy.back} / ${copy.title} / ${DISTRIBUTION_COPY[locale].title}`} className="flex flex-wrap gap-2 rounded-xl border border-[var(--peace-border)] bg-white p-2">
      {[
        { key: "participants", label: copy.back, href: "/dashboard/capogruppo", Icon: Users },
        { key: "panels", label: copy.title, href: "/dashboard/capogruppo/panel", Icon: CalendarDays },
        { key: "ceremonies", label: DISTRIBUTION_COPY[locale].title, href: "/dashboard/capogruppo/cerimonie", Icon: CurtainIcon },
      ].filter(item => item.key !== "panels" || showPanels).map(({ key, label, href, Icon }) => (
        <Link key={key} href={href} prefetch={false} aria-current={active === key ? "page" : undefined}
          className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${active === key ? "bg-[var(--peace-blue-800)] text-white" : "text-[var(--peace-muted)] hover:bg-[var(--peace-sky-100)] hover:text-[var(--peace-blue-800)]"}`}>
          <Icon size={18} className="shrink-0" aria-hidden="true" />{label}
        </Link>
      ))}
    </nav>
  );
}
