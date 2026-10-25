-- Explicit assignment allowance; physical capacity, quotas and map geometry remain intact.
begin;
alter table public.ceremony_sectors add column overbooking integer not null default 0 check(overbooking between 0 and 10000);

-- Preserve the sector of each actual admission, including after assignment revocation.
-- Existing entries can only be attributed when a current nominal assignment identifies the sector.
alter table public.check_ins add column ceremony_sector_id uuid references public.ceremony_sectors(id);
update public.check_ins entry set ceremony_sector_id=q.sector_id
 from public.ceremony_plans p, public.ceremony_nominees n, public.ceremony_allocations a, public.ceremony_quotas q
 where entry.event_id=p.event_id and entry.moment_id=p.moment_id and n.plan_id=p.id
 and n.subject_id=coalesce(entry.child_id,entry.registration_id) and n.registration_id=entry.registration_id
 and n.revoked_at is null and a.id=n.allocation_id and a.revoked_at is null and q.id=a.quota_id;
do $$ begin
 if exists(select 1 from public.check_ins entry join public.ceremony_plans p on p.moment_id=entry.moment_id and p.event_id=entry.event_id
  where entry.cancelled_at is null and entry.ceremony_sector_id is null) then
  raise exception 'Existing ceremony admissions without a current sector require reconciliation';
 end if;
end $$;
create index check_ins_ceremony_sector_active on public.check_ins(ceremony_sector_id) where cancelled_at is null and ceremony_sector_id is not null;

-- Extra allowance belongs to the single unnumbered sector quota only.
create function app.ceremony_quota_budget(p_quota uuid) returns integer
language sql stable security invoker set search_path='' as $$
 select q.quantity + case when not s.numbered and (select count(*) from public.ceremony_quotas other where other.sector_id=s.id)=1 then s.overbooking else 0 end
 from public.ceremony_quotas q join public.ceremony_sectors s on s.id=q.sector_id where q.id=p_quota
$$;
revoke all on function app.ceremony_quota_budget(uuid) from public,anon,authenticated;
grant execute on function app.ceremony_quota_budget(uuid) to service_role;

