import Link from "next/link";

import { getRequestLocale } from "@/lib/i18n/server";
import { getSchoolBookingCopy } from "@/lib/panels/school-booking-copy";

export default async function SchoolBookingConfirmationPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const params = await searchParams;
  const copy = getSchoolBookingCopy(await getRequestLocale());
  const emailFailed = params.email === "failed";
  return <main className="app-page grid place-items-center px-5 py-16 text-[var(--peace-ink)]"><section className="w-full max-w-2xl rounded-xl border border-[var(--peace-border)] bg-white p-7 text-center shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--peace-blue-700)]">{copy.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold">{copy.confirmationTitle}</h1><p className="mx-auto mt-4 max-w-xl leading-7 text-[var(--peace-muted)]">{emailFailed ? "La prenotazione e i posti sono salvati, ma l’email non è partita. Richiedi un nuovo link di accesso: non inviare di nuovo la prenotazione." : copy.confirmationBody}</p><div className="mt-7 flex flex-wrap justify-center gap-3">{emailFailed ? <Link href="/scuole/accesso" className="inline-flex min-h-11 items-center rounded-md bg-[var(--peace-blue-800)] px-4 font-semibold text-white">{copy.manage}</Link> : <Link href="/scuole" className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 font-semibold">{copy.another}</Link>}<Link href="/" className="inline-flex min-h-11 items-center rounded-md border border-[var(--peace-border-strong)] px-4 font-semibold">Home</Link></div></section></main>;
}
