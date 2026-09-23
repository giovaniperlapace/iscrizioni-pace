import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { LocalOverlay } from '@/app/dashboard/local-overlay';
import { OperationsManualDialog } from '@/app/dashboard/operations-manual-dialog';
import { manualRegistrationPath } from '@/lib/registrations/manual-registration-navigation';
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

export async function OperationsManualRegistration({ dashboard, searchParams }: {
  dashboard: 'admin' | 'manager';
  searchParams: Record<string, string | undefined>;
}) {
  const current = new URLSearchParams(Object.entries(searchParams).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  const closePath = manualRegistrationPath(`/dashboard/${dashboard}?${current}`, dashboard);
  const auth = await getCurrentAuthContext(await createSupabaseServerClient(), 'manager');
  if (!auth) redirect('/login');
  const db = createSupabaseServiceClient();
  const event = await getCurrentOperationalEvent(db, 'id,title,starts_on,ends_on');
  if (!event || !canCreateOperationsRegistration(auth.eventRoles, event.id)) {
    redirect(closePath);
  }
  // Load the complete operational catalogue only when opening the insertion form.
  const { data: groups } = await loadAllRows<{ id: string; name: string }>((from, to) => db
    .from('groups').select('id,name').eq('event_id', event.id)
    .eq('is_active', true).eq('is_assignable', true).order('name').order('id').range(from, to));
  const locale = await getRequestLocale();
  const copy = OPERATIONS_MANUAL_COPY[locale];
  const params = searchParams;
  return (
    <LocalOverlay parameter="manual" value="1">
      <OperationsManualDialog key={randomUUID()} closePath={closePath} closeLabel={copy.close}
        title={MANUAL_REGISTRATION_COPY[locale].addParticipant} eventTitle={event.title}>
        {params.manualSaved === '1' ? <SuccessMessage>{copy.saved}</SuccessMessage> : null}
        {params.manualError === 'access-email' ? <p role="alert" className="text-sm text-[#8a3323]">{ACCESS_EMAIL_COPY[locale].failed}</p> : null}
        <ManualRegistrationSection
          action={createGroupLeaderManualRegistration}
          sourceDashboard="manager"
          returnTo={closePath}
          groups={groups.map(group => ({ ...group, isAssignable: true }))}
          selectedGroupId={null}
          eventDays={buildAttendanceDayColumns(event.starts_on ?? null, event.ends_on ?? null, locale)}
          locale={locale}
          copy={{ ...MANUAL_REGISTRATION_COPY[locale], manualHelp: copy.help }}
        />
      </OperationsManualDialog>
    </LocalOverlay>
  );
}
