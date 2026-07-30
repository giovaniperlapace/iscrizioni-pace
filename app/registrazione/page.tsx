import {
  RegistrationPageContent,
  type RegistrationSearchParams,
} from "@/app/registrazione/registration-page-content";
import {
  buildGroupRegistrationPath,
  isValidGroupRegistrationLinkToken,
} from "@/lib/groups/registration-links";
import { permanentRedirect } from "next/navigation";

type RegistrationPageProps = {
  searchParams: Promise<
    RegistrationSearchParams & {
      groupLink?: string;
    }
  >;
};

export default async function RegistrationPage({
  searchParams,
}: RegistrationPageProps) {
  const params = await searchParams;
  const groupRegistrationLinkToken = params.groupLink ?? null;

  if (
    groupRegistrationLinkToken &&
    isValidGroupRegistrationLinkToken(groupRegistrationLinkToken)
  ) {
    permanentRedirect(
      buildGroupRegistrationPath({
        token: groupRegistrationLinkToken,
        email: params.email,
        error: params.error,
      })
    );
  }

  return (
    <RegistrationPageContent
      searchParams={params}
      groupRegistrationLinkToken={groupRegistrationLinkToken}
    />
  );
}
