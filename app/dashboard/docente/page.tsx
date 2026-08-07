import Image from "next/image";
import Link from "next/link";

import { cancelTeacherSchoolBooking, updateTeacherSchoolBooking } from "@/app/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { getRequestLocale } from "@/lib/i18n/server";
import { getSchoolBookingCatalog } from "@/lib/panels/school-bookings";
import { getSchoolBookingCopy, getTeacherFlowCopy } from "@/lib/panels/school-booking-copy";
import { renderQrDataUrl } from "@/lib/qrcode/render";
import { decryptQrToken } from "@/lib/qrcode/secure-token";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ error?: string; saved?: string; cancelled?: string }> };

export default async function TeacherDashboardPage({ searchParams }: Props) {
  const [locale, params, supabase] = await Promise.all([getRequestLocale(), searchParams, createSupabaseServerClient()]);
  const copy = getSchoolBookingCopy(locale);
  const teacherCopy = getTeacherFlowCopy(locale);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  await supabase.rpc("link_current_school_teacher_identity");
  const { data: event } = await supabase.from("events").select("id,title").eq("is_current", true).limit(1).maybeSingle();
  const catalog = event ? await getSchoolBookingCatalog(supabase, event.id) : { bookings: [], panelOptions: [] };
  const { data: qrRows } = catalog.bookings.length ? await supabase.from("school_booking_qr_tokens").select("booking_id,token_encrypted,status").in("booking_id", catalog.bookings.map((booking) => booking.id)).eq("status", "active") : { data: [] };
  const qrByBooking = new Map(await Promise.all(((qrRows ?? []) as Array<{ booking_id: string; token_encrypted: string }>).map(async (row) => {
    const token = decryptQrToken(row.token_encrypted);
    return [row.booking_id, token ? await renderQrDataUrl(token) : null] as const;
  })));

  return <main className="app-page text-[var(--peace-ink)]"><section className="event-gradient py-9 text-white"><div className="app-container"><p className="text-xs font-bold uppercase tracking-[0.14em] text-white/75">{copy.eyebrow}</p><h1 className="mt-2 text-3xl font-semibold">{copy.manage}</h1><p className="mt-3 text-white/80">{user.email}</p></div></section><section className="app-container grid gap-6 py-8">
    {params.saved ? <Status>{teacherCopy.saved}</Status> : null}{params.cancelled ? <Status>{teacherCopy.cancelled}</Status> : null}{params.error ? <p role="alert" className="rounded-md border border-[#d9a99d] bg-[#fff0eb] px-4 py-3 text-sm text-[#7f2f20]">{params.error === "capacity" ? copy.capacity : params.error === "overlap" ? copy.overlap : copy.invalid}</p> : null}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm leading-6 text-[var(--peace-muted)]">{teacherCopy.dashboardIntro}</p><Link href="/scuole" className="inline-flex min-h-11 items-center rounded-md bg-[var(--peace-blue-800)] px-4 font-semibold text-white">{copy.another}</Link></div>
    {catalog.bookings.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--peace-border-strong)] bg-white p-6 text-[var(--peace-muted)]">{teacherCopy.empty}</p> : catalog.bookings.map((booking) => {
      const activeReservations = new Map(booking.reservations.filter((row) => row.status === "reserved").map((row) => [row.sectionId, row]));
      const qrDataUrl = qrByBooking.get(booking.id);
      return <article key={booking.id} className="rounded-xl border border-[var(--peace-border)] bg-white p-5 shadow-sm sm:p-7"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--peace-blue-700)]">{teacherCopy.bookingStatuses[booking.status]}</p><h2 className="mt-1 text-2xl font-semibold">{booking.schoolName}</h2><p className="mt-1 text-[var(--peace-muted)]">{booking.classDescription} · {booking.schoolCity}</p></div>{qrDataUrl ? <div className="text-center"><Image src={qrDataUrl} alt={teacherCopy.qrAlt} width={144} height={144} unoptimized className="rounded-md border border-[var(--peace-border)]" /><a href={qrDataUrl} download={`qr-scuola-${booking.id.slice(0, 8)}.png`} className="mt-2 inline-flex text-sm font-semibold text-[var(--peace-blue-800)]">{teacherCopy.downloadQr}</a></div> : null}</div>
      {booking.status !== "cancelled" ? <form action={updateTeacherSchoolBooking} className="mt-6 grid gap-5"><input type="hidden" name="bookingId" value={booking.id} /><input type="hidden" name="eventId" value={booking.eventId} /><input type="hidden" name="teacherEmail" value={booking.teacher.email} /><div className="grid gap-4 md:grid-cols-2"><Field label={copy.firstName} name="teacherFirstName" value={booking.teacher.firstName} maxLength={120} /><Field label={copy.lastName} name="teacherLastName" value={booking.teacher.lastName} maxLength={120} /><Field label={copy.phone} name="teacherPhone" value={booking.teacher.phone} maxLength={40} /><Field label={copy.schoolName} name="schoolName" value={booking.schoolName} maxLength={180} /><Field label={copy.schoolCity} name="schoolCity" value={booking.schoolCity} maxLength={120} /><Field label={copy.classDescription} name="classDescription" value={booking.classDescription} maxLength={180} /><Field label={copy.students} name="studentCount" value={booking.studentCount} type="number" min={1} max={1000} /><Field label={copy.companions} name="companionCount" value={booking.companionCount} type="number" min={1} max={100} /></div><fieldset className="grid gap-3"><legend className="font-semibold">{copy.panels}</legend>{catalog.panelOptions.map((panel) => { const reservation = activeReservations.get(panel.sectionId); return <div key={panel.sectionId} className="grid gap-3 rounded-md border border-[var(--peace-border)] p-4 md:grid-cols-[minmax(0,1fr)_8rem_8rem] md:items-end"><label className="flex gap-3"><input type="checkbox" name="sectionIds" value={panel.sectionId} defaultChecked={Boolean(reservation)} className="mt-1 size-5" /><span><span className="block font-semibold">{panel.title}</span><span className="block text-sm text-[var(--peace-muted)]">{formatDate(panel.startsAt, locale)} · {panel.locationName || teacherCopy.locationUnavailable}</span></span></label><input type="hidden" name={`panelId:${panel.sectionId}`} value={panel.panelId} /><Field label={copy.students} name={`students:${panel.sectionId}`} value={reservation?.studentCount ?? booking.studentCount} type="number" min={1} max={booking.studentCount} /><Field label={copy.companions} name={`companions:${panel.sectionId}`} value={reservation?.companionCount ?? booking.companionCount} type="number" min={1} max={booking.companionCount} /></div>; })}</fieldset><div className="flex flex-wrap justify-between gap-3"><PendingSubmitButton formAction={cancelTeacherSchoolBooking} name="bookingId" value={booking.id} pendingLabel="…" className="min-h-11 rounded-md border border-[#cf9b8e] px-4 font-semibold text-[#8a3323]">{teacherCopy.cancelBooking}</PendingSubmitButton><PendingSubmitButton pendingLabel="…" className="min-h-11 rounded-md bg-[var(--peace-blue-800)] px-4 font-semibold text-white">{teacherCopy.saveChanges}</PendingSubmitButton></div></form> : null}</article>;
    })}
  </section></main>;
}

function Field({ label, name, value, type = "text", maxLength, min, max }: { label: string; name: string; value: string | number; type?: string; maxLength?: number; min?: number; max?: number }) { return <label className="grid gap-1 text-sm font-semibold">{label}<input required name={name} defaultValue={value} type={type} maxLength={maxLength} min={min} max={max} className="field font-normal" /></label>; }
function formatDate(value: string, locale: string) { return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(value)); }
function Status({ children }: { children: React.ReactNode }) { return <p role="status" className="rounded-md border border-[#a9d5b1] bg-[#eef9ef] px-4 py-3 text-sm text-[#255b34]">{children}</p>; }
