import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import Link from '@/components/pending-link';
import { SuccessMessage } from '@/components/success-message';
import { ManualRegistrationSection } from '@/app/dashboard/manual-registration-section';
import { createGroupLeaderManualRegistration } from '@/app/actions';
import { getCurrentAuthContext } from '@/lib/auth/session';
import { getCurrentOperationalEvent } from '@/lib/events/current';
import { getRequestLocale } from '@/lib/i18n/server';
import { ACCESS_EMAIL_COPY } from '@/lib/email/account-access';
import { canCreateOperationsRegistration } from '@/lib/registrations/manual-registration-access';
import { MANUAL_REGISTRATION_COPY } from '@/lib/registrations/manual-registration-copy';
import { OPERATIONS_MANUAL_COPY } from '@/lib/registrations/operations-manual-copy';
import { buildAttendanceDayColumns } from '@/lib/registrations/attendance-slots';
import { loadAllRows } from '@/lib/supabase/all-rows';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export default async function OperationsNewParticipantPage({ searchParams }: {
  searchParams: Promise<{ manualSaved?: string; manualError?: string }>;
}) {
  const auth = await getCurrentAuthContext(await createSupabaseServerClient(), 'manager');
  if (!auth) redirect('/login');
  const db = createSupabaseServiceClient();
  const event = await getCurrentOperationalEvent(db, 'id,title,starts_on,ends_on');
  if (!event || !canCreateOperationsRegistration(auth.eventRoles, event.id)) {
    redirect('/dashboard/manager?section=iscritti');
  }
  // Load the complete operational catalogue only when opening the insertion form.
  const { data: groups } = await loadAllRows<{ id: string; name: string }>((from, to) => db
    .from('groups').select('id,name').eq('event_id', event.id)
    .eq('is_active', true).eq('is_assignable', true).order('name').order('id').range(from, to));
  const locale = await getRequestLocale();
  const copy = OPERATIONS_MANUAL_COPY[locale];
  const params = await searchParams;
  return (
    <main className="app-page text-[var(--peace-ink)]">
      <div className="mx-auto grid w-full max-w-5xl gap-5 px-5 py-8 sm:px-8">
        <Link href="/dashboard/manager?section=iscritti" className="text-sm font-semibold text-[var(--peace-blue-800)]">← {copy.back}</Link>
        <h1 className="text-2xl font-semibold">{MANUAL_REGISTRATION_COPY[locale].addParticipant}</h1>
        <p className="text-sm text-[var(--peace-muted)]">{event.title}</p>
        {params.manualSaved === '1' ? <SuccessMessage>{copy.saved}</SuccessMessage> : null}
        {params.manualError === 'access-email' ? <p role="alert" className="text-sm text-[#8a3323]">{ACCESS_EMAIL_COPY[locale].failed}</p> : null}
        <div className="surface-card p-5">
          <ManualRegistrationSection
            key={randomUUID()}
            action={createGroupLeaderManualRegistration}
            sourceDashboard="manager"
            groups={groups.map(group => ({ ...group, isAssignable: true }))}
            selectedGroupId={null}
            eventDays={buildAttendanceDayColumns(event.starts_on ?? null, event.ends_on ?? null, locale)}
            locale={locale}
            copy={{ ...MANUAL_REGISTRATION_COPY[locale], manualHelp: copy.help }}
          />
        </div>
      </div>
    </main>
  );
}
