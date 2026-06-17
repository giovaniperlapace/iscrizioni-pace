import { getMessages } from "@/lib/i18n/messages";
import { getRequestLocale } from "@/lib/i18n/server";

type ConfirmationProps = {
  searchParams: Promise<{
    email?: string;
  }>;
};

export default async function ConfirmationPage({
  searchParams,
}: ConfirmationProps) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  const copy = getMessages(locale).confirmation;
  const homeHref = params.email
    ? `/?email=${encodeURIComponent(params.email)}`
    : "/";

  return (
    <main className="min-h-screen bg-[#f7f8f3] px-5 py-10 text-[#1c241f]">
      <section className="mx-auto max-w-3xl rounded-lg border border-[#d8dece] bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#5d765f]">
          {copy.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{copy.title}</h1>
        <p className="mt-4 leading-7 text-[#4b5a50]">
          {copy.bodyBeforeEmail}{" "}
          <strong>{params.email ?? copy.fallbackEmail}</strong>.{" "}
          {copy.bodyAfterEmail}
        </p>
        <a
          href={homeHref}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-md bg-[#2f5e46] px-5 font-semibold text-white transition hover:bg-[#254b38]"
        >
          {copy.backHome}
        </a>
      </section>
    </main>
  );
}
