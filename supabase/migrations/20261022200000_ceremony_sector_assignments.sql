-- Sector assignments: explicit group context, paginated people and atomic leader batches.
begin;
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
 'sectors',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'capacity',s.capacity,'numbered',s.numbered,'layoutCode',s.layout_code,'assignableLimit',s.assignable_limit,'remaining',coalesce((select sum(q.quantity) from public.ceremony_quotas q where q.sector_id=s.id),0)-coalesce((select sum(a.quantity) from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id where q.sector_id=s.id and a.revoked_at is null),0)) order by s.name,s.id) from public.ceremony_sectors s where s.plan_id=p.id),'[]'),
 'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name) order by g.name,g.id) from public.groups g where g.event_id=p_event and g.is_active),'[]'),
 'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'sectorId',q.sector_id,'groupId',a.group_id,'groupName',g.name,'quantity',a.quantity)) from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id left join public.groups g on g.id=a.group_id where a.plan_id=p.id and a.revoked_at is null),'[]'),
 'nominees',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'allocationId',n.allocation_id,'registrationId',n.registration_id,'childId',n.child_id,'needsSeat',n.needs_seat,'name',n.subject_name,'review',app.ceremony_nominee_needs_review(n.id))) from public.ceremony_nominees n where n.plan_id=p.id and n.revoked_at is null),'[]'),
 'claims',coalesce((select jsonb_agg(jsonb_build_object('seatId',seat_id,'allocationId',allocation_id,'nomineeId',nominee_id)) from public.ceremony_seat_claims where plan_id=p.id and released_at is null),'[]')) into result
 from public.event_moments m join public.event_locations l on l.id=m.location_id where m.id=p.moment_id;
 return result;
end $$;

create or replace function public.assign_ceremony_seats(p_event uuid,p_actor uuid,p_plan uuid,p_revision integer,p_request uuid,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.ceremony_plans; q public.ceremony_quotas; a public.ceremony_allocations; n public.ceremony_nominees;
 v public.ceremony_map_versions; c public.ceremony_seat_claims; s public.ceremony_sectors;
 prev public.ceremony_map_requests; fp text; result jsonb; item jsonb; sid uuid; aid uuid; nid uuid; rid uuid; child uuid; gid uuid;
 ids uuid[]; qty integer; i integer; rev integer; failure text;
begin
 if p_request is null or p_revision is null or jsonb_typeof(p_data) is distinct from 'object' or coalesce(p_data->>'action','') not in ('assign','group') then raise exception 'invalid' using errcode='22023';end if;
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
  if qty+coalesce((select sum(quantity) from public.ceremony_allocations where quota_id=q.id and revoked_at is null),0)>q.quantity then raise exception 'capacity' using errcode='P1390';end if;
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
    if not s.numbered then
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
create or replace function public.get_ceremony_distribution(p_event uuid,p_actor uuid,p_mode text default 'leader') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare scope uuid[]; ids uuid[]; manager boolean:=false; result jsonb;
begin
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 lock table public.groups,public.group_memberships,public.participant_group_assignments,public.registration_children in share mode;
 if p_mode='manager' then perform app.ceremony_authorize(p_event,p_actor,false);manager:=true;
 elsif p_mode='leader' then
   select coalesce(array_agg(id),'{}') into scope from app.ceremony_leader_scope(p_event,p_actor) id;
   if cardinality(scope)=0 then raise exception 'forbidden' using errcode='42501';end if;
 else raise exception 'invalid' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select coalesce(array_agg(a.id),'{}') into ids from public.ceremony_allocations a join public.ceremony_plans p on p.id=a.plan_id
 where p.event_id=p_event and a.revoked_at is null and (manager or a.group_id=any(scope));
 if (select count(*) from public.registrations where event_id=p_event)>50000 then raise exception 'snapshot limit';end if;
 select jsonb_build_object(
  'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'planId',p.id,'kind',p.kind,'revision',p.revision,'state',p.state,'groupId',a.group_id,'groupName',g.name,'location',l.name,'startsAt',m.starts_at,'sector',s.name,'category',q.category,'quantity',a.quantity,'used',(select count(*) from public.ceremony_nominees n where n.allocation_id=a.id and n.revoked_at is null and n.needs_seat)) order by p.kind,g.name,s.name,q.category,a.id)
   from public.ceremony_allocations a join public.ceremony_plans p on p.id=a.plan_id join public.event_moments m on m.id=p.moment_id join public.event_locations l on l.id=m.location_id join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id left join public.groups g on g.id=a.group_id where a.id=any(ids)),'[]'),
  'nominees',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'allocationId',n.allocation_id,'registrationId',n.registration_id,'childId',n.child_id,'needsSeat',n.needs_seat,'name',n.subject_name,'review',app.ceremony_nominee_needs_review(n.id)) order by n.subject_name,n.id) from public.ceremony_nominees n where n.allocation_id=any(ids) and n.revoked_at is null),'[]'),
  'people',coalesce((select jsonb_agg(jsonb_build_object('registrationId',r.id,'name',pe.first_name||' '||pe.last_name,'code',pe.public_code,
    'groupIds',array(select ga.group_id from public.participant_group_assignments ga where ga.registration_id=r.id and ga.is_current and ga.status='confirmed' and (manager or ga.group_id=any(scope))),
    'children',coalesce((select jsonb_agg(jsonb_build_object('id',ch.id,'name',ch.first_name||' '||ch.last_name) order by ch.position,ch.id) from public.registration_children ch where ch.registration_id=r.id),'[]'),
    'attendance',coalesce((select jsonb_agg(jsonb_build_object('planId',cp.id,'choice',case when exists(select 1 from public.event_attendance_choices ac where ac.registration_id=r.id and ac.day=(em.starts_at at time zone 'Europe/Rome')::date and (ac.day_part=cp.attendance_part or ac.day_part='day' or cp.attendance_part='day') and ac.choice='yes') then 'yes' when exists(select 1 from public.event_attendance_choices ac where ac.registration_id=r.id and ac.day=(em.starts_at at time zone 'Europe/Rome')::date and (ac.day_part=cp.attendance_part or ac.day_part='day' or cp.attendance_part='day') and ac.choice='no') then 'no' else 'unknown' end)) from public.ceremony_plans cp join public.event_moments em on em.id=cp.moment_id where cp.event_id=p_event),'[]'),
    'eligiblePlanIds',array(select p.id from public.ceremony_plans p join public.event_moments m on m.id=p.moment_id where p.event_id=p_event),
    'assigned',coalesce((select jsonb_agg(jsonb_build_object('planId',n.plan_id,'childId',n.child_id,'needsSeat',n.needs_seat,'sector',(select s.name from public.ceremony_allocations ca join public.ceremony_quotas q on q.id=ca.quota_id join public.ceremony_sectors s on s.id=q.sector_id where ca.id=n.allocation_id))) from public.ceremony_nominees n join public.ceremony_plans p on p.id=n.plan_id where n.registration_id=r.id and n.revoked_at is null and p.event_id=p_event),'[]')) order by pe.last_name,pe.first_name,r.id)
   from public.registrations r join public.participants pe on pe.id=r.participant_id where r.event_id=p_event and r.deleted_at is null and r.status in ('submitted','confirmed') and (manager or exists(select 1 from public.participant_group_assignments ga where ga.registration_id=r.id and ga.is_current and ga.status='confirmed' and ga.group_id=any(scope)))),'[]')) into result;
 return result;
