-- Virtual Senza gruppo nominal batches. No membership or operational data changes.
begin;
create or replace function public.assign_ceremony_seats(p_event uuid,p_actor uuid,p_plan uuid,p_revision integer,p_request uuid,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.ceremony_plans; q public.ceremony_quotas; a public.ceremony_allocations; n public.ceremony_nominees;
 v public.ceremony_map_versions; c public.ceremony_seat_claims; s public.ceremony_sectors;
 prev public.ceremony_map_requests; fp text; result jsonb; item jsonb; sid uuid; aid uuid; nid uuid; rid uuid; child uuid; gid uuid;
 ids uuid[]; qty integer; i integer; rev integer; failure text;
begin
 if p_request is null or p_revision is null or jsonb_typeof(p_data) is distinct from 'object' or coalesce(p_data->>'action','') not in ('assign','assign_direct','group','group_nominal') then raise exception 'invalid' using errcode='22023';end if;
 perform app.ceremony_authorize(p_event,p_actor,true);
 lock table public.groups,public.group_memberships,public.participant_group_assignments,public.registration_children in share mode;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into p from public.ceremony_plans where id=p_plan and event_id=p_event for update;
 if p.id is null then raise exception 'forbidden' using errcode='42501';end if;
 fp:=encode(sha256(convert_to(jsonb_build_array('desk',p_event,p_actor,p_plan,p_revision,p_data)::text,'UTF8')),'hex');
 select * into prev from public.ceremony_map_requests where request_id=p_request;
 if found then
  if prev.actor_id<>p_actor or prev.fingerprint<>fp then raise exception 'invalid replay' using errcode='22023';end if;
  return jsonb_build_object('status','saved');
 end if;
 if p.revision<>p_revision then return jsonb_build_object('status','conflict');end if;
 if p.state<>'validated' then return jsonb_build_object('status','unconfigured');end if;
 select * into s from public.ceremony_sectors where id=(p_data->>'sectorId')::uuid and plan_id=p.id;
 if s.id is null then raise exception 'invalid sector' using errcode='22023';end if;
 -- A sector with several editorial categories requires explicit maintenance first.
 if (select count(*) from public.ceremony_quotas where sector_id=s.id)<>1 then return jsonb_build_object('status','unconfigured');end if;
 select * into q from public.ceremony_quotas where sector_id=s.id;
 if jsonb_typeof(p_data->'seatIds') is distinct from 'array' then raise exception 'invalid seats' using errcode='22023';end if;
 select coalesce(array_agg(value::uuid),'{}') into ids from jsonb_array_elements_text(p_data->'seatIds');
 qty:=(p_data->>'quantity')::integer;
 if qty is null or qty not between 1 and 10000 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'invalid quantity' using errcode='22023';end if;
 if p_data->>'action'='assign_direct' and (s.numbered or p_data->>'groupId' is not null) then raise exception 'invalid direct assignment' using errcode='22023';end if;
 if p_data->>'action'='group_nominal' and (s.numbered or not (p_data ? 'groupId')) then raise invalid_parameter_value;end if;
 if s.numbered then
  select * into v from public.ceremony_map_versions where plan_id=p.id and state='published';
  if v.id is null then return jsonb_build_object('status','unconfigured');end if;
  if cardinality(ids)<>qty or (select count(*) from jsonb_array_elements(v.seats) x where (x->>'id')::uuid=any(ids) and (x->>'sectorId')::uuid=s.id and not (x->>'blocked')::boolean)<>qty then raise exception 'invalid seats' using errcode='22023';end if;
 elsif cardinality(ids)<>0 then raise exception 'sector only' using errcode='22023';end if;
 begin
 if p_data->>'action'='group' then
  gid:=(p_data->>'groupId')::uuid;
  if not exists(select 1 from public.groups where id=gid and event_id=p_event and is_active) then raise exception 'ineligible' using errcode='P1390';end if;
  if exists(select 1 from public.ceremony_seat_claims where seat_id=any(ids) and released_at is null) then raise exception 'occupied' using errcode='P1390';end if;
  select * into a from public.ceremony_allocations where quota_id=q.id and group_id=gid and revoked_at is null;
  if qty+coalesce((select sum(quantity) from public.ceremony_allocations where quota_id=q.id and revoked_at is null),0)>app.ceremony_quota_budget(q.id) then raise exception 'capacity' using errcode='P1390';end if;
  if a.id is null then
   aid:=gen_random_uuid();
   result:=public.save_ceremony(p_event,p_actor,p.kind,p.revision,'allocate',jsonb_build_object('id',aid,'quotaId',q.id,'groupId',gid,'quantity',qty));
   if result->>'status'<>'saved' then raise exception using errcode='P1390',message=result->>'status';end if;
  else aid:=a.id;update public.ceremony_allocations set quantity=quantity+qty where id=aid;
   update public.ceremony_plans set revision=revision+1 where id=p.id;
  end if;
  if s.numbered then
   select revision into rev from public.ceremony_plans where id=p.id;
   result:=public.set_ceremony_map(p_event,p_actor,p.id,rev,gen_random_uuid(),'reserve',jsonb_build_object('allocationId',aid,'seatIds',ids));
   if result->>'status'<>'saved' then raise exception using errcode='P1390',message=result->>'status';end if;
  end if;
 else
  gid:=(p_data->>'groupId')::uuid;
  if gid is not null and not exists(select 1 from public.groups where id=gid and event_id=p_event and is_active) then raise exception 'ineligible' using errcode='P1390';end if;
  if jsonb_typeof(p_data->'subjects') is distinct from 'array' or jsonb_array_length(p_data->'subjects')<>qty then raise exception 'invalid' using errcode='22023';end if;
  if (select count(distinct coalesce(x->>'childId',x->>'registrationId')) from jsonb_array_elements(p_data->'subjects') x)<>qty then raise exception 'invalid' using errcode='22023';end if;
  -- Lock registrations in a deterministic order before inserting any family member.
  perform 1 from public.registrations where id in (select (x->>'registrationId')::uuid from jsonb_array_elements(p_data->'subjects') x) order by id for update;
  -- The direct path is one person, or the complete family shown before confirmation.
  -- Recheck children under the existing lock; a changed family requires a fresh review.
  if p_data->>'action'='assign_direct' then
   if (select count(distinct x->>'registrationId') from jsonb_array_elements(p_data->'subjects') x)<>1 then raise exception 'invalid family' using errcode='22023';end if;
   rid:=(p_data->'subjects'->0->>'registrationId')::uuid;
   if exists(select 1 from jsonb_array_elements(p_data->'subjects') x where x->>'childId' is null) then
    if qty<>1+(select count(*) from public.registration_children where registration_id=rid)
     or exists(select 1 from public.registration_children ch where ch.registration_id=rid and not exists(select 1 from jsonb_array_elements(p_data->'subjects') x where (x->>'childId')::uuid=ch.id)) then
     raise exception 'family_changed' using errcode='P1390';
    end if;
   elsif qty<>1 then raise exception 'invalid family' using errcode='22023';end if;
  end if;
  i:=0;
  for item in select value from jsonb_array_elements(p_data->'subjects') loop
   i:=i+1;rid:=(item->>'registrationId')::uuid;child:=(item->>'childId')::uuid;sid:=ids[i];aid:=null;nid:=null;
   if not exists(select 1 from public.registrations where id=rid and event_id=p_event and deleted_at is null and status in ('submitted','confirmed')) or (child is not null and not exists(select 1 from public.registration_children where id=child and registration_id=rid)) then raise exception 'ineligible' using errcode='P1390';end if;
   if gid is not null and not exists(select 1 from public.participant_group_assignments ga where ga.registration_id=rid and ga.group_id=gid and ga.is_current and ga.status='confirmed') then raise exception 'ineligible' using errcode='P1390';end if;
   -- Null is the virtual Senza gruppo selection, rechecked at save and publication.
   if p_data->>'action'='group_nominal' and gid is null and exists(select 1 from public.participant_group_assignments ga where ga.registration_id=rid and ga.is_current and ga.status='confirmed') then raise exception 'ineligible' using errcode='P1390';end if;
   select * into n from public.ceremony_nominees where plan_id=p.id and subject_id=coalesce(child,rid) and revoked_at is null;
   select * into c from public.ceremony_seat_claims where seat_id=sid and released_at is null;
   if c.nominee_id is not null then raise exception 'occupied' using errcode='P1390';end if;
   if n.id is not null then
    if not n.needs_seat or app.ceremony_nominee_needs_review(n.id) or exists(select 1 from public.ceremony_seat_claims where nominee_id=n.id and released_at is null) then raise exception 'duplicate' using errcode='P1390';end if;
    select * into a from public.ceremony_allocations where id=n.allocation_id and revoked_at is null and quota_id=q.id;
    if a.id is null or (c.allocation_id is not null and c.allocation_id<>a.id) or not s.numbered then raise exception 'duplicate' using errcode='P1390';end if;
    aid:=a.id;nid:=n.id;
   elsif c.allocation_id is not null then
    select * into a from public.ceremony_allocations where id=c.allocation_id and quota_id=q.id and revoked_at is null and group_id is not null;
    if a.id is null then raise exception 'occupied' using errcode='P1390';end if;
    aid:=a.id;
    select revision into rev from public.ceremony_plans where id=p.id;
    result:=public.set_ceremony_nominee(p_event,p_actor,'assign',aid,rid,child,null,rev,gen_random_uuid());
    if result->>'status'<>'saved' then raise exception using errcode='P1390',message=result->>'status';end if;
   else
    -- Consume an existing unnumbered delegation reserve for this member first.
    aid:=null;
    if not s.numbered and p_data->>'action' not in ('assign_direct','group_nominal') then
     select ca.id into aid from public.ceremony_allocations ca where ca.quota_id=q.id and ca.revoked_at is null and ca.group_id is not null and (gid is null or ca.group_id=gid) and exists(select 1 from public.participant_group_assignments ga where ga.registration_id=rid and ga.group_id=ca.group_id and ga.is_current and ga.status='confirmed') and ca.quantity>(select count(*) from public.ceremony_nominees cn where cn.allocation_id=ca.id and cn.revoked_at is null and cn.needs_seat) order by ca.created_at,ca.id limit 1;
    end if;
    select revision into rev from public.ceremony_plans where id=p.id;
    if aid is not null then result:=public.set_ceremony_nominee(p_event,p_actor,'assign',aid,rid,child,null,rev,gen_random_uuid());
    else aid:=gen_random_uuid();result:=public.save_ceremony(p_event,p_actor,p.kind,rev,'allocate',jsonb_build_object('id',aid,'quotaId',q.id,'registrationId',rid,'childId',child,'quantity',1));end if;
    if result->>'status'<>'saved' then raise exception using errcode='P1390',message=result->>'status';end if;
   end if;
   if s.numbered then
    select id into nid from public.ceremony_nominees where allocation_id=aid and subject_id=coalesce(child,rid) and revoked_at is null;
    if c.allocation_id is null then
     select revision into rev from public.ceremony_plans where id=p.id;
     result:=public.set_ceremony_map(p_event,p_actor,p.id,rev,gen_random_uuid(),'reserve',jsonb_build_object('allocationId',aid,'seatIds',jsonb_build_array(sid)));
     if result->>'status'<>'saved' then raise exception using errcode='P1390',message=result->>'status';end if;
    end if;
    select revision into rev from public.ceremony_plans where id=p.id;
    result:=public.set_ceremony_map(p_event,p_actor,p.id,rev,gen_random_uuid(),'name',jsonb_build_object('allocationId',aid,'seatIds',jsonb_build_array(sid),'nomineeId',nid));
    if result->>'status'<>'saved' then raise exception using errcode='P1390',message=result->>'status';end if;
   end if;
  end loop;
 end if;
 insert into public.ceremony_map_requests values(p_request,p_actor,p_event,fp);
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata) values(p_event,p_actor,'ceremony.desk_'||(p_data->>'action'),'ceremony_plans',p.id,jsonb_build_object('request_id',p_request,'quantity',qty,'sector_id',s.id));
 exception when sqlstate 'P1390' then get stacked diagnostics failure=message_text;return jsonb_build_object('status',failure);
 end;
 return jsonb_build_object('status','saved');
end $$;
commit;
