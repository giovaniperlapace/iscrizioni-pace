import Image from "next/image";

import { logout } from "@/app/actions";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { getCurrentAuthContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HeadbarUser = {
  email: string;
  roleLabel: string;
};

export async function AppHeadbar() {
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

        {user ? (
          <div className="flex min-w-0 items-center justify-end gap-3">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-medium leading-5 text-[#1c241f]">
                {user.email}
              </p>
              <p className="text-xs font-semibold uppercase leading-5 tracking-wide text-[#5d765f]">
                {user.roleLabel}
              </p>
            </div>
            <form action={logout}>
              <button className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[#c8d5be] px-3 text-sm font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f5e46]">
                <ExitIcon />
                Esci
              </button>
            </form>
          </div>
        ) : null}
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
      roleLabel: ROLE_LABELS[auth.dashboardRole],
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