end $$;

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
   where s.numbered and c.plan_id=p_plan and c.released_at is not null and a.group_id is not null
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
end $$;create or replace function app.guard_ceremony_seat_claim() returns trigger language plpgsql security invoker set search_path='' as $$
declare a public.ceremony_allocations;n public.ceremony_nominees;e uuid;s jsonb;
begin
 select event_id into e from public.ceremony_plans where id=new.plan_id;
 perform pg_advisory_xact_lock(hashtextextended(e::text,1381));
 if tg_op='UPDATE' and (new.plan_id,new.seat_id,new.allocation_id) is distinct from (old.plan_id,old.seat_id,old.allocation_id) then raise exception 'Immutable claim' using errcode='23514';end if;
 if new.released_at is not null then return new;end if;
 select * into a from public.ceremony_allocations where id=new.allocation_id and plan_id=new.plan_id and revoked_at is null;
 select x into s from public.ceremony_map_versions v cross join lateral jsonb_array_elements(v.seats) x where v.plan_id=new.plan_id and v.state='published' and (x->>'id')::uuid=new.seat_id;
 if not coalesce((select sec.numbered from public.ceremony_quotas q join public.ceremony_sectors sec on sec.id=q.sector_id where q.id=a.quota_id),false) then raise exception 'Sector assignments do not have numbered chairs' using errcode='23514';end if;
 if a.id is null or s is null or (s->>'blocked')::boolean or (s->>'sectorId')::uuid<>(select sector_id from public.ceremony_quotas where id=a.quota_id) then raise exception 'Invalid seat allocation' using errcode='23514';end if;
 if (select count(*) from public.ceremony_seat_claims where allocation_id=a.id and released_at is null and id<>new.id)>=a.quantity then raise exception 'Seat budget exceeded' using errcode='23514';end if;
 if new.nominee_id is not null then
  select * into n from public.ceremony_nominees where id=new.nominee_id and allocation_id=a.id and revoked_at is null and needs_seat;
  if n.id is null then raise exception 'Invalid nominee' using errcode='23514';end if;
 end if;return new;
