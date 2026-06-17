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
        className="inline-flex max-w-full flex-wrap rounded-lg border border-[#c7d3bd] bg-[#e9eee2] p-1.5 shadow-sm"
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
                "inline-flex min-h-12 items-center justify-center rounded-md px-5 text-base font-semibold transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5e46]",
                isActive
                  ? "bg-white text-[#1f4d38] shadow-sm"
                  : "text-[#496350] hover:bg-[#f5f7f1] hover:text-[#244f3a]",
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
    <div className="flex flex-col gap-2 text-[#4b5a50] sm:flex-row sm:items-center">
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#bfd0b5] bg-[#eef4ea] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#426044]">
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-[#2f5e46]"
        />
        {copy.common.protectedArea}
      </span>
      <p className="max-w-4xl text-base leading-7">{children}</p>
    </div>
  );
}
