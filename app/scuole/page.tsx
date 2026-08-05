import type { Metadata } from "next";
import Link from "next/link";

import { submitPublicSchoolBooking } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { EventIdentity, PeaceLineMark } from "@/components/event-identity";
import { getRequestLocale } from "@/lib/i18n/server";
import { getPublicSchoolBookingOptions } from "@/lib/panels/public-school-bookings";
import { getSchoolBookingCopy } from "@/lib/panels/school-booking-copy";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ error?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const copy = getSchoolBookingCopy(await getRequestLocale());
  return { title: `${copy.homeTitle} - UNHARMED AND DISARMING PEACE`, description: copy.homeBody };
}

export default async function SchoolBookingPage({ searchParams }: Props) {
  const [locale, params, supabase] = await Promise.all([getRequestLocale(), searchParams, createSupabaseServerClient()]);
  const copy = getSchoolBookingCopy(locale);
  const options = await getPublicSchoolBookingOptions(supabase);
  const error = errorMessage(params.error, copy);

  return <main className="app-page text-[var(--peace-ink)]">
    <section className="event-gradient relative isolate overflow-hidden py-10 text-white sm:py-14">
      <PeaceLineMark className="absolute left-[75%] top-10 -z-10 h-52 w-[45rem] -translate-x-1/2 opacity-20" />
      <div className="app-container"><EventIdentity inverted /><p className="mt-7 text-xs font-bold uppercase tracking-[0.14em] text-white/75">{copy.eyebrow}</p><h1 className="mt-2 max-w-3xl text-3xl font-semibold sm:text-4xl">{copy.title}</h1><p className="mt-4 max-w-3xl leading-7 text-white/85">{copy.intro}</p></div>
    </section>
    <section className="app-container py-8 sm:py-12">
      {!options.event || options.panels.length === 0 ? <div className="rounded-xl border border-[var(--peace-border)] bg-white p-6"><p>{copy.unavailable}</p><Link href="/" className="mt-4 inline-flex font-semibold text-[var(--peace-blue-800)]">← Home</Link></div> :
      <form action={submitPublicSchoolBooking} className="mx-auto grid max-w-4xl gap-6 rounded-xl border border-[var(--peace-border)] bg-white p-5 shadow-sm sm:p-7">
        <input type="hidden" name="locale" value={locale} />
        {error ? <p role="alert" className="rounded-md border border-[#d9a99d] bg-[#fff0eb] px-4 py-3 text-sm text-[#7f2f20]">{error}</p> : null}
        <fieldset className="grid gap-4"><legend className="text-xl font-semibold">{copy.teacher}</legend><div className="grid gap-4 md:grid-cols-2"><Field label={copy.firstName} name="teacherFirstName" maxLength={120} /><Field label={copy.lastName} name="teacherLastName" maxLength={120} /><Field label={copy.email} name="teacherEmail" type="email" maxLength={320} /><Field label={copy.phone} name="teacherPhone" type="tel" maxLength={40} /></div></fieldset>
        <fieldset className="grid gap-4 border-t border-[var(--peace-border)] pt-6"><legend className="text-xl font-semibold">{copy.school}</legend><div className="grid gap-4 md:grid-cols-2"><Field label={copy.schoolName} name="schoolName" maxLength={180} /><Field label={copy.schoolCity} name="schoolCity" maxLength={120} /><Field label={copy.classDescription} name="classDescription" maxLength={180} wide /><Field label={copy.students} name="studentCount" type="number" min={1} max={1000} defaultValue={20} /><Field label={copy.companions} name="companionCount" type="number" min={1} max={100} defaultValue={2} /></div></fieldset>
        <fieldset className="grid gap-3 border-t border-[var(--peace-border)] pt-6"><legend className="text-xl font-semibold">{copy.panels}</legend><p className="text-sm leading-6 text-[var(--peace-muted)]">{copy.panelsHelp}</p>{options.panels.map((panel) => <div key={panel.sectionId} className="grid gap-4 rounded-lg border border-[var(--peace-border)] p-4 md:grid-cols-[minmax(0,1fr)_8rem_8rem] md:items-end"><label className="flex gap-3"><input type="checkbox" name="sectionIds" value={panel.sectionId} className="mt-1 size-5" /><span><span className="block font-semibold">{panel.title}</span><span className="block text-sm leading-6 text-[var(--peace-muted)]">{formatPanel(panel.startsAt, panel.endsAt, locale)}{panel.locationName ? ` · ${panel.locationName}` : ""}</span>{panel.description ? <span className="mt-1 block text-sm text-[var(--peace-muted)]">{panel.description}</span> : null}</span></label><input type="hidden" name={`panelId:${panel.sectionId}`} value={panel.panelId} /><Field label={copy.students} name={`students:${panel.sectionId}`} type="number" min={1} max={1000} defaultValue={20} /><Field label={copy.companions} name={`companions:${panel.sectionId}`} type="number" min={1} max={100} defaultValue={2} /></div>)}</fieldset>
        <label className="flex gap-3 rounded-lg border border-[var(--peace-border)] bg-[#f7fbfe] p-4 text-sm leading-6"><input required type="checkbox" name="privacyAccepted" value="yes" className="mt-1 size-5 shrink-0" /><span>{copy.privacy}</span></label>
        <div className="flex flex-wrap items-center justify-between gap-4"><Link href="/" className="font-semibold text-[var(--peace-blue-800)]">← Home</Link><PendingSubmitButton pendingLabel="…" className="min-h-12 rounded-md bg-[var(--peace-blue-800)] px-5 font-semibold text-white">{copy.submit}</PendingSubmitButton></div>
      </form>}
    </section>
  </main>;
}

function Field({ label, name, type = "text", maxLength, min, max, defaultValue, wide = false }: { label: string; name: string; type?: string; maxLength?: number; min?: number; max?: number; defaultValue?: number; wide?: boolean }) {
  return <label className={`grid gap-1 text-sm font-semibold ${wide ? "md:col-span-2" : ""}`}>{label}<input required name={name} type={type} maxLength={maxLength} min={min} max={max} defaultValue={defaultValue} className="field font-normal" /></label>;
}

function formatPanel(startsAt: string, endsAt: string, locale: string) {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Rome" }).format(new Date(startsAt));
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  return `${date}, ${time.format(new Date(startsAt))}–${time.format(new Date(endsAt))}`;
}

function errorMessage(code: string | undefined, copy: ReturnType<typeof getSchoolBookingCopy>) {
  if (code === "capacity") return copy.capacity;
  if (code === "overlap") return copy.overlap;
  if (code === "rate") return copy.rate;
  if (code === "closed") return copy.unavailable;
  return code ? copy.invalid : null;
}
