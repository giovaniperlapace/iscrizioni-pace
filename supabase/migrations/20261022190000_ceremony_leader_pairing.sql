-- Leader-only pairing: existing group tickets, no capacity or reservation changes.
create function public.get_ceremony_leader_tickets(p_event uuid,p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v jsonb; ids uuid[];
begin
 -- Canonical authorization and event lock cover this entire snapshot.
 v:=public.get_ceremony_distribution(p_event,p_actor,'leader');
 select coalesce(array_agg((a->>'id')::uuid),'{}') into ids from jsonb_array_elements(v->'allocations') a;
 return v || jsonb_build_object(
  'allocations',coalesce((select jsonb_agg(a || jsonb_build_object('numbered',s.numbered)) from jsonb_array_elements(v->'allocations') a join public.ceremony_allocations ca on ca.id=(a->>'id')::uuid join public.ceremony_quotas q on q.id=ca.quota_id join public.ceremony_sectors s on s.id=q.sector_id),'[]'),
  'tickets',coalesce((select jsonb_agg(jsonb_build_object('allocationId',c.allocation_id,'nomineeId',c.nominee_id,'seat',jsonb_build_object('id',c.seat_id,'row',s->>'row','number',s->>'number')) order by c.allocation_id,s->>'row',lpad(s->>'number',30,'0'),c.seat_id)
   from public.ceremony_seat_claims c join public.ceremony_map_versions m on m.plan_id=c.plan_id and m.state='published' cross join lateral jsonb_array_elements(m.seats) s
   where c.allocation_id=any(ids) and c.released_at is null and s->>'id'=c.seat_id::text),'[]'));
end $$;

create function public.pair_ceremony_group_ticket(p_event uuid,p_actor uuid,p_allocation uuid,p_revision integer,p_request uuid,p_action text,p_seat uuid,p_registration uuid,p_child uuid,p_nominee uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.ceremony_allocations; p public.ceremony_plans; n public.ceremony_nominees; claim public.ceremony_seat_claims; scope uuid[]; numbered boolean; fp text; prior public.ceremony_map_requests; result jsonb; rev integer;
begin
 if p_request is null or p_revision is null or p_revision<0 or p_action is null or p_action not in ('assign','revoke','no_seat') or p_allocation is null or
  (p_action='revoke' and (p_nominee is null or p_registration is not null or p_child is not null or p_seat is not null)) or
  (p_action in ('assign','no_seat') and (p_registration is null or p_nominee is not null)) or
  (p_action='no_seat' and (p_child is null or p_seat is not null)) then raise exception 'invalid' using errcode='22023';end if;
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 -- Same lock order as the canonical nomination path; no Manager bypass here.
 perform 1 from public.event_user_roles where user_id=p_actor for share;
 lock table public.groups,public.group_memberships,public.participant_group_assignments,public.registration_children in share mode;
 select coalesce(array_agg(id),'{}') into scope from app.ceremony_leader_scope(p_event,p_actor) id;
 if cardinality(scope)=0 then raise exception 'forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into a from public.ceremony_allocations where id=p_allocation;
 if a.id is null or not coalesce(a.group_id=any(scope),false) then raise exception 'forbidden' using errcode='42501';end if;
 select * into p from public.ceremony_plans where id=a.plan_id and event_id=p_event for update;
 if p.id is null then raise exception 'forbidden' using errcode='42501';end if;
 fp:=encode(sha256(convert_to(jsonb_build_array('leader_pair',p_event,p_actor,p_allocation,p_revision,p_action,p_seat,p_registration,p_child,p_nominee)::text,'UTF8')),'hex');
 select * into prior from public.ceremony_map_requests where request_id=p_request;
 if found then
  if prior.actor_id<>p_actor or prior.fingerprint<>fp then raise exception 'invalid replay' using errcode='22023';end if;
  return jsonb_build_object('status','saved');
 end if;
 if p.revision<>p_revision or a.revoked_at is not null then return jsonb_build_object('status','conflict');end if;
 select s.numbered into numbered from public.ceremony_quotas q join public.ceremony_sectors s on s.id=q.sector_id where q.id=a.quota_id;
 rev:=p.revision;
 if p_action='revoke' then
  select * into n from public.ceremony_nominees where id=p_nominee and allocation_id=a.id and revoked_at is null;
  if n.id is null then return jsonb_build_object('status','conflict');end if;
  select * into claim from public.ceremony_seat_claims where nominee_id=n.id and released_at is null;
  if claim.id is not null then
   -- Retain the historical person/chair link and replace only the live claim.
   update public.ceremony_seat_claims set released_at=clock_timestamp() where id=claim.id;
   insert into public.ceremony_seat_claims(plan_id,seat_id,allocation_id) values(p.id,claim.seat_id,a.id);
  end if;
  result:=public.set_ceremony_nominee(p_event,p_actor,'revoke',null,null,null,n.id,rev,gen_random_uuid());
  if result->>'status'<>'saved' then raise exception using errcode='P13LP',message=result->>'status';end if;
 else
  if p.state<>'validated' then return jsonb_build_object('status','unconfigured');end if;
  if p_action='assign' then
   if numbered is distinct from (p_seat is not null) then raise exception 'seat required only for numbered tickets' using errcode='22023';end if;
   if numbered then
    select * into claim from public.ceremony_seat_claims where allocation_id=a.id and seat_id=p_seat and released_at is null;
    if claim.id is null then raise exception 'ticket not reserved to this group' using errcode='42501';end if;
    if claim.nominee_id is not null then return jsonb_build_object('status','occupied');end if;
   end if;
  end if;
  select * into n from public.ceremony_nominees where plan_id=p.id and subject_id=coalesce(p_child,p_registration) and revoked_at is null;
  if n.id is not null then
   -- Existing nominations without a chair can be completed without duplication.
   if p_action<>'assign' or not numbered or n.allocation_id<>a.id or not n.needs_seat or n.registration_id<>p_registration or n.child_id is distinct from p_child then return jsonb_build_object('status','duplicate');end if;
  else
   result:=public.set_ceremony_nominee(p_event,p_actor,p_action,a.id,p_registration,p_child,null,rev,gen_random_uuid());
   if result->>'status'<>'saved' then raise exception using errcode='P13LP',message=result->>'status';end if;
   select * into n from public.ceremony_nominees where allocation_id=a.id and subject_id=coalesce(p_child,p_registration) and revoked_at is null;
   select revision into rev from public.ceremony_plans where id=p.id;
  end if;
  if p_action='assign' and numbered then
   result:=public.set_ceremony_map(p_event,p_actor,p.id,rev,gen_random_uuid(),'name',jsonb_build_object('allocationId',a.id,'seatIds',jsonb_build_array(p_seat),'nomineeId',n.id));
   if result->>'status'<>'saved' then raise exception using errcode='P13LP',message=result->>'status';end if;
  end if;
 end if;
 insert into public.ceremony_map_requests(request_id,actor_id,event_id,fingerprint) values(p_request,p_actor,p_event,fp);
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata) values(p_event,p_actor,'ceremony.leader_pair_'||p_action,'ceremony_allocations',a.id,jsonb_build_object('request_id',p_request,'nominee_id',n.id,'seat_id',p_seat));
 return jsonb_build_object('status','saved');
exception when sqlstate 'P13LP' then
 -- Roll back nomination, chair binding, revision, audit and inner retries together.
 return jsonb_build_object('status',sqlerrm);
end $$;
revoke all on function public.get_ceremony_leader_tickets(uuid,uuid),public.pair_ceremony_group_ticket(uuid,uuid,uuid,integer,uuid,text,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_ceremony_leader_tickets(uuid,uuid),public.pair_ceremony_group_ticket(uuid,uuid,uuid,integer,uuid,text,uuid,uuid,uuid,uuid) to service_role;
