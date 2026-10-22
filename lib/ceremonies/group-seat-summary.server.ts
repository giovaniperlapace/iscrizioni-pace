import type { SupabaseClient } from '@supabase/supabase-js';
import { ceremonySeatRanges, type GroupCeremonySummary, type GroupCeremonyPlaces } from './group-seat-summary.ts';
type Plan = {id:string;kind:'opening'|'closing';revision:number};
type Allocation = {id:string;plan_id:string;quota_id:string;quantity:number};
type Seat = {id:string;sectorId:string;row:string;number:string};
// Called only after the canonical group QR RPC authorizes the current event and
// returns the group ID. Never take the group or event from the incoming command.
export async function readGroupCeremonySummary(db: SupabaseClient, eventId: string, groupId: string): Promise<GroupCeremonySummary> {
  try {
    const plansResult = await db.from('ceremony_plans').select('id,kind,revision').eq('event_id',eventId).eq('state','validated');
    if (plansResult.error) throw Error('plans');
    const plans = plansResult.data as Plan[];
    const items: GroupCeremonyPlaces[] = [];
    async function planRows(table: string, columns: string, planId: string) {
      const rows: {id:string;sector_id?:string;name?:string}[]=[];
      for(let offset=0;;offset+=500) {
        const r=await db.from(table).select(columns).eq('plan_id',planId).order('id').range(offset,offset+499);
        if(r.error) throw Error('layout');
        rows.push(...r.data as unknown as typeof rows); if(r.data.length<500) return rows;
      }
    }
    for (const plan of plans) {
      const allocations: Allocation[] = [];
      for (let offset=0;;offset+=500) {
        const r = await db.from('ceremony_allocations').select('id,plan_id,quota_id,quantity').eq('plan_id',plan.id).eq('group_id',groupId).is('revoked_at',null).order('id').range(offset,offset+499);
        if (r.error) throw Error('allocations');
        allocations.push(...r.data); if (r.data.length<500) break;
      }
      if (!allocations.length) continue;
      const [quotas,sectors,map] = await Promise.all([
        planRows('ceremony_quotas','id,sector_id',plan.id),
        planRows('ceremony_sectors','id,name',plan.id),
        db.from('ceremony_map_versions').select('seats').eq('plan_id',plan.id).eq('state','published').maybeSingle(),
      ]);
      if (map.error) throw Error('layout');
      const seats = new Map<string,Seat>((map.data?.seats ?? []).map((s:Seat)=>[s.id,s]));
      const grouped = new Map<string,{quantity:number;seats:Seat[]}>();
      for (let start=0;start<allocations.length;start+=200) {
        const batch=allocations.slice(start,start+200), claims: {allocation_id:string;seat_id:string}[]=[];
        for (let offset=0;;offset+=500) {
          const r=await db.from('ceremony_seat_claims').select('allocation_id,seat_id').eq('plan_id',plan.id).in('allocation_id',batch.map(a=>a.id)).is('released_at',null).order('id').range(offset,offset+499);
          if (r.error) throw Error('claims'); claims.push(...r.data); if(r.data.length<500) break;
        }
        for (const allocation of batch) {
          const sectorId=quotas.find(q=>q.id===allocation.quota_id)?.sector_id;
          if (!sectorId) throw Error('quota');
          const entry=grouped.get(sectorId) ?? {quantity:0,seats:[]}; entry.quantity+=allocation.quantity;
          for (const claim of claims.filter(c=>c.allocation_id===allocation.id)) {
            const seat=seats.get(claim.seat_id); if(!seat || seat.sectorId!==sectorId) throw Error('seat'); entry.seats.push(seat);
          }
          grouped.set(sectorId,entry);
        }
      }
      const current = await db.from('ceremony_plans').select('revision,state').eq('event_id',eventId).eq('id',plan.id).maybeSingle();
      if(current.error || current.data?.revision !== plan.revision || current.data?.state !== 'validated') throw Error('changed');
      for (const [sectorId,entry] of grouped) {
        const sector=sectors.find(s=>s.id===sectorId)?.name;
        if (!sector || entry.seats.length>entry.quantity) throw Error('sector');
        items.push({kind:plan.kind,sector,quantity:entry.quantity,ranges:ceremonySeatRanges(sector,entry.seats),unnumbered:entry.quantity-entry.seats.length});
      }
    }
    items.sort((a,b)=>a.kind===b.kind ? a.sector.localeCompare(b.sector,'it',{numeric:true}) : a.kind==='opening' ? -1 : 1);
    return {status:'ready',items};
  } catch { return {status:'unavailable'}; }
}
