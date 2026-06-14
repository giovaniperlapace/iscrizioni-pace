import { RegistrationForm } from "@/app/registrazione/registration-form";
import { getPublicRegistrationOptions } from "@/lib/registrations/public-flow";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type RegistrationPageProps = {
  searchParams: Promise<{
    email?: string;
    error?: string;
  }>;
};

export default async function RegistrationPage({
  searchParams,
}: RegistrationPageProps) {
  const params = await searchParams;
  const options = await getPublicRegistrationOptions(createSupabaseServiceClient());

  if (!options.event) {
    return (
      <main className="min-h-screen bg-[#f7f8f3] px-5 py-10 text-[#1c241f]">
        <div className="mx-auto max-w-3xl rounded-lg border border-[#d8dece] bg-white p-6">
          <h1 className="text-2xl font-semibold">Iscrizioni non aperte</h1>
          <p className="mt-3 text-[#4b5a50]">
            Nessun evento pubblicato accetta iscrizioni in questo momento.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8f3] text-[#1c241f]">
      <RegistrationForm
        email={params.email ?? ""}
        error={params.error}
        options={options}
      />
    </main>
  );
}
