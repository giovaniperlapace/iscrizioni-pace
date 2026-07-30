import { RegistrationForm } from "@/app/registrazione/registration-form";
import { EventIdentity } from "@/components/event-identity";
import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";
import {
  getRegistrationIdentitySuggestionForEmail,
  getPublicRegistrationOptions,
  type PublicRegistrationOptions,
} from "@/lib/registrations/public-flow";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type RegistrationSearchParams = {
  email?: string;
  error?: string;
};

export async function RegistrationPageContent({
  searchParams,
  groupRegistrationLinkToken = null,
}: {
  searchParams: RegistrationSearchParams;
  groupRegistrationLinkToken?: string | null;
}) {
  const locale = await getRequestLocale();
  const copy = getMessages(locale);
  const supabase = createSupabaseServiceClient();
  let groupLinkError: string | null = null;
  let options: PublicRegistrationOptions;
  const email = searchParams.email ?? "";

  try {
    options = await getPublicRegistrationOptions(
      supabase,
      groupRegistrationLinkToken
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
            <h2 className="text-2xl font-semibold">
              {copy.registrationClosed.title}
            </h2>
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
        email={email}
        error={searchParams.error ?? groupLinkError ?? undefined}
        groupRegistrationLinkToken={
          groupLinkError ? null : groupRegistrationLinkToken
        }
        identitySuggestion={
          email
            ? await getRegistrationIdentitySuggestionForEmail(supabase, email)
            : null
        }
        options={options}
        locale={locale}
      />
    </main>
  );
}
