import Link from "next/link";

import {
  getDashboardRoleTabs,
  normalizeDashboardTabRole,
} from "@/lib/auth/dashboard-tabs";
import type { DashboardRole, EventRole } from "@/lib/auth/roles";
import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";

type DashboardRoleTabsProps = {
  activeRole: DashboardRole;
  eventRoles: Array<{ role: EventRole; eventId: string | null }>;
};

type DashboardAreaDescriptionProps = {
  children: React.ReactNode;
};

export async function DashboardRoleTabs({
  activeRole,
  eventRoles,
}: DashboardRoleTabsProps) {
  const locale = await getRequestLocale();
  const copy = getMessages(locale);
  const tabs = getDashboardRoleTabs(eventRoles, locale);

  if (tabs.length <= 1) {
    return null;
  }

  const activeKey = normalizeDashboardTabRole(activeRole);

  return (
    <nav aria-label={copy.common.protectedArea} className="w-full">
      <div
        role="tablist"
        aria-label={copy.common.protectedArea}
        className="inline-flex max-w-full flex-wrap rounded-[var(--radius-md)] border border-[var(--peace-border)] bg-white/80 p-1.5 shadow-[var(--shadow-card)]"
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeKey;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              className={[
                "inline-flex min-h-12 items-center justify-center rounded-[var(--radius-sm)] px-5 text-base font-semibold transition",
                "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
                isActive
                  ? "bg-[var(--peace-blue-800)] text-white shadow-sm"
                  : "text-[var(--peace-muted)] hover:bg-[var(--peace-sky-100)] hover:text-[var(--peace-blue-900)]",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export async function DashboardAreaDescription({
  children,
}: DashboardAreaDescriptionProps) {
  const locale = await getRequestLocale();
  const copy = getMessages(locale);

  return (
    <div className="surface-panel flex flex-col gap-2 p-4 text-[var(--peace-muted)] sm:flex-row sm:items-center">
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--peace-border-strong)] bg-[var(--peace-sky-100)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--peace-blue-800)]">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-[var(--peace-sky-400)]"
        />
        {copy.common.protectedArea}
      </span>
      <p className="max-w-4xl text-base leading-7">{children}</p>
    </div>
  );
}
