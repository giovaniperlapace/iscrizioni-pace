import { CurtainIcon } from "@/components/curtain-icon";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { PersonalSeat } from "@/lib/ceremonies/distribution";
import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
import { SECTOR_COPY } from "@/lib/ceremonies/sector-copy";
import { PERSONAL_CEREMONY_COPY } from "@/lib/ceremonies/personal-copy";
import { CeremonyPersonalBadge } from "../../ceremony-personal-badge";

export function PersonalCeremonySeats({ seats, locale, loading = false }: {
  seats: PersonalSeat[] | null;
  locale: SupportedLocale;
  loading?: boolean;
}) {
  const c = DISTRIBUTION_COPY[locale];
  const copy = PERSONAL_CEREMONY_COPY[locale];
  return (
    <div className="grid min-w-0 gap-5 md:grid-cols-2">
      {(["opening", "closing"] as const).map((kind) => {
        const assigned = seats?.filter((seat) => seat.kind === kind) ?? [];
        return (
          <section key={kind} aria-labelledby={`personal-ceremony-${kind}`} aria-busy={loading} className="grid content-start gap-4 rounded-xl border border-[var(--peace-border)] bg-white p-5">
            <h2 id={`personal-ceremony-${kind}`} className="flex items-center gap-3 text-xl font-semibold text-[var(--peace-blue-950)]">
              <CurtainIcon size={24} className="shrink-0 text-[var(--peace-blue-800)]" aria-hidden="true" />{c[kind]}
            </h2>
            {loading ? <p className="text-sm text-[var(--peace-muted)]">{copy.loading}</p> : seats === null ? <p role="alert">{c.failure}</p> : !assigned.length ? <p className="text-sm leading-6 text-[var(--peace-muted)]">{copy.empty}</p> : null}
            {assigned.map((seat) => (
              <article key={seat.id} className="grid gap-2 border-t border-[var(--peace-border)] pt-4">
                <h3 className="font-semibold">{seat.name}</h3>
                {seat.child && <p className="text-sm text-[var(--peace-muted)]">{c.child}</p>}
                {seat.needsSeat ? <>
                  <p className="text-lg font-semibold text-[var(--peace-blue-800)]">{SECTOR_COPY[locale].sector} {seat.sector}</p>
                  {seat.kind === "closing" && <CeremonyPersonalBadge nomineeId={seat.id} badgeCode={seat.badgeCode} name={seat.name} locale={locale} preview />}
                  <p className="text-sm text-[var(--peace-muted)]">{seat.location}</p>
                  <p className="text-sm">{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(seat.startsAt))}</p>
                </> : <p>{c.noSeatState}</p>}
                {seat.review && <p className="rounded-lg bg-amber-50 p-3 text-sm">{c.review}</p>}
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
