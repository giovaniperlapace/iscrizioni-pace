import { NEXT_EDITION_COPY } from "@/lib/events/next-edition-copy";
import type { SupportedLocale } from "@/lib/i18n/config";

export function NextEditionAnnouncement({ locale }: { locale: SupportedLocale }) {
  const copy = NEXT_EDITION_COPY[locale];

  return (
    <section aria-labelledby="next-edition-title" className="mb-8 rounded-2xl border border-white/30 bg-white px-5 py-6 text-center text-[var(--peace-blue-950)] shadow-sm sm:px-8 sm:py-7">
      <h2 id="next-edition-title" className="text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
        {copy.title}
      </h2>
      <p className="mt-3 text-base leading-7 sm:text-lg">{copy.description}</p>
    </section>
  );
}
