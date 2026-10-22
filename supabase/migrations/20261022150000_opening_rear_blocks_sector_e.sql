-- Rear blocks become E7/E8. Seat UUIDs retain their original H-based identity.
-- New installations use the same definitive layout as the current event.
create or replace function public.prepare_opening_ceremony_layout(p_event uuid,p_actor uuid,p_revision integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.ceremony_plans; item record; sid uuid; result jsonb; seats jsonb;
begin
 if not app.ceremony_authorize(p_event,p_actor,true) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 if p_revision is distinct from -1 or exists(select 1 from public.ceremony_plans where event_id=p_event and kind='opening') then return jsonb_build_object('status','conflict');end if;
 result:=public.save_ceremony(p_event,p_actor,'opening',-1,'configure',jsonb_build_object('location','Umbria Fiere · Padiglione 9 e sala collegata','capacity',3540,'startsAt','2026-10-25T16:30','endsAt','2026-10-25T19:00','attendancePart','afternoon','state','draft'));
 if result->>'status'<>'saved' then return result;end if;
 select * into p from public.ceremony_plans where event_id=p_event and kind='opening' for update;
 update public.ceremony_plans set layout_key='assisi-opening-2026' where id=p.id;
 for item in select * from (values
  ('A1',100,true,100),('A',400,true,110),('A2',100,true,100),
  ('B1',300,true,300),('B2',300,true,300),('C',600,true,600),
  ('D',600,true,600),('E',740,true,740),('F',400,false,400)
 ) as areas(code,capacity,numbered,assignable) loop
  sid:=md5(p.id::text||':sector:'||item.code)::uuid;
  insert into public.ceremony_sectors(id,plan_id,name,capacity,numbered,layout_code,assignable_limit)
   values(sid,p.id,item.code,item.capacity,item.numbered,item.code,item.assignable);
  insert into public.ceremony_quotas(id,plan_id,sector_id,category,quantity)
   values(md5(p.id::text||':quota:'||item.code)::uuid,p.id,sid,'Partecipanti',item.assignable);
 end loop;
 -- Blocks b1..b6 run left to right while facing the stage (bottom to top in the photograph).
 with main as (
  select band,block,row_no,chair,
   case when band=0 then case block when 1 then 'A1' when 6 then 'A2' else 'A' end
        when band=1 then case when row_no<=5 then 'B1' else 'B2' end
        else chr(65+band) end code,
   chr(65+band)||'-b'||block||'-r'||lpad(row_no::text,2,'0') row_label,
   180+band*650+(row_no-1)*54 x, 120+(6-block)*650+(10-chair)*54 y,
   band=0 and block between 2 and 5 and row_no < case when block=2 then 9 else 8 end blocked
  from generate_series(0,4) band cross join generate_series(1,6) block cross join generate_series(1,10) row_no cross join generate_series(1,10) chair
 ), rear as (
  select 5 band,block,row_no,chair,'E' code,
   (case block when 1 then 'E-b7' else 'E-b8' end)||'-r'||lpad(row_no::text,2,'0') row_label,
   3430+(row_no-1)*54 x,120+(6-block)*650+(10-chair)*54 y,false blocked
  from (values(1),(6)) b(block) cross join generate_series(1,7) row_no cross join generate_series(1,10) chair
 ), all_seats as (select * from main union all select * from rear)
 select jsonb_agg(jsonb_build_object('id',md5(p.id::text||':seat:'||replace(replace(row_label,'E-b7-','H1-'),'E-b8-','H2-')||':'||chair)::uuid,
  'sectorId',md5(p.id::text||':sector:'||code)::uuid,'row',row_label,'number',chair::text,'x',x,'y',y,'blocked',blocked) order by band,block,row_no,chair) into seats from all_seats;
 result:=public.set_ceremony_map(p_event,p_actor,p.id,p.revision,gen_random_uuid(),'draft',jsonb_build_object('title','Inaugurazione · Padiglione 9','seats',seats));
 if result->>'status'<>'saved' then raise exception 'Layout preparation failed';end if;
 return jsonb_build_object('status','saved');
end $$;
revoke all on function public.prepare_opening_ceremony_layout(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.prepare_opening_ceremony_layout(uuid,uuid,integer) to service_role;
notify pgrst,'reload schema';

-- This narrowly scoped maintenance runs under the same lock as assignments.
-- Refuse unexpected configurations or ANY historical H allocations; never
-- release claims, disable triggers, rewrite history or guess how to merge them.
do $$
declare
 p public.ceremony_plans; old_map public.ceremony_map_versions;
 e_sector public.ceremony_sectors; h_ids uuid[]; h record;
 new_seats jsonb; new_map uuid; old_total bigint; old_quota bigint;
begin
 for p in select cp.* from public.ceremony_plans cp join public.events ev on ev.id=cp.event_id
  where ev.is_current and cp.kind='opening' and cp.layout_key='assisi-opening-2026'
 loop
  perform pg_advisory_xact_lock(hashtextextended(p.event_id::text,1381));
  select * into p from public.ceremony_plans where id=p.id for update;
  select array_agg(id order by layout_code) into h_ids from public.ceremony_sectors where plan_id=p.id and layout_code in ('H1','H2');
  if h_ids is null then continue; end if;
  select * into e_sector from public.ceremony_sectors where plan_id=p.id and layout_code='E';
  select * into old_map from public.ceremony_map_versions where plan_id=p.id and state='published' for update;
  if cardinality(h_ids)<>2 or e_sector.id is null or e_sector.capacity<>600 or e_sector.assignable_limit is distinct from 600
   or not e_sector.numbered or p.state<>'validated' or old_map.id is null
   or jsonb_array_length(old_map.seats)<>3140
   or exists(select 1 from public.ceremony_map_versions where plan_id=p.id and state='draft') then
   raise exception 'Unexpected opening layout; rear-block conversion aborted';
  end if;
  if exists(select 1 from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id where q.sector_id=any(h_ids))
   or exists(select 1 from public.ceremony_seat_claims c join public.ceremony_seat_identities i on i.id=c.seat_id where i.sector_id=any(h_ids)) then
   raise exception 'H allocations or claims exist; rear-block conversion aborted';
  end if;
  if (select count(*) from public.ceremony_quotas where sector_id=e_sector.id)<>1
   or not exists(select 1 from public.ceremony_quotas where sector_id=e_sector.id and category='Partecipanti' and quantity=600)
   or (select count(*) from jsonb_array_elements(old_map.seats) s where (s->>'sectorId')::uuid=e_sector.id)<>600 then
   raise exception 'Unexpected E quota or seats; rear-block conversion aborted';
  end if;
  for h in select * from public.ceremony_sectors where id=any(h_ids) loop
   if h.capacity<>70 or h.assignable_limit is distinct from 70 or not h.numbered
    or (select count(*) from public.ceremony_quotas where sector_id=h.id)<>1
    or not exists(select 1 from public.ceremony_quotas where sector_id=h.id and quantity=70 and category='Partecipanti')
    or (select count(*) from public.ceremony_seat_identities where sector_id=h.id)<>70
    or (select count(*) from jsonb_array_elements(old_map.seats) s where (s->>'sectorId')::uuid=h.id)<>70
    or exists(select 1 from jsonb_array_elements(old_map.seats) s where (s->>'sectorId')::uuid=h.id and (
      s->>'row' !~ ('^'||h.layout_code||'-r0[1-7]$') or s->>'number' !~ '^([1-9]|10)$' or (s->>'blocked')::boolean
      or not exists(select 1 from public.ceremony_seat_identities i where i.id=(s->>'id')::uuid and i.sector_id=h.id and i.plan_id=p.id))) then
    raise exception 'Unexpected H configuration; rear-block conversion aborted';
   end if;
  end loop;
  select sum(capacity) into old_total from public.ceremony_sectors where plan_id=p.id;
  select sum(quantity) into old_quota from public.ceremony_quotas where plan_id=p.id;
  select jsonb_agg(case when (s->>'sectorId')::uuid=any(h_ids)
    then s||jsonb_build_object('sectorId',e_sector.id,'row',replace(replace(s->>'row','H1-','E-b7-'),'H2-','E-b8-'))
    else s end order by ord) into new_seats from jsonb_array_elements(old_map.seats) with ordinality as x(s,ord);
  if exists(select 1 from jsonb_array_elements(new_seats) s group by s->>'sectorId',s->>'row',s->>'number' having count(*)>1)
   or exists(select 1 from public.ceremony_seat_claims c where c.plan_id=p.id and c.released_at is null and not exists(
    select 1 from jsonb_array_elements(new_seats) s join jsonb_array_elements(old_map.seats) old_s on old_s->>'id'=s->>'id'
    where (s->>'id')::uuid=c.seat_id and s=old_s)) then
   raise exception 'Existing seat assignment would change; conversion aborted';
  end if;
  -- Archive the old document intact; all changes below commit together.
  update public.ceremony_map_versions set state='archived' where id=old_map.id;
  update public.ceremony_seat_identities set sector_id=e_sector.id where plan_id=p.id and sector_id=any(h_ids);
  delete from public.ceremony_quotas where plan_id=p.id and sector_id=any(h_ids);
  delete from public.ceremony_sectors where plan_id=p.id and id=any(h_ids);
  update public.ceremony_sectors set capacity=740,assignable_limit=740 where id=e_sector.id;
  new_map:=gen_random_uuid();
  insert into public.ceremony_map_versions(id,plan_id,version,title,state,seats,published_at)
   values(new_map,p.id,(select max(version)+1 from public.ceremony_map_versions where plan_id=p.id),old_map.title,'published',new_seats,now());
  update public.ceremony_quotas set quantity=740 where sector_id=e_sector.id;
  update public.ceremony_plans set revision=revision+1 where id=p.id;
  if (select sum(capacity) from public.ceremony_sectors where plan_id=p.id) is distinct from old_total
   or (select sum(quantity) from public.ceremony_quotas where plan_id=p.id) is distinct from old_quota then
   raise exception 'Opening totals changed; conversion aborted';
  end if;
  insert into public.audit_logs(event_id,action,entity_table,entity_id,metadata)
   values(p.event_id,'ceremony.rear_blocks_sector_e','ceremony_plans',p.id,
     jsonb_build_object('migration','20261022150000','previous_map_id',old_map.id,'map_id',new_map,'preserved_seat_ids',140,'blocks',jsonb_build_array(7,8)));
 end loop;
end $$;
