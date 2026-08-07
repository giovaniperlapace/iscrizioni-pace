import Link from "next/link";

import { requestSchoolBookingAccess } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSchoolBookingCopy, getTeacherFlowCopy } from "@/lib/panels/school-booking-copy";

export default async function SchoolAccessPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const [locale, params] = await Promise.all([getRequestLocale(), searchParams]);
  const copy = getSchoolBookingCopy(locale);
  const teacherCopy = getTeacherFlowCopy(locale);
  return <main className="app-page grid place-items-center px-5 py-16 text-[var(--peace-ink)]"><section className="w-full max-w-lg rounded-xl border border-[var(--peace-border)] bg-white p-7 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--peace-blue-700)]">{copy.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold">{copy.manage}</h1><p className="mt-3 leading-7 text-[var(--peace-muted)]">{teacherCopy.accessIntro}</p>{params.sent ? <p role="status" className="mt-5 rounded-md border border-[#a9d5b1] bg-[#eef9ef] px-4 py-3 text-sm text-[#255b34]">{teacherCopy.accessSent}</p> : null}{params.error ? <p role="alert" className="mt-5 rounded-md border border-[#d9a99d] bg-[#fff0eb] px-4 py-3 text-sm text-[#7f2f20]">{params.error === "rate" ? copy.rate : teacherCopy.accessError}</p> : null}<form action={requestSchoolBookingAccess} className="mt-6 grid gap-4"><label className="grid gap-1 text-sm font-semibold">{copy.email}<input required name="email" type="email" maxLength={320} className="field font-normal" autoComplete="email" /></label><PendingSubmitButton pendingLabel="…" className="min-h-12 rounded-md bg-[var(--peace-blue-800)] px-5 font-semibold text-white">{copy.manage}</PendingSubmitButton></form><Link href="/scuole" className="mt-5 inline-flex font-semibold text-[var(--peace-blue-800)]">← {copy.homeTitle}</Link></section></main>;
}
