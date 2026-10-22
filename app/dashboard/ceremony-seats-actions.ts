"use server";
import { revalidatePath } from 'next/cache';
import { createCeremonyManagerClient } from '@/lib/ceremonies/access.server';
import { ceremonyContext } from '@/lib/ceremonies/service';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { parseDeskCommand } from '@/lib/ceremonies/seats-desk';
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
