import { submitPublicRegistration } from "@/app/actions";
import { getPublicRegistrationOptions } from "@/lib/registrations/public-flow";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type RegistrationPageProps = {
  searchParams: Promise<{
    email?: string;
    error?: string;
  }>;
};

const ACCESSIBILITY_QUESTIONS = [
  ["seeing", "Vedere, anche usando occhiali"],
  ["hearing", "Sentire, anche usando apparecchi acustici"],
  ["walking", "Camminare o salire gradini"],
  ["remembering", "Ricordare o concentrarsi"],
  ["selfCare", "Prendersi cura di se'"],
  ["communicating", "Comunicare nella propria lingua"],
] as const;

const ACCESSIBILITY_CHOICES = [
  ["none", "Nessuna difficolta'"],
  ["some", "Qualche difficolta'"],
  ["a_lot", "Molta difficolta'"],
  ["cannot_do", "Non riesco"],
] as const;

export default async function RegistrationPage({
  searchParams,
}: RegistrationPageProps) {
  const params = await searchParams;
  const options = await getPublicRegistrationOptions(createSupabaseServiceClient());
  const email = params.email ?? "";

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
      <form
        action={submitPublicRegistration}
        className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8 sm:px-8"
      >
        <header className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
            Nuova iscrizione
          </p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
            {options.event.title}
          </h1>
          <p className="mt-3 text-[#4b5a50]">
            Completa i dati essenziali. Potrai aggiornare le informazioni dalla
            dashboard dopo l&apos;accesso.
          </p>
          {params.error ? (
            <p className="mt-4 rounded-md border border-[#e0b5a9] bg-[#fff3ef] px-3 py-2 text-sm text-[#8a3323]">
              {params.error}
            </p>
          ) : null}
        </header>

        <section className="grid gap-4 rounded-lg border border-[#d8dece] bg-white p-5 sm:grid-cols-2">
          <Field label="Email">
            <input
              name="email"
              type="email"
              required
              defaultValue={email}
              className="field"
              autoComplete="email"
            />
          </Field>
          <Field label="Lingua preferita">
            <select name="preferredLocale" className="field" defaultValue="it">
              <option value="it">Italiano</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label="Nome">
            <input
              name="firstName"
              required
              className="field"
              autoComplete="given-name"
            />
          </Field>
          <Field label="Cognome">
            <input
              name="lastName"
              required
              className="field"
              autoComplete="family-name"
            />
          </Field>
          <Field label="Data di nascita">
            <input name="birthDate" type="date" className="field" />
          </Field>
          <Field label="Hai gia&apos; partecipato a eventi o iniziative Sant&apos;Egidio?">
            <select name="hasPreviousSantegidioParticipation" className="field">
              <option value="">Non lo so / preferisco non indicarlo</option>
              <option value="yes">Si&apos;</option>
              <option value="no">No</option>
            </select>
          </Field>
        </section>

        <section className="grid gap-4 rounded-lg border border-[#d8dece] bg-white p-5 sm:grid-cols-2">
          <Field label="Paese">
            <select name="countryId" className="field" defaultValue="">
              <option value="">Altro / non in lista</option>
              {options.countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name_it}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Paese non in lista">
            <input name="countryOther" className="field" />
          </Field>
          <Field label="Citta'">
            <select name="cityId" className="field" defaultValue="">
              <option value="">Altra / non in lista</option>
              {options.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Citta' non in lista">
            <input name="cityOther" className="field" />
          </Field>
        </section>

        <section className="grid gap-4 rounded-lg border border-[#d8dece] bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Partecipi con un gruppo Sant&apos;Egidio?">
              <select name="participatesWithGroup" className="field">
                <option value="">Non lo so ancora</option>
                <option value="yes">Si&apos;</option>
                <option value="no">No, partecipo singolarmente</option>
              </select>
            </Field>
            <Field label="Gruppo">
              <select name="groupId" className="field" defaultValue="">
                <option value="">Seleziona un gruppo</option>
                {options.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                    {group.primary_leader_name
                      ? ` - ${group.primary_leader_name}`
                      : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Partecipazione prevista">
            <select name="attendanceChoice" className="field" defaultValue="unknown">
              <option value="unknown">Non lo so ancora</option>
              <option value="yes">Penso di partecipare</option>
              <option value="no">Non penso di partecipare a tutti i momenti</option>
            </select>
          </Field>
        </section>

        <section className="rounded-lg border border-[#d8dece] bg-white p-5">
          <h2 className="text-lg font-semibold">Accessibilita&apos;</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {ACCESSIBILITY_QUESTIONS.map(([key, label]) => (
              <Field key={key} label={label}>
                <select name={`accessibility_${key}`} className="field">
                  {ACCESSIBILITY_CHOICES.map(([value, optionLabel]) => (
                    <option key={value} value={value}>
                      {optionLabel}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm text-[#38453c]">
            <input
              name="needsOperationalSupport"
              type="checkbox"
              className="mt-1 h-4 w-4"
            />
            Ho bisogno di essere ricontattato per organizzare un supporto
            operativo.
          </label>
          <Field label="Note operative">
            <textarea name="accessibilityNotes" className="field min-h-24" />
          </Field>
        </section>

        <section className="rounded-lg border border-[#d8dece] bg-white p-5">
          <label className="flex items-start gap-3 text-sm text-[#38453c]">
            <input name="privacyAccepted" type="checkbox" required className="mt-1 h-4 w-4" />
            Accetto l&apos;informativa privacy per questa iscrizione.
          </label>
          <label className="mt-3 flex items-start gap-3 text-sm text-[#38453c]">
            <input
              name="dataProcessingAccepted"
              type="checkbox"
              required
              className="mt-1 h-4 w-4"
            />
            Acconsento al trattamento dei dati necessari alla gestione
            dell&apos;evento.
          </label>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            className="min-h-12 rounded-md bg-[#2f5e46] px-6 font-semibold text-white transition hover:bg-[#254b38]"
          >
            Invia iscrizione
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#38453c]">
      <span>{label}</span>
      {children}
    </label>
  );
}