end $$;
-- Current event: retain allocations, nominees, quotas, map UUIDs and historical claims.
-- Only the active link to a specific chair is retired; sector capacity is unchanged.
do $$ declare p public.ceremony_plans; released integer; begin
 for p in select cp.* from public.ceremony_plans cp join public.events e on e.id=cp.event_id where e.is_current order by cp.id loop
  perform pg_advisory_xact_lock(hashtextextended(p.event_id::text,1381));
  perform 1 from public.ceremony_plans where id=p.id for update;
  if not exists(select 1 from public.ceremony_sectors where plan_id=p.id and numbered) then continue;end if;
  update public.ceremony_seat_claims set released_at=clock_timestamp() where plan_id=p.id and released_at is null;
  get diagnostics released=row_count;
  update public.ceremony_sectors set numbered=false where plan_id=p.id;
  update public.ceremony_plans set revision=revision+1 where id=p.id;
  insert into public.audit_logs(event_id,action,entity_table,entity_id,metadata) values(p.event_id,'ceremony.sector_only','ceremony_plans',p.id,jsonb_build_object('migration','20261022200000','historical_chair_links',released));
 end loop;
end $$;

-- DIRECTORY AND LEADER BATCH
create function public.get_ceremony_sector_directory(p_event uuid,p_actor uuid,p_plan uuid,p_group uuid,p_search text,p_page integer,p_without_group boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.ceremony_plans; result jsonb;
begin
 perform app.ceremony_authorize(p_event,p_actor,true);
 if p_search is null or length(p_search)>200 or p_page is null or p_page not between 1 and 1000000 or p_without_group is null or (p_without_group and p_group is not null) then raise exception 'invalid' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into p from public.ceremony_plans where id=p_plan and event_id=p_event;
 if p.id is null or (p_group is not null and not exists(select 1 from public.groups where id=p_group and event_id=p_event and is_active)) then raise exception 'forbidden' using errcode='42501';end if;
 with members as materialized (
  select r.id,pe.first_name||' '||pe.last_name as name,pe.public_code as code,
   case when exists(select 1 from public.event_attendance_choices ac join public.event_moments m on m.id=p.moment_id where ac.registration_id=r.id and ac.day=(m.starts_at at time zone 'Europe/Rome')::date and (ac.day_part=p.attendance_part or ac.day_part='day' or p.attendance_part='day') and ac.choice='yes') then 'yes'
    when exists(select 1 from public.event_attendance_choices ac join public.event_moments m on m.id=p.moment_id where ac.registration_id=r.id and ac.day=(m.starts_at at time zone 'Europe/Rome')::date and (ac.day_part=p.attendance_part or ac.day_part='day' or p.attendance_part='day') and ac.choice='no') then 'no' else 'unknown' end as attendance
  from public.registrations r join public.participants pe on pe.id=r.participant_id
  where r.event_id=p_event and r.deleted_at is null and r.status in ('submitted','confirmed')
   and (p_group is null or exists(select 1 from public.participant_group_assignments ga where ga.registration_id=r.id and ga.group_id=p_group and ga.is_current and ga.status='confirmed'))
   and (not p_without_group or not exists(select 1 from public.participant_group_assignments ga where ga.registration_id=r.id and ga.is_current and ga.status='confirmed'))
 ), subjects as materialized (
  select m.id as registration_id,null::uuid as child_id,m.name,m.code,null::text as parent,m.attendance from members m
  union all
  select m.id,ch.id,ch.first_name||' '||ch.last_name,m.code,m.name,m.attendance from members m join public.registration_children ch on ch.registration_id=m.id
 ), people as materialized (
  select s.*,n.id as nominee_id,n.needs_seat,sec.name as sector from subjects s
  left join public.ceremony_nominees n on n.plan_id=p_plan and n.subject_id=coalesce(s.child_id,s.registration_id) and n.revoked_at is null
  left join public.ceremony_allocations a on a.id=n.allocation_id left join public.ceremony_quotas q on q.id=a.quota_id left join public.ceremony_sectors sec on sec.id=q.sector_id
 ), filtered as materialized (
  select * from people where strpos(lower(name||' '||coalesce(code,'')||' '||coalesce(parent,'')),lower(btrim(p_search)))>0
 ), totals as (select count(*)::integer as total,greatest(1,ceil(count(*)/100.0)::integer) as pages from filtered),
 selected as (select * from filtered order by (attendance='yes') desc,lower(name),registration_id,child_id nulls first limit 100 offset (select (least(p_page,pages)-1)*100 from totals))
 select jsonb_build_object('revision',p.revision,'page',least(p_page,t.pages),'pageCount',t.pages,'total',t.total,
  'people',coalesce((select jsonb_agg(jsonb_build_object('registrationId',registration_id,'childId',child_id,'name',name,'code',code,'parent',parent,'attendance',attendance,'nomineeId',nominee_id,'needsSeat',needs_seat,'sector',sector) order by (attendance='yes') desc,lower(name),registration_id,child_id nulls first) from selected),'[]'),
  'summary',jsonb_build_object('total',(select count(*) from people),'assigned',(select count(*) from people where nominee_id is not null and needs_seat),'withoutSeat',(select count(*) from people where nominee_id is not null and not needs_seat),'unassigned',(select count(*) from people where nominee_id is null)),
  'reserves',coalesce((select jsonb_agg(jsonb_build_object('sectorId',q.sector_id,'sector',s.name,'quantity',a.quantity,'used',(select count(*) from public.ceremony_nominees n where n.allocation_id=a.id and n.revoked_at is null and n.needs_seat))) from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id where a.plan_id=p_plan and a.group_id=p_group and a.revoked_at is null),'[]')) into result from totals t;
 return result;
end $$;

-- The outer request is replayable as a whole, including a lost HTTP response.
-- Each inner pairing retains its canonical fresh scope, capacity and child checks.
create function public.assign_ceremony_group_members(p_event uuid,p_actor uuid,p_allocation uuid,p_revision integer,p_request uuid,p_subjects jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.ceremony_allocations; p public.ceremony_plans; scope uuid[]; fp text; prev public.ceremony_map_requests; item jsonb; result jsonb; rev integer; failure text;
begin
 if p_request is null or p_revision is null or p_revision<0 or jsonb_typeof(p_subjects) is distinct from 'array' or jsonb_array_length(p_subjects) not between 1 and 10000 then raise exception 'invalid' using errcode='22023';end if;
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 perform 1 from public.event_user_roles where user_id=p_actor for share;
 lock table public.groups,public.group_memberships,public.participant_group_assignments,public.registration_children in share mode;
 select coalesce(array_agg(id),'{}') into scope from app.ceremony_leader_scope(p_event,p_actor) id;
 if cardinality(scope)=0 then raise exception 'forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select ca.* into a from public.ceremony_allocations ca join public.ceremony_plans cp on cp.id=ca.plan_id where ca.id=p_allocation and cp.event_id=p_event and ca.group_id=any(scope);
 if a.id is null then raise exception 'forbidden' using errcode='42501';end if;
 select * into p from public.ceremony_plans where id=a.plan_id for update;
 fp:=encode(sha256(convert_to(jsonb_build_array('leader_sector_batch',p_event,p_actor,p_allocation,p_revision,p_subjects)::text,'UTF8')),'hex');
 select * into prev from public.ceremony_map_requests where request_id=p_request;
 if found then
  if prev.actor_id<>p_actor or prev.fingerprint<>fp then raise exception 'invalid replay' using errcode='22023';end if;
  return jsonb_build_object('status','saved');
 end if;
 if p.revision<>p_revision or a.revoked_at is not null then return jsonb_build_object('status','conflict');end if;
 if exists(select 1 from public.ceremony_quotas q join public.ceremony_sectors s on s.id=q.sector_id where q.id=a.quota_id and s.numbered) then return jsonb_build_object('status','invalid');end if;
 if (select count(distinct coalesce(x->>'childId',x->>'registrationId')) from jsonb_array_elements(p_subjects) x)<>jsonb_array_length(p_subjects) then raise exception 'invalid subjects' using errcode='22023';end if;
 begin
  for item in select value from jsonb_array_elements(p_subjects) loop
   select revision into rev from public.ceremony_plans where id=p.id;
   result:=public.pair_ceremony_group_ticket(p_event,p_actor,a.id,rev,gen_random_uuid(),'assign',null,(item->>'registrationId')::uuid,(item->>'childId')::uuid,null);
   if result->>'status'<>'saved' then raise exception using errcode='P1390',message=result->>'status';end if;
  end loop;
  insert into public.ceremony_map_requests values(p_request,p_actor,p_event,fp);
  insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata) values(p_event,p_actor,'ceremony.leader_sector_batch','ceremony_allocations',a.id,jsonb_build_object('request_id',p_request,'quantity',jsonb_array_length(p_subjects)));
 exception when sqlstate 'P1390' then get stacked diagnostics failure=message_text;return jsonb_build_object('status',failure);
 end;
 return jsonb_build_object('status','saved');
end $$;
revoke all on function public.get_ceremony_sector_directory(uuid,uuid,uuid,uuid,text,integer,boolean),public.assign_ceremony_group_members(uuid,uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.get_ceremony_sector_directory(uuid,uuid,uuid,uuid,text,integer,boolean),public.assign_ceremony_group_members(uuid,uuid,uuid,integer,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
