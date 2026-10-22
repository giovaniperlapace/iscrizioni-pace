import Link from '@/components/pending-link';
import { createCeremonyManagerClient } from '@/lib/ceremonies/access.server';
import { ceremonyContext } from '@/lib/ceremonies/service';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { loadOperationsParticipantPage } from '@/lib/registrations/operations-page.server';
import { parseOperationsDashboardFilters } from '@/lib/registrations/operations-dashboard';
import { attendanceTableColumns } from '@/lib/registrations/attendance-summary';
import type { SeatsDesk, SeatPerson } from '@/lib/ceremonies/seats-desk';
import { CeremonySeatsWorkspace } from './ceremony-seats-workspace';
import { assignCeremonySeats } from './ceremony-seats-actions';
export async function CeremonySeatsSection({ params, dashboard, navMode }: { params: Record<string,string | undefined>; dashboard: 'admin'|'manager'; navMode: 'full'|'mini' }) {
  const context = await ceremonyContext(await createCeremonyManagerClient());
  if (!context?.canManage) return null;
  const kind = params.kind === 'closing' ? 'closing' : 'opening';
  const service = createSupabaseServiceClient();
  const { data, error } = await service.rpc('get_ceremony_seats_desk', { p_event: context.event.id, p_actor: context.userId, p_kind: kind });
  if (error) throw Error('Impossibile caricare i posti delle cerimonie. Riprova.');
  const desk = data as SeatsDesk | null;
  const header = <header className="surface-card grid gap-3 p-5"><h1 className="text-2xl font-bold">Posti cerimonie</h1><nav aria-label="Cerimonia" className="flex flex-wrap gap-2">{(['opening','closing'] as const).map(k => <Link key={k} prefetch={false} href={`/dashboard/${dashboard}?section=cerimonie&kind=${k}&nav=${navMode}`} aria-current={k === kind ? 'page' : undefined} className={k === kind ? 'btn-primary px-4 py-2' : 'btn-secondary px-4 py-2'}>{k === 'opening' ? 'Inaugurazione' : 'Cerimonia finale'}</Link>)}</nav></header>;
  if (!desk || desk.state !== 'validated') return <div className="grid gap-4">{header}<p className="surface-card p-5">La disposizione di questa cerimonia non è ancora disponibile.</p></div>;
  const directory = await loadOperationsParticipantPage(service, { event: context.event, actorId: context.userId, canManage: true, dashboard, locale: 'it', filters: parseOperationsDashboardFilters(params), params: { ...params, view: undefined, edit: undefined, sort: 'name', direction: 'asc' }, activeRegistrationsOnly: true, priorityAttendanceSlot: { day: desk.day, part: desk.part } });
  const people: SeatPerson[] = directory.participants.map(p => {
    const choices = (p.attendance ?? []).filter(a => a.day === desk.day && (!a.day_part || a.day_part === desk.part || desk.part === 'day'));
    const priority = choices.some(a => a.choice === 'yes');
    return { registrationId: p.registrationId, name: p.name, code: p.publicCode ?? '', place: p.place, group: p.currentGroupName, priority, attendance: priority ? 'Presenza comunicata: sì' : choices.some(a => a.choice === 'no') ? 'Presenza comunicata: no' : 'Presenza da comunicare', children: p.children.map(c => ({ id: c.id, name: [c.first_name,c.last_name].filter(Boolean).join(' ') })) };
  });
  return <div className="grid min-w-0 gap-4">{header}<CeremonySeatsWorkspace key={desk.planId} desk={desk} people={people} page={directory.serverPage!} filterProps={{ filters: directory.filters, groupOptions: directory.groupOptions, eventServices: directory.eventServices, operationalTags: directory.operationalTags, attendanceColumns: attendanceTableColumns(desk.day,desk.day), dashboard, navMode }} save={assignCeremonySeats}/></div>;
}
