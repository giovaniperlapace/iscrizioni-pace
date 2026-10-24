"use server";
import { revalidatePath } from 'next/cache';
import { createCeremonyManagerClient } from '@/lib/ceremonies/access.server';
import { ceremonyContext } from '@/lib/ceremonies/service';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { parseDeskCommand } from '@/lib/ceremonies/seats-desk';
import { manageCeremonyDrafts } from './ceremony-draft-actions';
export async function saveCeremonyDraft(input: unknown) {
  const c = parseDeskCommand(input);
  if (!c) return {status:'invalid'};
  return manageCeremonyDrafts({...c,operation:'save',draftId:null});
}
import { parseRevokeSeat, parseHistoryQuery, parseRevokeAssignment, type AssignmentHistory, type HistoryResult } from '@/lib/ceremonies/assignment-history';
export async function loadCeremonyAssignmentHistory(input: unknown): Promise<HistoryResult> {
  const c = parseHistoryQuery(input);
  if (!c) return { status: 'invalid' };
  const context = await ceremonyContext(await createCeremonyManagerClient());
  if (!context?.canManage) return { status: 'forbidden' };
  const { data, error } = await createSupabaseServiceClient().rpc('get_ceremony_assignment_history', { p_event: context.event.id, p_actor: context.userId, p_plan: c.planId, p_page: c.page, p_search: c.search, p_state: c.state });
  if (error || !data) return { status: error?.code === '42501' ? 'forbidden' : 'unavailable' };
  return { status: 'loaded', history: data as AssignmentHistory };
}
export async function revokeCeremonyAssignment(input: unknown) {
  const c = parseRevokeAssignment(input);
  if (!c) return { status: 'invalid' };
  const context = await ceremonyContext(await createCeremonyManagerClient());
  if (!context?.canManage) return { status: 'forbidden' };
  const { data, error } = await createSupabaseServiceClient().rpc('revoke_ceremony_assignment', { p_event: context.event.id, p_actor: context.userId, p_plan: c.planId, p_revision: c.revision, p_request: c.requestId, p_kind: c.kind, p_id: c.id });
  if (error) return { status: error.code === '42501' ? 'forbidden' : 'unavailable' };
  if (data?.status === 'saved') for (const path of ['/dashboard/manager','/dashboard/admin','/dashboard/partecipante/cerimonie','/dashboard/capogruppo/cerimonie']) revalidatePath(path);
  return { status: typeof data?.status === 'string' ? data.status : 'unavailable' };
}
export async function assignCeremonySeats(input: unknown) {
  const c = parseDeskCommand(input);
  if (!c) return { status: 'invalid' };
  const context = await ceremonyContext(await createCeremonyManagerClient());
  if (!context?.canManage) return { status: 'forbidden' };
  const { data, error } = await createSupabaseServiceClient().rpc('assign_ceremony_seats', { p_event: context.event.id, p_actor: context.userId, p_plan: c.planId, p_revision: c.revision, p_request: c.requestId, p_data: c.data });
  if (error) return { status: error.code === '42501' ? 'forbidden' : error.code === '23505' ? 'occupied' : ['22023','22P02','23514','23502'].includes(error.code) ? 'invalid' : 'unavailable' };
  if (data?.status === 'saved') for (const path of ['/dashboard/manager','/dashboard/admin','/dashboard/partecipante/cerimonie','/dashboard/capogruppo/cerimonie']) revalidatePath(path);
  return { status: typeof data?.status === 'string' ? data.status : 'unavailable' };
}

export async function revokeCeremonySeat(input: unknown) {
  const c = parseRevokeSeat(input);
  if (!c) return { status: 'invalid' };
  const context = await ceremonyContext(await createCeremonyManagerClient());
  if (!context?.canManage) return { status: 'forbidden' };
  const { data, error } = await createSupabaseServiceClient().rpc('revoke_ceremony_seat', { p_event: context.event.id, p_actor: context.userId, p_plan: c.planId, p_revision: c.revision, p_request: c.requestId, p_seat: c.seatId });
  if (error) return { status: error.code === '42501' ? 'forbidden' : 'unavailable' };
  if (data?.status === 'saved') for (const path of ['/dashboard/manager','/dashboard/admin','/dashboard/partecipante/cerimonie','/dashboard/capogruppo/cerimonie']) revalidatePath(path);
  return { status: typeof data?.status === 'string' ? data.status : 'unavailable' };
}
