import Image from "next/image";

import { logout, setAppLocale } from "@/app/actions";
import { LanguageSelector } from "@/components/language-selector";
import { getCurrentAuthContext } from "@/lib/auth/session";
import type { DashboardRole } from "@/lib/auth/roles";
import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HeadbarUser = {
  email: string;
  roleLabel: DashboardRole;
};

export async function AppHeadbar() {
  const locale = await getRequestLocale();
  const copy = getMessages(locale);
  const user = await getHeadbarUser();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--peace-border)] bg-white/92 text-[var(--peace-ink)] backdrop-blur-xl">
      <div className="mx-auto flex min-h-[4.75rem] w-full max-w-6xl items-center justify-between gap-4 px-5 py-2 sm:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Image
            src="/logos/logo_santegidio.png"
            alt="Comunità di Sant'Egidio"
            width={190}
            height={117}
            priority
            className="h-14 w-auto object-contain"
          />
          <div className="hidden min-w-0 border-l border-[var(--peace-border)] pl-4 md:block">
            <p className="truncate text-xs font-extrabold leading-4 text-[var(--peace-blue-900)]">
              UNHARMED AND DISARMING PEACE
            </p>
            <p className="truncate text-xs font-medium leading-4 text-[var(--peace-muted)]">
              Assisi, 25–26–27 ottobre 2026
            </p>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-3">
          <LanguageSelector
            action={setAppLocale}
            currentLocale={locale}
            label={copy.common.language}
            pendingLabel={copy.common.languageChanging}
          />

          {user ? (
            <>
              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-sm font-medium leading-5 text-[var(--peace-ink)]">
                  {user.email}
                </p>
                <p className="text-xs font-semibold uppercase leading-5 tracking-wide text-[var(--peace-blue-800)]">
                  {copy.common.roles[user.roleLabel]}
                </p>
              </div>
              <form action={logout}>
                <button className="btn-secondary inline-flex min-h-9 items-center justify-center gap-2 px-3 text-sm">
                  <ExitIcon />
                  <span className="hidden sm:inline">{copy.common.logout}</span>
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

async function getHeadbarUser(): Promise<HeadbarUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const auth = await getCurrentAuthContext(supabase);

    if (!auth?.user.email) {
      return null;
    }

    return {
      email: auth.user.email,
      roleLabel: auth.dashboardRole,
    };
  } catch {
    return null;
  }
}

function ExitIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
