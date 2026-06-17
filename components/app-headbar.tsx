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
    <header className="sticky top-0 z-40 border-b border-[#e4e8dc] bg-white/95 text-[#1c241f] backdrop-blur">
      <div className="mx-auto flex min-h-[4.75rem] w-full max-w-6xl items-center justify-between gap-4 px-5 py-2 sm:px-8">
        <div className="flex min-w-0 items-center">
          <Image
            src="/logos/logo_santegidio.png"
            alt="Comunità di Sant'Egidio"
            width={190}
            height={117}
            priority
            className="h-14 w-auto object-contain"
          />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-3">
          <LanguageSelector
            action={setAppLocale}
            currentLocale={locale}
            label={copy.common.language}
          />

          {user ? (
            <>
              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-sm font-medium leading-5 text-[#1c241f]">
                  {user.email}
                </p>
                <p className="text-xs font-semibold uppercase leading-5 tracking-wide text-[#5d765f]">
                  {copy.common.roles[user.roleLabel]}
                </p>
              </div>
              <form action={logout}>
                <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[#c8d5be] px-3 text-sm font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5e46]">
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
