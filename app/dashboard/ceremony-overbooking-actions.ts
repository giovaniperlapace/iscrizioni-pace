'use server';
import { revalidatePath } from 'next/cache';
import { createCeremonyManagerClient } from '@/lib/ceremonies/access.server';
import { ceremonyContext } from '@/lib/ceremonies/service';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { parseOverbookingCommand } from '@/lib/ceremonies/overbooking';

export async function setCeremonyOverbooking(input: unknown) {
  const c = parseOverbookingCommand(input);
  if (!c) return { status: 'invalid' };
  const context = await ceremonyContext(await createCeremonyManagerClient());
  if (!context?.canManage) return { status: 'forbidden' };
  const { data, error } = await createSupabaseServiceClient().rpc('set_ceremony_overbooking', {
    p_event: context.event.id, p_actor: context.userId, p_plan: c.planId,
    p_sector: c.sectorId, p_revision: c.revision, p_request: c.requestId, p_extra: c.extra,
  });
  if (error) return { status: error.code === '42501' ? 'forbidden' : ['22023','22P02','23514'].includes(error.code) ? 'invalid' : 'unavailable' };
  if (data?.status === 'saved') for (const path of ['/dashboard/manager', '/dashboard/admin']) revalidatePath(path);
  return { status: typeof data?.status === 'string' ? data.status : 'unavailable' };
}
