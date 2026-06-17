import { RegistrationForm } from "@/app/registrazione/registration-form";
import { GROUP_REGISTRATION_LINK_QUERY_PARAM } from "@/lib/groups/registration-links";
import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";
import {
  getPublicRegistrationOptions,
  type PublicRegistrationOptions,
} from "@/lib/registrations/public-flow";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type RegistrationPageProps = {
  searchParams: Promise<{
    email?: string;
    error?: string;
    groupLink?: string;
  }>;
};

export default async function RegistrationPage({
  searchParams,
}: RegistrationPageProps) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const copy = getMessages(locale);
  const supabase = createSupabaseServiceClient();
  let groupLinkError: string | null = null;
  let options: PublicRegistrationOptions;

  try {
    options = await getPublicRegistrationOptions(
      supabase,
      params[GROUP_REGISTRATION_LINK_QUERY_PARAM]
    );
  } catch (error) {
    groupLinkError =
      error instanceof Error
        ? error.message
        : copy.registrationClosed.groupLinkError;
    options = await getPublicRegistrationOptions(supabase);
  }

  if (!options.event) {
    return (
      <main className="min-h-screen bg-[#f7f8f3] px-5 py-10 text-[#1c241f]">
        <div className="mx-auto max-w-3xl rounded-lg border border-[#d8dece] bg-white p-6">
          <h1 className="text-2xl font-semibold">{copy.registrationClosed.title}</h1>
          <p className="mt-3 text-[#4b5a50]">
            {copy.registrationClosed.body}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <RegistrationForm
        email={params.email ?? ""}
        error={params.error ?? groupLinkError ?? undefined}
        groupRegistrationLinkToken={
          groupLinkError ? null : params[GROUP_REGISTRATION_LINK_QUERY_PARAM] ?? null
        }
        options={options}
        locale={locale}
      />
    </main>
  );
}
