import Image from "next/image";

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
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-medium leading-5 text-[#1c241f]">
              {user.email}
            </p>
            <p className="text-xs font-semibold uppercase leading-5 tracking-wide text-[#5d765f]">
              {user.roleLabel}
            </p>
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
