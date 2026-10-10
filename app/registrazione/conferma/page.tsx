import { parseForumIntent } from "@/lib/panels/booking-intent";
import { getEventProgramCopy } from "@/lib/events/program-copy";
import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";
import { EventIdentity } from "@/components/event-identity";

type ConfirmationProps = {
  searchParams: Promise<{
    email?: string;
    forum?: string;
  }>;
};

export default async function ConfirmationPage({
  searchParams,
}: ConfirmationProps) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const copy = getMessages(locale).confirmation;
  const forum = parseForumIntent(params.forum);
  const emailQuery = params.email ? `?email=${encodeURIComponent(params.email)}` : "";
  const homeHref = forum ? `/forum/${forum}${emailQuery}` : `/${emailQuery}`;

  return (
    <main className="app-page px-5 py-10 text-[var(--peace-ink)]">
      <section className="surface-card mx-auto max-w-3xl overflow-hidden">
        <div className="event-gradient px-6 py-7">
          <EventIdentity compact inverted />
        </div>
        <div className="p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--peace-blue-800)]">
          {copy.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl font-semibold">{copy.title}</h2>
        <p className="mt-4 leading-7 text-[var(--peace-muted)]">
          {copy.bodyBeforeEmail}{" "}
          <strong>{params.email ?? copy.fallbackEmail}</strong>.{" "}
          {copy.bodyAfterEmail}
        </p>
        <a
          href={homeHref}
          className="btn-primary mt-6 inline-flex items-center justify-center px-5"
        >
          {forum ? getEventProgramCopy(locale).accessCta : copy.backHome}
        </a>
        </div>
      </section>
    </main>
  );
}
