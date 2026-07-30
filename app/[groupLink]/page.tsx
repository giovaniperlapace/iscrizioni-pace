import {
  RegistrationPageContent,
  type RegistrationSearchParams,
} from "@/app/registrazione/registration-page-content";

type GroupRegistrationPageProps = {
  params: Promise<{
    groupLink: string;
  }>;
  searchParams: Promise<RegistrationSearchParams>;
};

export default async function GroupRegistrationPage({
  params,
  searchParams,
}: GroupRegistrationPageProps) {
  const [{ groupLink }, registrationSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  return (
    <RegistrationPageContent
      searchParams={registrationSearchParams}
      groupRegistrationLinkToken={groupLink}
    />
  );
}
