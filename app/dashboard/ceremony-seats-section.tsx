import Link from '@/components/pending-link';
import { createCeremonyManagerClient } from '@/lib/ceremonies/access.server';
import { ceremonyContext } from '@/lib/ceremonies/service';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import type { SeatsDesk } from '@/lib/ceremonies/seats-desk';
import { CeremonySectorWorkspace } from './ceremony-sector-workspace';
import { revokeCeremonyAssignment, saveCeremonyDraft } from './ceremony-seats-actions';
import { manageCeremonyDrafts } from './ceremony-draft-actions';
export async function CeremonySeatsSection({ params, dashboard, navMode }: { params: Record<string,string | undefined>; dashboard: 'admin'|'manager'; navMode: 'full'|'mini' }) {
  const context = await ceremonyContext(await createCeremonyManagerClient());
  if (!context?.canManage) return null;
  const kind = params.kind === 'closing' ? 'closing' : 'opening';
  const service = createSupabaseServiceClient();
  const { data, error } = await service.rpc('get_ceremony_draft_desk', { p_event: context.event.id, p_actor: context.userId, p_kind: kind });
  if (error) throw Error('Impossibile caricare i posti delle cerimonie. Riprova.');
  const desk = data as SeatsDesk | null;
  const header = <header className="surface-card grid gap-3 p-5"><h1 className="text-2xl font-bold">Posti cerimonie</h1><nav aria-label="Cerimonia" className="flex flex-wrap gap-2">{(['opening','closing'] as const).map(k => <Link key={k} prefetch={false} href={`/dashboard/${dashboard}?section=cerimonie&kind=${k}&nav=${navMode}`} aria-current={k === kind ? 'page' : undefined} className={k === kind ? 'btn-primary px-4 py-2' : 'btn-secondary px-4 py-2'}>{k === 'opening' ? 'Inaugurazione' : 'Cerimonia finale'}</Link>)}</nav></header>;
  if (!desk || desk.state !== 'validated') return <div className="grid gap-4">{header}<p className="surface-card p-5">La disposizione di questa cerimonia non è ancora disponibile.</p></div>;
  return <div className="grid min-w-0 gap-4">{header}<CeremonySectorWorkspace key={desk.planId} initialDesk={desk} save={saveCeremonyDraft} manageDrafts={manageCeremonyDrafts} revoke={revokeCeremonyAssignment}/></div>;
}
