import { RegistrationForm } from "@/app/registrazione/registration-form";
import { EventIdentity } from "@/components/event-identity";
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
      <main className="app-page px-5 py-10 text-[var(--peace-ink)]">
        <div className="surface-card mx-auto max-w-3xl overflow-hidden">
          <div className="event-gradient px-6 py-7">
            <EventIdentity compact inverted />
          </div>
          <div className="p-6">
          <h2 className="text-2xl font-semibold">{copy.registrationClosed.title}</h2>
          <p className="mt-3 text-[var(--peace-muted)]">
            {copy.registrationClosed.body}
          </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-page text-[var(--peace-ink)]">
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
