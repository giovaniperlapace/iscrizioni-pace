import { SEAT_MAP_COPY } from "@/lib/ceremonies/seat-map-copy";
import type { SupportedLocale } from "@/lib/i18n/config";
import type { PersonalSeat } from "@/lib/ceremonies/distribution";
import { DISTRIBUTION_COPY } from "@/lib/ceremonies/distribution-copy";
export function PersonalCeremonySeats({
  seats,
  locale,
}: {
  seats: PersonalSeat[];
  locale: SupportedLocale;
}) {
  const c = DISTRIBUTION_COPY[locale];
  return (
    <section className="grid gap-5">
      <header>
        <h1 className="text-xl font-semibold">{c.title}</h1>
        <p className="mt-2 leading-6">{c.personalIntro}</p>
      </header>
      {!seats.length && <p>{c.personalEmpty}</p>}
      {seats.map((s) => (
        <article key={s.id} className="surface-card grid gap-3 p-5">
          <h2 className="text-lg font-semibold">
            {c[s.kind]} · {s.name}
          </h2>
          {s.child && <p>{c.child}</p>}
          {s.needsSeat ? (
            <>
              <p>
                {s.location} · {s.sector} · {s.category}
              </p>
              <p>{s.seat ? `${SEAT_MAP_COPY[locale].row} ${s.seat.row} · ${SEAT_MAP_COPY[locale].number} ${s.seat.number}` : s.mapAvailable ? SEAT_MAP_COPY[locale].seatPending : null}</p>
              <p>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Europe/Rome",
                }).format(new Date(s.startsAt))}
              </p>
            </>
          ) : (
            <p>{c.noSeatState}</p>
          )}
          {s.review && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm">{c.review}</p>
          )}
        </article>
      ))}
    </section>
  );
}
