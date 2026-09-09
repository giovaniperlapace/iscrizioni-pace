import { RegistrationForm } from "@/app/registrazione/registration-form";
import type { SupportedLocale } from "@/lib/i18n/config";
export default async function Fixture({ searchParams }: { searchParams: Promise<{ locale?: SupportedLocale; link?: string }> }) {
  const params = await searchParams;
  return <RegistrationForm email="synthetic@example.org" locale={params.locale ?? "it"}
    groupRegistrationLinkToken={params.link ? "synthetic-link" : null} identitySuggestion={null}
    options={{ event: null, countries: [], cities: [], groups: [], moments: [],
      groupLink: params.link ? { id: "11111111-1111-4111-8111-111111111111", groupId: "22222222-2222-4222-8222-222222222222", groupName: "Gruppo sintetico", displayLabel: "Gruppo sintetico" } : null }} />;
}
