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
  ('B',600,true,600),('C',600,true,600),
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
        when band=1 then 'B'
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


-- Current production has no B allocations. Abort if one appears before the
-- maintenance lock; never discard historical reservations or occupied chairs.
do $$ declare p public.ceremony_plans; v public.ceremony_map_versions; ids uuid[]; sid uuid; seats jsonb; b record; begin
 for p in select cp.* from public.ceremony_plans cp join public.events e on e.id=cp.event_id where e.is_current and cp.kind='opening' and cp.layout_key='assisi-opening-2026' loop
  perform pg_advisory_xact_lock(hashtextextended(p.event_id::text,1381));
  select * into p from public.ceremony_plans where id=p.id for update;
  select array_agg(id) into ids from public.ceremony_sectors where plan_id=p.id and layout_code in ('B1','B2');
  if ids is null then continue;end if;
  select * into v from public.ceremony_map_versions where plan_id=p.id and state='published' for update;
  if cardinality(ids)<>2 or p.state<>'validated' or v.id is null or jsonb_array_length(v.seats)<>3140
   or exists(select 1 from public.ceremony_map_versions where plan_id=p.id and state='draft')
   or exists(select 1 from public.ceremony_sectors where plan_id=p.id and layout_code='B') then raise exception 'Unexpected B configuration; unification aborted';end if;
  if exists(select 1 from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id where q.sector_id=any(ids))
   or exists(select 1 from public.ceremony_seat_claims c join public.ceremony_seat_identities i on i.id=c.seat_id where i.sector_id=any(ids)) then raise exception 'B allocations or claims exist; unification aborted';end if;
  for b in select * from public.ceremony_sectors where id=any(ids) loop
   if b.capacity<>300 or b.assignable_limit is distinct from 300 or not b.numbered
    or (select count(*) from public.ceremony_quotas where sector_id=b.id)<>1
    or not exists(select 1 from public.ceremony_quotas where sector_id=b.id and quantity=300 and category='Partecipanti')
    or (select count(*) from public.ceremony_seat_identities where sector_id=b.id)<>300
    or (select count(*) from jsonb_array_elements(v.seats) s where (s->>'sectorId')::uuid=b.id)<>300
    or exists(select 1 from jsonb_array_elements(v.seats) s where (s->>'sectorId')::uuid=b.id and
      (s->>'row' !~ case when b.layout_code='B1' then '^B-b[1-6]-r0[1-5]$' else '^B-b[1-6]-r(0[6-9]|10)$' end
       or s->>'number' !~ '^([1-9]|10)$' or (s->>'blocked')::boolean
       or not exists(select 1 from public.ceremony_seat_identities i where i.id=(s->>'id')::uuid and i.sector_id=b.id and i.plan_id=p.id))) then raise exception 'Unexpected B quota or seats; unification aborted';end if;
  end loop;
  sid:=md5(p.id::text||':sector:B')::uuid;
  select jsonb_agg(case when (s->>'sectorId')::uuid=any(ids) then s||jsonb_build_object('sectorId',sid) else s end order by ord) into seats from jsonb_array_elements(v.seats) with ordinality x(s,ord);
  update public.ceremony_map_versions set state='archived' where id=v.id;
  insert into public.ceremony_sectors(id,plan_id,name,capacity,numbered,layout_code,assignable_limit) values(sid,p.id,'B',600,true,'B',600);
  update public.ceremony_seat_identities set sector_id=sid where plan_id=p.id and sector_id=any(ids);
  delete from public.ceremony_quotas where sector_id=any(ids);
  delete from public.ceremony_sectors where id=any(ids);
  insert into public.ceremony_map_versions(id,plan_id,version,title,state,seats,published_at) values(gen_random_uuid(),p.id,(select max(version)+1 from public.ceremony_map_versions where plan_id=p.id),v.title,'published',seats,now());
  insert into public.ceremony_quotas(id,plan_id,sector_id,category,quantity) values(md5(p.id::text||':quota:B')::uuid,p.id,sid,'Partecipanti',600);
  update public.ceremony_plans set revision=revision+1 where id=p.id;
  if (select sum(capacity) from public.ceremony_sectors where plan_id=p.id)<>3540 or (select sum(quantity) from public.ceremony_quotas where plan_id=p.id)<>3250 then raise exception 'Hall totals changed; unification aborted';end if;
  insert into public.audit_logs(event_id,action,entity_table,entity_id,metadata) values(p.event_id,'ceremony.unified_sector_b','ceremony_plans',p.id,jsonb_build_object('migration','20261022180000','previous_map_id',v.id,'preserved_seat_ids',600));
 end loop;
