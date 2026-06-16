import Link from "next/link";

import type { PersonalRegistrationSummary } from "@/lib/registrations/personal-registration";

type PersonalRegistrationCardProps = {
  summary: PersonalRegistrationSummary;
};

export function PersonalRegistrationCard({
  summary,
}: PersonalRegistrationCardProps) {
  return (
    <section className="rounded-lg border border-[#d8dece] bg-white px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">
            {summary.hasRegistration
              ? "Iscrizione personale collegata"
              : "Iscrizione personale da completare"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5e6d63]">
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