create function public.set_ceremony_overbooking(p_event uuid,p_actor uuid,p_plan uuid,p_sector uuid,p_revision integer,p_request uuid,p_extra integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.ceremony_plans; s public.ceremony_sectors; prev public.ceremony_map_requests; fp text; used bigint; budget integer;
begin
 perform app.ceremony_authorize(p_event,p_actor,true);
 if p_revision is null or p_revision<0 or p_request is null or p_extra is null or p_extra not between 0 and 10000 then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into p from public.ceremony_plans where id=p_plan and event_id=p_event for update;
 if p.id is null then raise insufficient_privilege;end if;
 fp:=encode(sha256(convert_to(jsonb_build_array('overbooking',p_event,p_actor,p_plan,p_sector,p_revision,p_extra)::text,'UTF8')),'hex');
 select * into prev from public.ceremony_map_requests where request_id=p_request;
 if found then
  if prev.actor_id<>p_actor or prev.fingerprint<>fp then raise invalid_parameter_value;end if;
  return jsonb_build_object('status','saved');
 end if;
 if p.revision<>p_revision then return jsonb_build_object('status','conflict');end if;
 select * into s from public.ceremony_sectors where id=p_sector and plan_id=p.id for update;
 if s.id is null then raise invalid_parameter_value;end if;
 if p.state<>'validated' or s.numbered or s.capacity is null or (select count(*) from public.ceremony_quotas where sector_id=s.id)<>1 then return jsonb_build_object('status','unconfigured');end if;
 select quantity into budget from public.ceremony_quotas where sector_id=s.id;
 select coalesce((select sum(a.quantity) from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id where q.sector_id=s.id and a.revoked_at is null),0)
  +coalesce((select sum((data->>'quantity')::integer) from public.ceremony_assignment_drafts where sector_id=s.id and state='draft'),0) into used;
 if used>budget+p_extra then return jsonb_build_object('status','overbooking_in_use');end if;
 if s.overbooking<>p_extra then
  update public.ceremony_sectors set overbooking=p_extra where id=s.id;
  update public.ceremony_plans set revision=revision+1 where id=p.id;
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
   values(p_event,p_actor,'ceremony.overbooking_updated','ceremony_sectors',s.id,jsonb_build_object('request_id',p_request,'previous',s.overbooking,'overbooking',p_extra));
 end if;
 insert into public.ceremony_map_requests values(p_request,p_actor,p_event,fp);
 return jsonb_build_object('status','saved');
end $$;
revoke all on function public.set_ceremony_overbooking(uuid,uuid,uuid,uuid,integer,uuid,integer) from public,anon,authenticated;
grant execute on function public.set_ceremony_overbooking(uuid,uuid,uuid,uuid,integer,uuid,integer) to service_role;


create or replace function public.save_ceremony(p_event uuid,p_actor uuid,p_kind text,p_revision integer,p_operation text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 admin boolean; plan public.ceremony_plans%rowtype; moment public.event_moments%rowtype;
 sector public.ceremony_sectors%rowtype; quota public.ceremony_quotas%rowtype;
 allocation public.ceremony_allocations%rowtype; rid uuid; gid uuid; ident uuid; child uuid;
 cap integer; qty integer; start_time timestamptz; end_time timestamptz; loc uuid; mid uuid;
 prior_setting text; name text; new_state text; part text;
begin
 admin:=app.ceremony_authorize(p_event,p_actor,true);
 if p_kind is null or p_kind not in ('opening','closing') or p_revision is null or p_data is null or jsonb_typeof(p_data)<>'object' or p_operation is null or p_operation not in ('configure','sector','quota','allocate','revoke') then raise exception 'invalid' using errcode='22023';end if;
 -- Serialize creation and every writer for this event. Expected revision protects
 -- user intent; absolute quantities make retries safe without additive writes.
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into plan from public.ceremony_plans where event_id=p_event and kind=p_kind for update;
 if (plan.id is null and p_revision<>-1) or (plan.id is not null and plan.revision<>p_revision) then return jsonb_build_object('status','conflict');end if;
 if p_operation in ('configure','sector','quota') and not admin then raise exception 'forbidden' using errcode='42501';end if;
 if plan.id is null and p_operation<>'configure' then raise exception 'invalid' using errcode='22023';end if;
 if plan.id is not null then select * into moment from public.event_moments where id=plan.moment_id;end if;
 if p_operation='configure' then
   name:=btrim(p_data->>'location');cap:=nullif(p_data->>'capacity','')::integer;
   start_time:=nullif(p_data->>'startsAt','')::timestamp at time zone 'Europe/Rome';
   end_time:=nullif(p_data->>'endsAt','')::timestamp at time zone 'Europe/Rome';
   part:=p_data->>'attendancePart';new_state:=p_data->>'state';
   if name is null or length(name) not between 1 and 100 or (cap is not null and cap not between 0 and 1000000) or part is null or part not in ('day','morning','afternoon') or new_state is null or new_state not in ('draft','validated') or (start_time is not null and end_time is not null and end_time<=start_time) or (start_time is null)<>(end_time is null) then raise exception 'invalid' using errcode='22023';end if;
   if start_time is not null and not exists(select 1 from public.events e where e.id=p_event and (start_time at time zone 'Europe/Rome')::date between e.starts_on and coalesce(e.ends_on,e.starts_on) and (end_time at time zone 'Europe/Rome')::date=(start_time at time zone 'Europe/Rome')::date) then return jsonb_build_object('status','date');end if;
   if new_state='validated' and (cap is null or start_time is null) then return jsonb_build_object('status','unconfigured');end if;
   if exists(select 1 from public.ceremony_allocations where plan_id=plan.id and revoked_at is null) and (new_state<>'validated' or name is distinct from (select l.name from public.event_locations l where l.id=moment.location_id) or start_time is distinct from moment.starts_at or end_time is distinct from moment.ends_at or part<>plan.attendance_part) then return jsonb_build_object('status','in_use');end if;
   if (cap is not null and coalesce((select sum(capacity) from public.ceremony_sectors where plan_id=plan.id),0)>cap) or (new_state='validated' and exists(select 1 from public.ceremony_sectors where plan_id=plan.id and capacity is null)) then return jsonb_build_object('status','capacity');end if;
   prior_setting:=current_setting('app.ceremony_write',true);perform set_config('app.ceremony_write','on',true);
   if plan.id is null then
     insert into public.event_locations(event_id,name,max_capacity) values(p_event,name,nullif(cap,0)) returning id into loc;
     insert into public.event_moments(event_id,location_id,title,starts_at,ends_at,capacity,is_public,check_in_enabled,moment_type)
      values(p_event,loc,case when p_kind='opening' then 'Inaugurazione' else 'Cerimonia finale' end,start_time,end_time,cap,false,false,'general') returning id into mid;
     insert into public.ceremony_plans(event_id,kind,moment_id,state,attendance_part) values(p_event,p_kind,mid,new_state,part) returning * into plan;
   else
     update public.event_locations set name=btrim(p_data->>'location'),max_capacity=nullif(cap,0) where id=moment.location_id;
     update public.event_moments set starts_at=start_time,ends_at=end_time,capacity=cap where id=plan.moment_id;
     update public.ceremony_plans set state=new_state,attendance_part=part where id=plan.id;
   end if;
   perform set_config('app.ceremony_write',coalesce(prior_setting,''),true);
 elsif p_operation='sector' then
   ident:=(p_data->>'id')::uuid;cap:=nullif(p_data->>'capacity','')::integer;
   if ident is null or (cap is not null and cap not between 0 and 1000000) then raise exception 'invalid' using errcode='22023';end if;
   if exists(select 1 from public.ceremony_sectors where id=ident and plan_id<>plan.id) then raise exception 'forbidden' using errcode='42501';end if;
   if (plan.state='validated' and cap is null) or coalesce(cap,0)<coalesce((select sum(quantity) from public.ceremony_quotas where sector_id=ident),0) or (moment.capacity is not null and coalesce(cap,0)+coalesce((select sum(capacity) from public.ceremony_sectors where plan_id=plan.id and id<>ident),0)>moment.capacity) then return jsonb_build_object('status','capacity');end if;
   insert into public.ceremony_sectors(id,plan_id,name,capacity) values(ident,plan.id,btrim(p_data->>'name'),cap)
    on conflict(id) do update set name=excluded.name,capacity=excluded.capacity;
 elsif p_operation='quota' then
   ident:=(p_data->>'id')::uuid;qty:=(p_data->>'quantity')::integer;
   select * into sector from public.ceremony_sectors where id=(p_data->>'sectorId')::uuid and plan_id=plan.id;
   if sector.id is null or ident is null or qty is null or qty not between 0 and 1000000 then raise exception 'invalid' using errcode='22023';end if;
   if exists(select 1 from public.ceremony_quotas where id=ident and (plan_id<>plan.id or sector_id<>sector.id)) then raise exception 'forbidden' using errcode='42501';end if;
   if sector.capacity is null or qty+coalesce((select sum(quantity) from public.ceremony_quotas where sector_id=sector.id and id<>ident),0)>sector.capacity or qty<coalesce((select sum(quantity) from public.ceremony_allocations where quota_id=ident and revoked_at is null),0) then return jsonb_build_object('status','capacity');end if;
   -- Categories are explicit labels; a rename with allocations could change their meaning.
   if exists(select 1 from public.ceremony_allocations where quota_id=ident and revoked_at is null) and (select category from public.ceremony_quotas where id=ident) is distinct from btrim(p_data->>'category') then return jsonb_build_object('status','in_use');end if;
   insert into public.ceremony_quotas(id,plan_id,sector_id,category,quantity) values(ident,plan.id,sector.id,btrim(p_data->>'category'),qty)
    on conflict(id) do update set category=excluded.category,quantity=excluded.quantity;
 elsif p_operation='allocate' then
   ident:=(p_data->>'id')::uuid;qty:=(p_data->>'quantity')::integer;
   rid:=nullif(p_data->>'registrationId','')::uuid;gid:=nullif(p_data->>'groupId','')::uuid;child:=nullif(p_data->>'childId','')::uuid;
   if child is not null and rid is null then raise exception 'invalid child target' using errcode='22023';end if;
   if ident is null or qty is null or qty not between 1 and 1000000 or num_nonnulls(rid,gid)<>1 or (rid is not null and qty<>1) then raise exception 'invalid' using errcode='22023';end if;
   if plan.state<>'validated' then return jsonb_build_object('status','unconfigured');end if;
   select * into quota from public.ceremony_quotas where id=(p_data->>'quotaId')::uuid and plan_id=plan.id;
   if quota.id is null then raise exception 'invalid' using errcode='22023';end if;
   if rid is not null then
     -- Match the registration lock used by attendance editors/deletion.
     perform 1 from public.registrations where id=rid and event_id=p_event and deleted_at is null and status in ('submitted','confirmed') for update;
     if not found then return jsonb_build_object('status','ineligible');end if;
     if child is not null then
       perform 1 from public.registration_children where id=child and registration_id=rid for share;
       if not found then return jsonb_build_object('status','ineligible');end if;
     end if;
     if exists(select 1 from public.ceremony_nominees where plan_id=plan.id and subject_id=coalesce(child,rid) and revoked_at is null) then return jsonb_build_object('status','duplicate');end if;
   else
     perform 1 from public.groups where id=gid and event_id=p_event and is_active for share;
     if not found then return jsonb_build_object('status','ineligible');end if;
     if exists(select 1 from public.ceremony_allocations where quota_id=quota.id and group_id=gid and revoked_at is null) then return jsonb_build_object('status','duplicate');end if;
   end if;
   if qty+coalesce((select sum(quantity) from public.ceremony_allocations where quota_id=quota.id and revoked_at is null),0)>app.ceremony_quota_budget(quota.id) then return jsonb_build_object('status','capacity');end if;
   insert into public.ceremony_allocations(id,plan_id,quota_id,registration_id,child_id,group_id,quantity,group_snapshot) values(ident,plan.id,quota.id,rid,child,gid,qty,array(select group_id from public.participant_group_assignments where registration_id=rid and is_current order by group_id));
 else
   select * into allocation from public.ceremony_allocations where id=(p_data->>'id')::uuid and plan_id=plan.id;
   if allocation.id is null then raise exception 'invalid' using errcode='22023';end if;
   update public.ceremony_allocations set revoked_at=coalesce(revoked_at,now()) where id=allocation.id;
 end if;
 update public.ceremony_plans set revision=revision+1 where id=plan.id returning revision into plan.revision;
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(p_event,p_actor,'ceremony.'||p_operation,'ceremony_plans',plan.id,jsonb_build_object('revision',plan.revision,'item_id',ident));
 return jsonb_build_object('status','saved','revision',plan.revision);
end $$;

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
 if p_data->>'action'='group_nominal' and (s.numbered or p_data->>'groupId' is null) then raise invalid_parameter_value;end if;
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

create or replace function public.manage_ceremony_drafts(p_event uuid,p_actor uuid,p_plan uuid,p_revision integer,p_request uuid,p_operation text,p_draft uuid,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.ceremony_plans; d public.ceremony_assignment_drafts; s public.ceremony_sectors;
 prev public.ceremony_draft_requests; fp text; result jsonb; validation jsonb; failure text;
 qty integer; total integer; notices integer; missing integer; quota uuid; capacity integer; rev integer;
 title text; starts timestamptz; location text;
begin
 perform app.ceremony_authorize(p_event,p_actor,true);
 if p_revision is null or p_revision<0 or p_request is null or p_operation is null or p_operation not in ('save','remove','publish') then raise invalid_parameter_value;end if;
 -- Same order as the canonical desk writer. Membership/family data cannot change mid-publication.
 lock table public.groups,public.group_memberships,public.participant_group_assignments,public.registration_children in share mode;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into p from public.ceremony_plans where id=p_plan and event_id=p_event for update;
 if p.id is null then raise insufficient_privilege;end if;
 fp:=encode(sha256(convert_to(jsonb_build_array(p_event,p_actor,p_plan,p_revision,p_operation,p_draft,p_data)::text,'UTF8')),'hex');
 select * into prev from public.ceremony_draft_requests where request_id=p_request;
 if found then
  if prev.actor_id<>p_actor or prev.fingerprint<>fp then raise invalid_parameter_value using message='invalid replay';end if;
  return prev.result;
 end if;
 if p.revision<>p_revision then return jsonb_build_object('status','conflict');end if;
 if p.state<>'validated' then return jsonb_build_object('status','unconfigured');end if;
 if p_draft is not null then
  select * into d from public.ceremony_assignment_drafts where id=p_draft and plan_id=p.id and state='draft' for update;
  if not found then return jsonb_build_object('status','conflict');end if;
 end if;
 if p_operation='save' then
  if jsonb_typeof(p_data) is distinct from 'object' or coalesce(p_data->>'action','') not in ('group','assign_direct','group_nominal') or p_data->'seatIds' is distinct from '[]'::jsonb or jsonb_typeof(p_data->'subjects') is distinct from 'array' then raise invalid_parameter_value;end if;
  if p_data->>'action'='group' and p_data->'subjects'<>'[]'::jsonb then raise invalid_parameter_value;end if;
  qty:=(p_data->>'quantity')::integer;
  if qty is null or qty not between 1 and 10000 then raise invalid_parameter_value;end if;
  select * into s from public.ceremony_sectors where id=(p_data->>'sectorId')::uuid and plan_id=p.id and not numbered;
  if not found then return jsonb_build_object('status','invalid');end if;
  if (select count(*) from public.ceremony_quotas where sector_id=s.id)<>1 then return jsonb_build_object('status','unconfigured');end if;
  select id,app.ceremony_quota_budget(id) into quota,capacity from public.ceremony_quotas where sector_id=s.id;
  if qty+coalesce((select sum((data->>'quantity')::integer) from public.ceremony_assignment_drafts where sector_id=s.id and state='draft' and id is distinct from p_draft),0)
    +coalesce((select sum(quantity) from public.ceremony_allocations where quota_id=quota and revoked_at is null),0)>capacity then return jsonb_build_object('status','capacity');end if;
  if p_data->>'action' in ('assign_direct','group_nominal') and exists(
    select 1 from public.ceremony_assignment_drafts other cross join lateral jsonb_array_elements(other.data->'subjects') x
    cross join lateral jsonb_array_elements(p_data->'subjects') y
    where other.plan_id=p.id and other.state='draft' and other.id is distinct from p_draft
    and coalesce(x->>'childId',x->>'registrationId')=coalesce(y->>'childId',y->>'registrationId')
  ) then return jsonb_build_object('status','duplicate');end if;
  -- Run the canonical family/eligibility/duplicate checks in a subtransaction.
  -- Always roll it back: no public allocation, nominee, audit or request survives.
  begin
   validation:=public.assign_ceremony_seats(p_event,p_actor,p.id,p.revision,gen_random_uuid(),p_data);
   raise exception using errcode='P1391',message='draft validation rollback';
  exception when sqlstate 'P1391' then null;
  end;
  if validation->>'status'<>'saved' then return validation;end if;
  if d.id is null then
   insert into public.ceremony_assignment_drafts(plan_id,sector_id,data,created_by,updated_by) values(p.id,s.id,p_data,p_actor,p_actor) returning * into d;
  else
   update public.ceremony_assignment_drafts set sector_id=s.id,data=p_data,updated_by=p_actor,updated_at=clock_timestamp() where id=d.id;
  end if;
  update public.ceremony_plans set revision=revision+1 where id=p.id;
  result:=jsonb_build_object('status','saved');
 elsif p_operation='remove' then
  if d.id is null or p_data is not null then raise invalid_parameter_value;end if;
  update public.ceremony_assignment_drafts set state='removed',updated_by=p_actor,updated_at=clock_timestamp() where id=d.id;
  update public.ceremony_plans set revision=revision+1 where id=p.id;
  result:=jsonb_build_object('status','saved');
 else
  if p_draft is not null or p_data is not null then raise invalid_parameter_value;end if;
  select sum((data->>'quantity')::integer) into total from public.ceremony_assignment_drafts where plan_id=p.id and state='draft';
  if total is null then return jsonb_build_object('status','empty');end if;
  -- The whole publication, including all notices, succeeds or rolls back together.
  begin
   for d in select * from public.ceremony_assignment_drafts where plan_id=p.id and state='draft' order by created_at,id loop
    select revision into rev from public.ceremony_plans where id=p.id;
    validation:=public.assign_ceremony_seats(p_event,p_actor,p.id,rev,gen_random_uuid(),d.data);
    if validation->>'status'<>'saved' then raise exception using errcode='P1392',message=validation->>'status';end if;
    update public.ceremony_assignment_drafts set state='published',publication_id=p_request,updated_by=p_actor,updated_at=clock_timestamp() where id=d.id;
   end loop;
   select m.title,m.starts_at,l.name into title,starts,location from public.event_moments m join public.event_locations l on l.id=m.location_id where m.id=p.moment_id;
   -- One notice per registration (children use the adult contact), with exact new nominees.
   insert into public.ceremony_publication_emails(publication_id,event_id,plan_id,recipient_key,registration_id,payload)
   select p_request,p_event,p.id,'person:'||n.registration_id,n.registration_id,
    jsonb_build_object('kind',p.kind,'title',title,'startsAt',starts,'location',location,'lines',jsonb_agg(jsonb_build_object('nomineeId',n.id,'name',n.subject_name,'sector',sec.name) order by n.subject_name,n.id))
   from public.ceremony_assignment_drafts dr cross join lateral jsonb_array_elements(dr.data->'subjects') x
   join public.ceremony_nominees n on n.plan_id=p.id and n.subject_id=coalesce((x->>'childId')::uuid,(x->>'registrationId')::uuid) and n.revoked_at is null
   join public.ceremony_sectors sec on sec.id=dr.sector_id
   where dr.publication_id=p_request and dr.state='published' and dr.data->>'action' in ('assign_direct','group_nominal') group by n.registration_id;
   -- Notify every current leader who can manage each affected group, including ancestors.
   insert into public.ceremony_publication_emails(publication_id,event_id,plan_id,recipient_key,user_id,payload)
   select p_request,p_event,p.id,'leader:'||leaders.user_id,leaders.user_id,
    jsonb_build_object('kind',p.kind,'title',title,'startsAt',starts,'location',location,'lines',jsonb_agg(jsonb_build_object('groupId',g.id,'name',g.name,'sector',sec.name,'quantity',(dr.data->>'quantity')::integer) order by g.name,sec.name,dr.id))
   from public.ceremony_assignment_drafts dr join public.groups g on g.id=(dr.data->>'groupId')::uuid
   join public.ceremony_sectors sec on sec.id=dr.sector_id
   join (select distinct gm.user_id from public.group_memberships gm join public.groups gr on gr.id=gm.group_id where gr.event_id=p_event and gr.is_active and gm.role='capogruppo') leaders
     on g.id in (select app.ceremony_leader_scope(p_event,leaders.user_id))
   where dr.publication_id=p_request and dr.state='published' and dr.data->>'action'='group' group by leaders.user_id;
   select count(*) into notices from public.ceremony_publication_emails where publication_id=p_request;
   select count(distinct dr.data->>'groupId') into missing from public.ceremony_assignment_drafts dr where dr.publication_id=p_request and dr.data->>'action'='group'
    and not exists(select 1 from public.ceremony_publication_emails e cross join lateral jsonb_array_elements(e.payload->'lines') x where e.publication_id=p_request and x->>'groupId'=dr.data->>'groupId');
   result:=jsonb_build_object('status','saved','seats',total,'notifications',notices,'missingGroups',missing);
  exception when sqlstate 'P1392' then get stacked diagnostics failure=message_text;return jsonb_build_object('status',failure);
  end;
 end if;
 insert into public.ceremony_draft_requests(request_id,actor_id,fingerprint,result) values(p_request,p_actor,fp,result);
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
  values(p_event,p_actor,'ceremony.draft_'||p_operation,'ceremony_plans',p.id,jsonb_build_object('request_id',p_request,'draft_id',d.id,'result',result));
 return result;
end $$;

create or replace function public.get_ceremony_seats_desk(p_event uuid,p_actor uuid,p_kind text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.ceremony_plans; result jsonb;
begin
 perform app.ceremony_authorize(p_event,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into p from public.ceremony_plans where event_id=p_event and kind=p_kind;
 if p.id is null then return null;end if;
 select jsonb_build_object('planId',p.id,'kind',p.kind,'revision',p.revision,'state',p.state,'layoutKey',p.layout_key,
 'day',(m.starts_at at time zone 'Europe/Rome')::date,'part',p.attendance_part,'location',l.name,
 'active',(select jsonb_build_object('id',id,'version',version,'title',title,'seats',seats) from public.ceremony_map_versions where plan_id=p.id and state='published'),
 'sectors',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'capacity',s.capacity,'numbered',s.numbered,'layoutCode',s.layout_code,'assignableLimit',s.assignable_limit,'overbooking',s.overbooking,'baseAssignable',coalesce((select sum(q.quantity) from public.ceremony_quotas q where q.sector_id=s.id),0),'remaining',s.overbooking+coalesce((select sum(q.quantity) from public.ceremony_quotas q where q.sector_id=s.id),0)-coalesce((select sum(a.quantity) from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id where q.sector_id=s.id and a.revoked_at is null),0)) order by s.name,s.id) from public.ceremony_sectors s where s.plan_id=p.id),'[]'),
 'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.name,g.id) from public.groups g where g.event_id=p_event and g.is_active),'[]'),
 'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'sectorId',q.sector_id,'groupId',a.group_id,'groupName',g.name,'quantity',a.quantity)) from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id left join public.groups g on g.id=a.group_id where a.plan_id=p.id and a.revoked_at is null),'[]'),
 'nominees',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'allocationId',n.allocation_id,'registrationId',n.registration_id,'childId',n.child_id,'needsSeat',n.needs_seat,'name',n.subject_name,'review',app.ceremony_nominee_needs_review(n.id))) from public.ceremony_nominees n where n.plan_id=p.id and n.revoked_at is null),'[]'),
 'claims',coalesce((select jsonb_agg(jsonb_build_object('seatId',seat_id,'allocationId',allocation_id,'nomineeId',nominee_id)) from public.ceremony_seat_claims where plan_id=p.id and released_at is null),'[]')) into result
 from public.event_moments m join public.event_locations l on l.id=m.location_id where m.id=p.moment_id;
 return result;