end $$;

create function public.revoke_ceremony_seat(p_event uuid,p_actor uuid,p_plan uuid,p_revision integer,p_request uuid,p_seat uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.ceremony_plans; a public.ceremony_allocations; c public.ceremony_seat_claims; prior public.ceremony_map_requests; fp text; stamp timestamptz:=clock_timestamp(); begin
 perform app.ceremony_authorize(p_event,p_actor,true);
 if p_revision is null or p_revision<0 or p_request is null or p_seat is null then raise exception 'invalid' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into p from public.ceremony_plans where id=p_plan and event_id=p_event for update;
 if p.id is null then raise exception 'forbidden' using errcode='42501';end if;
 fp:=encode(sha256(convert_to(jsonb_build_array('seat_revoke',p_event,p_actor,p_plan,p_revision,p_seat)::text,'UTF8')),'hex');
 select * into prior from public.ceremony_map_requests where request_id=p_request;
 if prior.request_id is not null then
  if prior.actor_id<>p_actor or prior.event_id<>p_event or prior.fingerprint<>fp then raise exception 'invalid request' using errcode='22023';end if;
  return jsonb_build_object('status','saved');
 end if;
 if p.revision<>p_revision then return jsonb_build_object('status','conflict');end if;
 select * into c from public.ceremony_seat_claims where plan_id=p_plan and seat_id=p_seat and released_at is null for update;
 if c.id is null then return jsonb_build_object('status','conflict');end if;
 select * into a from public.ceremony_allocations where id=c.allocation_id and plan_id=p_plan and revoked_at is null for update;
 if a.id is null then return jsonb_build_object('status','conflict');end if;
 -- A legacy delegation may still have children without a chair. Removing its
 -- last seat must not silently revoke those unrelated tickets.
 if a.group_id is not null and (select count(*) from public.ceremony_nominees where allocation_id=a.id and revoked_at is null and id is distinct from c.nominee_id and (a.quantity=1 or needs_seat))>a.quantity-1 then return jsonb_build_object('status','nominees_active');end if;
 update public.ceremony_seat_claims set released_at=stamp where id=c.id;
 update public.ceremony_nominees set revoked_at=stamp where id=c.nominee_id and revoked_at is null;
 if a.group_id is null or a.quantity=1 then
  update public.ceremony_allocations set revoked_at=stamp where id=a.id;
 else
  update public.ceremony_allocations set quantity=quantity-1 where id=a.id;
 end if;
 update public.ceremony_plans set revision=revision+1 where id=p_plan returning revision into p.revision;
 insert into public.ceremony_map_requests(request_id,actor_id,event_id,fingerprint) values(p_request,p_actor,p_event,fp);
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(p_event,p_actor,'ceremony.seat_revoke','ceremony_seat_claims',c.id,jsonb_build_object('request_id',p_request,'allocation_id',a.id,'nominee_id',c.nominee_id,'seat_id',p_seat,'revision',p.revision));
 return jsonb_build_object('status','saved');
end $$;
revoke all on function public.revoke_ceremony_seat(uuid,uuid,uuid,integer,uuid,uuid) from public,anon,authenticated;
grant execute on function public.revoke_ceremony_seat(uuid,uuid,uuid,integer,uuid,uuid) to service_role;

create or replace function public.get_ceremony_assignment_history(p_event uuid,p_actor uuid,p_plan uuid,p_page integer,p_search text,p_state text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare plan public.ceremony_plans%rowtype; result jsonb;
begin
 perform app.ceremony_authorize(p_event,p_actor,true);
 if p_page is null or p_page<1 or p_page>1000000 or p_search is null or length(p_search)>200 or p_state is null or p_state not in ('all','active','revoked') then raise exception 'invalid' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into plan from public.ceremony_plans where id=p_plan and event_id=p_event;
 if plan.id is null then raise exception 'forbidden' using errcode='42501';end if;
 with entries as (
   select 'allocation'::text as kind,a.id,a.id as allocation_id,coalesce(g.name,'Delegazione non disponibile') as name,
    null::text as group_name,a.created_at,a.revoked_at,a.quantity,s.name as sector,s.numbered
   from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id
   left join public.groups g on g.id=a.group_id where a.plan_id=p_plan and a.group_id is not null
   union all
   select 'nominee',n.id,a.id,n.subject_name,case when a.group_id is not null then coalesce(g.name,'Delegazione non disponibile') end,n.created_at,n.revoked_at,case when n.needs_seat then 1 else 0 end,s.name,s.numbered
   from public.ceremony_nominees n join public.ceremony_allocations a on a.id=n.allocation_id
   join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id
   left join public.groups g on g.id=a.group_id where n.plan_id=p_plan
   union all
   select 'seat',c.id,a.id,coalesce(g.name,'Delegazione non disponibile'),null,c.created_at,c.released_at,1,s.name,s.numbered
   from public.ceremony_seat_claims c join public.ceremony_allocations a on a.id=c.allocation_id
   join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id
   left join public.groups g on g.id=a.group_id
   where c.plan_id=p_plan and c.released_at is not null and a.group_id is not null
   and exists(select 1 from public.audit_logs log where log.event_id=p_event and log.action='ceremony.seat_revoke' and log.entity_table='ceremony_seat_claims' and log.entity_id=c.id)
 ), filtered as materialized (
   select * from entries where (p_state='all' or (p_state='active' and revoked_at is null) or (p_state='revoked' and revoked_at is not null))
   and (strpos(lower(name||' '||coalesce(group_name,'')||' '||sector),lower(btrim(p_search)))>0)
 ), totals as (select count(*)::integer as total,greatest(1,ceil(count(*)/100.0)::integer) as pages from filtered),
 selected as (select * from filtered order by created_at desc,id desc limit 100 offset (select (least(p_page,pages)-1)*100 from totals)),
 map_seats as materialized (
   select distinct on (seat->>'id') seat from public.ceremony_map_versions v cross join lateral jsonb_array_elements(v.seats) seat
   where v.plan_id=p_plan and v.state in ('published','archived') order by seat->>'id',v.version desc
 )
 select jsonb_build_object('revision',plan.revision,'total',t.total,'page',least(p_page,t.pages),'pageCount',t.pages,'entries',coalesce((
   select jsonb_agg(jsonb_build_object('kind',e.kind,'id',e.id,'allocationId',e.allocation_id,'name',e.name,'groupName',e.group_name,
     'createdAt',e.created_at,'revokedAt',e.revoked_at,'quantity',e.quantity,'sector',e.sector,'numbered',e.numbered,
     'seats',coalesce((select jsonb_agg(m.seat order by m.seat->>'row',m.seat->>'number') from map_seats m where exists(
       select 1 from public.ceremony_seat_claims c where c.plan_id=p_plan and c.allocation_id=e.allocation_id and c.seat_id=(m.seat->>'id')::uuid
       and (e.kind='allocation' or (e.kind='nominee' and c.nominee_id=e.id) or (e.kind='seat' and c.id=e.id)) and (e.revoked_at is not null or c.released_at is null))),'[]'::jsonb),
     'people',case when e.kind='allocation' then coalesce((select jsonb_agg(n.subject_name order by n.subject_name,n.id) from public.ceremony_nominees n where n.allocation_id=e.id and n.revoked_at is null),'[]'::jsonb) else '[]'::jsonb end
   ) order by e.created_at desc,e.id desc) from selected e),'[]'::jsonb)) into result from totals t;
 return result;
end $$;
