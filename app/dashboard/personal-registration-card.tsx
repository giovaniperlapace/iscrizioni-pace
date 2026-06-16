import Link from "next/link";

import type { PersonalRegistrationSummary } from "@/lib/registrations/personal-registration";

type PersonalRegistrationCardProps = {
  summary: PersonalRegistrationSummary;
};

export function PersonalRegistrationCard({
  summary,
}: PersonalRegistrationCardProps) {
  return (
    <section className="rounded-lg border border-[#d8dece] bg-white p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
            La mia iscrizione
          </p>
          <h2 className="mt-2 text-lg font-semibold">
            {summary.hasRegistration
              ? "Iscrizione personale collegata"
              : "Iscrizione personale da completare"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5e6d63]">
            {summary.hasRegistration
              ? `Puoi consultare QR, dati personali, giorni di presenza e panel${
                  summary.eventTitle ? ` per ${summary.eventTitle}` : ""
                }.`
              : "Questo ruolo abilita funzioni operative, ma presenza, QR e panel richiedono anche la tua iscrizione personale all'evento."}
          </p>
        </div>
        <Link
          href={summary.hasRegistration ? "/dashboard/partecipante" : "/"}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-[#b8c5ad] px-4 text-sm font-semibold text-[#2f5e46] transition hover:bg-[#eef2e7]"
        >
          {summary.hasRegistration ? "Apri la mia iscrizione" : "Completa iscrizione"}
        </Link>
      </div>
    </section>
  );
}
