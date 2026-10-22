begin;

-- Read the canonical lifecycle, including pre-existing assignments. No invented
-- backfill or duplicate journal: revoked rows and released claims remain intact.
create function public.get_ceremony_assignment_history(p_event uuid,p_actor uuid,p_plan uuid,p_page integer,p_search text,p_state text)
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
       and (e.kind='allocation' or c.nominee_id=e.id) and (e.revoked_at is not null or c.released_at is null))),'[]'::jsonb),
     'people',case when e.kind='allocation' then coalesce((select jsonb_agg(n.subject_name order by n.subject_name,n.id) from public.ceremony_nominees n where n.allocation_id=e.id and n.revoked_at is null),'[]'::jsonb) else '[]'::jsonb end
   ) order by e.created_at desc,e.id desc) from selected e),'[]'::jsonb)) into result from totals t;
 return result;
end $$;

create function public.revoke_ceremony_assignment(p_event uuid,p_actor uuid,p_plan uuid,p_revision integer,p_request uuid,p_kind text,p_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare plan public.ceremony_plans%rowtype; a public.ceremony_allocations%rowtype; n public.ceremony_nominees%rowtype;
 fp text; prior public.ceremony_map_requests%rowtype; released uuid[]; stamp timestamptz:=clock_timestamp();
begin
 perform app.ceremony_authorize(p_event,p_actor,true);
 if p_revision is null or p_revision<0 or p_request is null or p_id is null or p_kind is null or p_kind not in ('allocation','nominee') then raise exception 'invalid' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into plan from public.ceremony_plans where id=p_plan and event_id=p_event for update;
 if plan.id is null then raise exception 'forbidden' using errcode='42501';end if;
 fp:=encode(sha256(convert_to(jsonb_build_array('desk_revoke',p_event,p_actor,p_plan,p_revision,p_kind,p_id)::text,'UTF8')),'hex');
 select * into prior from public.ceremony_map_requests where request_id=p_request;
 if prior.request_id is not null then
   if prior.actor_id<>p_actor or prior.event_id<>p_event or prior.fingerprint<>fp then raise exception 'invalid request' using errcode='22023';end if;
   return jsonb_build_object('status','saved');
 end if;
 if plan.revision<>p_revision then return jsonb_build_object('status','conflict');end if;
 if p_kind='nominee' then
   select * into n from public.ceremony_nominees where id=p_id and plan_id=p_plan for update;
   if n.id is null then raise exception 'invalid' using errcode='22023';end if;
   select * into a from public.ceremony_allocations where id=n.allocation_id and plan_id=p_plan for update;
 else
   select * into a from public.ceremony_allocations where id=p_id and plan_id=p_plan and group_id is not null for update;
 end if;
 if a.id is null then raise exception 'invalid' using errcode='22023';end if;
 if a.revoked_at is not null or (p_kind='nominee' and n.revoked_at is not null) then return jsonb_build_object('status','conflict');end if;
 -- Release first so the canonical dependency triggers remain enabled. Keeping
 -- nominee_id on the released claim preserves the person's historical chair.
 with changed as (
   update public.ceremony_seat_claims set released_at=stamp
   where allocation_id=a.id and released_at is null and (p_kind='allocation' or a.group_id is null or nominee_id=n.id)
   returning seat_id
 ) select coalesce(array_agg(seat_id),'{}'::uuid[]) into released from changed;
 if p_kind='nominee' and a.group_id is not null then
   update public.ceremony_nominees set revoked_at=stamp where id=n.id;
   -- The delegation retains exactly the same reserve; a new unnamed claim
   -- replaces each released named claim within this single transaction.
   insert into public.ceremony_seat_claims(plan_id,seat_id,allocation_id)
   select p_plan,seat,a.id from unnest(released) seat;
 else
   update public.ceremony_nominees set revoked_at=stamp where allocation_id=a.id and revoked_at is null;
   update public.ceremony_allocations set revoked_at=stamp where id=a.id;
 end if;
 update public.ceremony_plans set revision=revision+1 where id=p_plan returning revision into plan.revision;
 insert into public.ceremony_map_requests(request_id,actor_id,event_id,fingerprint) values(p_request,p_actor,p_event,fp);
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(p_event,p_actor,'ceremony.desk_revoke','ceremony_allocations',a.id,jsonb_build_object('request_id',p_request,'kind',p_kind,'target_id',p_id,'revision',plan.revision,'released_seats',released,'reserve_retained',p_kind='nominee' and a.group_id is not null));
 return jsonb_build_object('status','saved');
end $$;
revoke all on function public.get_ceremony_assignment_history(uuid,uuid,uuid,integer,text,text),public.revoke_ceremony_assignment(uuid,uuid,uuid,integer,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.get_ceremony_assignment_history(uuid,uuid,uuid,integer,text,text),public.revoke_ceremony_assignment(uuid,uuid,uuid,integer,uuid,text,uuid) to service_role;
commit;