end $$;

create or replace function public.reception_ceremony_check_in(p_event uuid,p_actor uuid,p_kind text,p_lookup_kind text,p_lookup text,
 p_action text default 'inspect',p_request uuid default null,p_subjects uuid[] default '{}',p_revision integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare admitted_sector uuid; rid uuid; plan public.ceremony_plans; r public.registrations; persons jsonb; subject uuid; rev integer; fp text; receipt public.check_in_requests; ci public.check_ins;
begin
 perform app.authorize_reception_target(p_event,p_actor,p_kind);
 if p_kind not in ('opening','closing') or p_action is null or p_action not in ('inspect','enter','cancel') then raise invalid_parameter_value; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into plan from public.ceremony_plans where event_id=p_event and kind=p_kind;
 if plan.id is null or plan.state<>'validated' then return jsonb_build_object('status','panel_unavailable'); end if;
 rid:=app.reception_registration(p_event,p_lookup_kind,p_lookup);
 if rid is null then return jsonb_build_object('status','invalid'); end if;
 select * into r from public.registrations where id=rid;
 select coalesce((select revision from public.panel_check_in_revisions where panel_id=plan.moment_id and subject_id=rid),0) into rev;
 if p_action<>'inspect' then
  if p_request is null or p_subjects is null or cardinality(p_subjects) not between 1 and 11 or array_position(p_subjects,null) is not null then raise invalid_parameter_value; end if;
  fp:=encode(sha256(convert_to(jsonb_build_array('ceremony.entry',p_actor,p_event,p_kind,rid,p_action,p_subjects,p_revision)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_request::text,11));
  select * into receipt from public.check_in_requests where request_id=p_request;
  if found and receipt.fingerprint<>fp then raise invalid_parameter_value; end if;
  if receipt.request_id is null then
   if p_action='cancel' and p_revision is distinct from rev then return jsonb_build_object('status','conflict'); end if;
   foreach subject in array p_subjects loop
    if subject<>rid and not exists(select 1 from public.registration_children where id=subject and registration_id=rid) then raise invalid_parameter_value; end if;
    if p_action='enter' and not exists(select 1 from public.ceremony_nominees n join public.ceremony_allocations a on a.id=n.allocation_id
     where n.plan_id=plan.id and n.subject_id=subject and n.registration_id=rid and n.revoked_at is null and a.revoked_at is null and not app.ceremony_nominee_needs_review(n.id)) then return jsonb_build_object('status','not_booked'); end if;
   end loop;
   foreach subject in array p_subjects loop
    select q.sector_id into admitted_sector from public.ceremony_nominees n
     join public.ceremony_allocations a on a.id=n.allocation_id and a.revoked_at is null
     join public.ceremony_quotas q on q.id=a.quota_id
     where n.plan_id=plan.id and n.subject_id=subject and n.registration_id=rid and n.revoked_at is null;
    select * into ci from public.check_ins where event_id=p_event and moment_id=plan.moment_id and registration_id=rid and child_id is not distinct from (case when subject=rid then null else subject end);
    if p_action='cancel' then update public.check_ins set cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor where id=ci.id and cancelled_at is null;
    elsif ci.id is null then insert into public.check_ins(event_id,moment_id,registration_id,child_id,checked_in_by,updated_by,source,ceremony_sector_id) values(p_event,plan.moment_id,rid,case when subject=rid then null else subject end,p_actor,p_actor,case when p_lookup_kind='qr' then 'qr_scan' else 'manual' end,admitted_sector);
    elsif ci.cancelled_at is not null then update public.check_ins set cancelled_at=null,ceremony_sector_id=admitted_sector,checked_in_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor,checked_in_by=p_actor where id=ci.id; end if;
   end loop;
   rev:=rev+1;
   insert into public.panel_check_in_revisions values(plan.moment_id,rid,rev) on conflict(panel_id,subject_id) do update set revision=excluded.revision;
   insert into public.check_in_requests(request_id,event_id,actor_user_id,fingerprint) values(p_request,p_event,p_actor,fp);
   insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata) values(p_event,p_actor,'reception.ceremony.'||p_action,'registrations',rid,jsonb_build_object('kind',p_kind,'subjects',p_subjects,'revision',rev));
  end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'firstName',x.first_name,'lastName',x.last_name,
 'checkedInAt',(select checked_in_at from public.check_ins where event_id=p_event and moment_id=plan.moment_id and registration_id=rid and coalesce(child_id,registration_id)=x.id and cancelled_at is null),
 'ceremonies',coalesce((select jsonb_agg(s) from jsonb_array_elements(app.ceremony_subject_seats(p_event,x.id)) s where s->>'kind'=p_kind),'[]')) order by x.position),'[]') into persons
 from (select rid id,'adult' kind,p.first_name,p.last_name,0 position from public.participants p where p.id=r.participant_id
 union all select id,'child',first_name,last_name,position from public.registration_children where registration_id=rid) x;
 return jsonb_build_object('status','valid','kind','family','code',(select public_code from public.participants where id=r.participant_id),'persons',persons,'sectorStatistics',coalesce((
 select jsonb_agg(jsonb_build_object('sectorId',sec.id,'sector',sec.name,'capacity',sec.capacity,'overbooking',sec.overbooking,
  'entered',(select count(*) from public.check_ins entry
   where entry.event_id=p_event and entry.moment_id=plan.moment_id and entry.ceremony_sector_id=sec.id and entry.cancelled_at is null)) order by sec.name,sec.id)
 from public.ceremony_sectors sec where sec.plan_id=plan.id and exists(
  select 1 from public.ceremony_nominees n join public.ceremony_allocations a on a.id=n.allocation_id and a.revoked_at is null
  join public.ceremony_quotas q on q.id=a.quota_id where n.plan_id=plan.id and n.registration_id=rid and n.revoked_at is null and q.sector_id=sec.id
   and (n.child_id is null or exists(select 1 from public.registration_children ch where ch.id=n.child_id and ch.registration_id=rid))
  )), '[]'::jsonb),'revision',rev,'registrationStatus',r.status,'outcome',case when p_action='inspect' then 'verified' when receipt.request_id is not null then 'replayed' else 'saved' end);
end $$;

commit;
