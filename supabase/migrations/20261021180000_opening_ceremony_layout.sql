-- Opening hall: mixed numbered/sector-only areas and explicit direct child seats.
-- Schema only: the real layout is initialized by a separate Admin command.
alter table public.ceremony_plans add column layout_key text;
alter table public.ceremony_sectors add column numbered boolean not null default true,
 add column layout_code text, add column assignable_limit integer check(assignable_limit>=0);
create unique index ceremony_sector_layout_code on public.ceremony_sectors(plan_id,layout_code) where layout_code is not null;
-- Historical child identity is retained, as in ceremony_nominees.
alter table public.ceremony_allocations add column child_id uuid,
 add constraint ceremony_direct_child check(child_id is null or registration_id is not null);
drop index public.ceremony_person_once;
create unique index ceremony_person_once on public.ceremony_allocations(plan_id,registration_id) where revoked_at is null and child_id is null;
create unique index ceremony_direct_child_once on public.ceremony_allocations(plan_id,child_id) where revoked_at is null and child_id is not null;


create or replace function app.synchronize_ceremony_direct() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.group_id is not null and (new.revoked_at is not null or new.quantity<old.quantity) and
   (select count(*) from public.ceremony_nominees where allocation_id=new.id and revoked_at is null and (new.revoked_at is not null or needs_seat))>(case when new.revoked_at is not null then 0 else new.quantity end) then
   raise exception 'Revoke or move nominations first' using errcode='P1302';
 end if;
 if new.registration_id is not null then
   if new.revoked_at is null then
     insert into public.ceremony_nominees(plan_id,allocation_id,registration_id,child_id,subject_name)
      select new.plan_id,new.id,new.registration_id,new.child_id,'' where not exists(select 1 from public.ceremony_nominees where allocation_id=new.id and revoked_at is null);
   else
     update public.ceremony_nominees set revoked_at=coalesce(revoked_at,new.revoked_at) where allocation_id=new.id and revoked_at is null;
   end if;
 end if;
 return new;
end $$;

create or replace function app.guard_ceremony_nominee() returns trigger
language plpgsql security invoker set search_path='' as $$
declare a public.ceremony_allocations; e uuid; subject_label text;
begin
 select event_id into e from public.ceremony_plans where id=new.plan_id;
 perform pg_advisory_xact_lock(hashtextextended(e::text,1381));
 select * into a from public.ceremony_allocations where id=new.allocation_id;
 if a.id is null or a.plan_id<>new.plan_id or (a.revoked_at is not null and new.revoked_at is null) then raise exception 'invalid allocation' using errcode='23514';end if;
 if tg_op='UPDATE' and (new.plan_id,new.allocation_id,new.registration_id,new.child_id) is distinct from (old.plan_id,old.allocation_id,old.registration_id,old.child_id) then raise exception 'immutable nomination' using errcode='23514';end if;
 if new.revoked_at is null then
   if a.registration_id is not null and (a.registration_id<>new.registration_id or new.child_id is distinct from a.child_id) then raise exception 'invalid direct subject' using errcode='23514';end if;
   if new.needs_seat and (select count(*) from public.ceremony_nominees where allocation_id=a.id and revoked_at is null and needs_seat and id<>new.id)>=a.quantity then raise exception 'nomination capacity' using errcode='23514';end if;
 end if;
 if tg_op='INSERT' then
   if new.child_id is null then select p.first_name||' '||p.last_name into subject_label from public.registrations r join public.participants p on p.id=r.participant_id where r.id=new.registration_id and r.event_id=e;
   else select c.first_name||' '||c.last_name into subject_label from public.registration_children c join public.registrations r on r.id=c.registration_id where c.id=new.child_id and c.registration_id=new.registration_id and r.event_id=e;end if;
   if subject_label is null then raise exception 'subject unavailable' using errcode='23514';end if;
   new.subject_name:=subject_label;
 end if;
 return new;
end $$;

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
 if p_operation in ('configure','sector') and not admin then raise exception 'forbidden' using errcode='42501';end if;
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
     if app.ceremony_eligibility(rid,(moment.starts_at at time zone 'Europe/Rome')::date,plan.attendance_part)<>'eligible' then return jsonb_build_object('status','ineligible');end if;
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
   if qty+coalesce((select sum(quantity) from public.ceremony_allocations where quota_id=quota.id and revoked_at is null),0)>quota.quantity then return jsonb_build_object('status','capacity');end if;
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

create or replace function public.get_ceremony(p_event uuid,p_actor uuid,p_kind text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare plan public.ceremony_plans%rowtype; moment public.event_moments%rowtype; result jsonb; day date;
begin
 perform app.ceremony_authorize(p_event,p_actor,false);
 if p_kind is null or p_kind not in ('opening','closing') then raise exception 'invalid' using errcode='22023';end if;
 -- One consistent snapshot across configuration, quotas, people and allocations.
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into plan from public.ceremony_plans where event_id=p_event and kind=p_kind;
 if plan.id is null then return jsonb_build_object('plan',null,'sectors','[]'::jsonb,'quotas','[]'::jsonb,'allocations','[]'::jsonb,'people','[]'::jsonb,'groups','[]'::jsonb);end if;
 select * into moment from public.event_moments where id=plan.moment_id;
 day:=(moment.starts_at at time zone 'Europe/Rome')::date;
 if (select count(*) from public.registrations where event_id=p_event)>50000 then raise exception 'Too many registrations for a complete snapshot';end if;
 select jsonb_build_object(
 'plan',jsonb_build_object('id',plan.id,'revision',plan.revision,'state',plan.state,'layoutKey',plan.layout_key,'attendancePart',plan.attendance_part,'location',(select name from public.event_locations where id=moment.location_id),'capacity',moment.capacity,'startsAt',to_char(moment.starts_at at time zone 'Europe/Rome','YYYY-MM-DD"T"HH24:MI'),'endsAt',to_char(moment.ends_at at time zone 'Europe/Rome','YYYY-MM-DD"T"HH24:MI')),
 'sectors',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'capacity',s.capacity,'numbered',s.numbered,'layoutCode',s.layout_code,'assignableLimit',s.assignable_limit) order by s.name,s.id) from public.ceremony_sectors s where s.plan_id=plan.id),'[]'),
 'quotas',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'sectorId',q.sector_id,'category',q.category,'quantity',q.quantity) order by q.category,q.id) from public.ceremony_quotas q where q.plan_id=plan.id),'[]'),
 'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'quotaId',a.quota_id,'groupId',a.group_id,'registrationId',a.registration_id,'childId',a.child_id,'quantity',a.quantity,'review',case when a.group_id is not null then not coalesce(g.is_active,false) else (a.child_id is not null and not exists(select 1 from public.registration_children ch where ch.id=a.child_id and ch.registration_id=r.id)) or r.deleted_at is not null or r.status not in ('submitted','confirmed') or app.ceremony_eligibility(r.id,day,plan.attendance_part)<>'eligible' or a.group_snapshot is distinct from array(select ga.group_id from public.participant_group_assignments ga where ga.registration_id=r.id and ga.is_current order by ga.group_id) end,'name',coalesce(g.name,(select n.subject_name from public.ceremony_nominees n where n.allocation_id=a.id and n.revoked_at is null limit 1),p.first_name||' '||p.last_name)) order by a.created_at,a.id) from public.ceremony_allocations a left join public.groups g on g.id=a.group_id left join public.registrations r on r.id=a.registration_id left join public.participants p on p.id=r.participant_id where a.plan_id=plan.id and a.revoked_at is null),'[]'),
 'people',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',p.first_name||' '||p.last_name,'code',p.public_code,'children',coalesce((select jsonb_agg(jsonb_build_object('id',ch.id,'name',ch.first_name||' '||ch.last_name) order by ch.position,ch.id) from public.registration_children ch where ch.registration_id=r.id),'[]'),'eligibility',app.ceremony_eligibility(r.id,day,plan.attendance_part)) order by p.last_name,p.first_name,r.id) from public.registrations r join public.participants p on p.id=r.participant_id where r.event_id=p_event and r.deleted_at is null and r.status in ('submitted','confirmed')),'[]'),
 'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'eligible', (select count(*) from public.participant_group_assignments ga join public.registrations r on r.id=ga.registration_id where ga.group_id=g.id and ga.is_current and r.event_id=p_event and r.deleted_at is null and r.status in ('submitted','confirmed') and app.ceremony_eligibility(r.id,day,plan.attendance_part)='eligible')) order by g.name,g.id) from public.groups g where g.event_id=p_event and g.is_active),'[]')) into result;
 return result;
end $$;

create or replace function app.guard_ceremony_map_quota() returns trigger language plpgsql security invoker set search_path='' as $$
declare usable bigint;e uuid;
begin
 select event_id into e from public.ceremony_plans where id=new.plan_id;
 perform pg_advisory_xact_lock(hashtextextended(e::text,1381));
 if exists(select 1 from public.ceremony_sectors s where s.id=new.sector_id and s.assignable_limit is not null and new.quantity+coalesce((select sum(q.quantity) from public.ceremony_quotas q where q.sector_id=s.id and q.id<>new.id),0)>s.assignable_limit) then raise exception 'Quota exceeds assignable limit' using errcode='P1304';end if;
 if (select numbered from public.ceremony_sectors where id=new.sector_id) and exists(select 1 from public.ceremony_map_versions where plan_id=new.plan_id and state='published') then
  select count(*) into usable from public.ceremony_map_versions v cross join lateral jsonb_array_elements(v.seats) s where v.plan_id=new.plan_id and v.state='published' and (s->>'sectorId')::uuid=new.sector_id and not (s->>'blocked')::boolean;
  if new.quantity+coalesce((select sum(quantity) from public.ceremony_quotas where sector_id=new.sector_id and id<>new.id),0)>usable then raise exception 'Quota exceeds mapped capacity' using errcode='P1304';end if;
 end if;return new;
end $$;

create or replace function public.set_ceremony_map(p_event uuid,p_actor uuid,p_plan uuid,p_revision integer,p_request uuid,p_operation text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.ceremony_plans; a public.ceremony_allocations;n public.ceremony_nominees;v public.ceremony_map_versions;old_v public.ceremony_map_versions;
 manager boolean;admin boolean;scope uuid[];fp text;prev public.ceremony_map_requests;ids uuid[];seat jsonb; ident uuid; count_seats integer;
begin
 if p_request is null or p_revision is null or p_operation is null or p_operation not in ('draft','publish','reserve','release','name','unname') or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Invalid command' using errcode='22023';end if;
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 perform 1 from public.event_user_roles where user_id=p_actor for share;
 select exists(select 1 from public.event_user_roles where user_id=p_actor and role='admin' and event_id is null),exists(select 1 from public.event_user_roles where user_id=p_actor and ((role='admin' and event_id is null) or (role='manager' and event_id=p_event))) into admin,manager;
 lock table public.groups,public.group_memberships,public.participant_group_assignments,public.registration_children in share mode;
 select coalesce(array_agg(id),'{}') into scope from app.ceremony_leader_scope(p_event,p_actor) id;
 if not manager and (p_operation not in ('name','unname') or cardinality(scope)=0) then raise exception 'forbidden' using errcode='42501';end if;
 if p_operation in ('draft','publish') and not admin then raise exception 'forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into p from public.ceremony_plans where id=p_plan and event_id=p_event for update;
 if p.id is null then raise exception 'forbidden' using errcode='42501';end if;
 if p_operation not in ('draft','publish') then
  select * into a from public.ceremony_allocations where id=(p_data->>'allocationId')::uuid and plan_id=p.id;
  if a.id is null or (not manager and not coalesce(a.group_id=any(scope),false)) then raise exception 'forbidden' using errcode='42501';end if;
 end if;
 fp:=encode(sha256(convert_to(jsonb_build_array(p_event,p_actor,p_plan,p_revision,p_operation,p_data)::text,'UTF8')),'hex');
 select * into prev from public.ceremony_map_requests where request_id=p_request;
 if found then
  if prev.actor_id<>p_actor or prev.fingerprint<>fp then raise exception 'Invalid replay' using errcode='22023';end if;
  return jsonb_build_object('status','saved');
 end if;
 if p.revision<>p_revision then return jsonb_build_object('status','conflict');end if;
 select * into old_v from public.ceremony_map_versions where plan_id=p.id and state='published';
 if p_operation='draft' then
  if jsonb_typeof(p_data->'seats') is distinct from 'array' or jsonb_array_length(p_data->'seats')>10000 or length(btrim(coalesce(p_data->>'title',''))) not between 1 and 100 then raise exception 'Invalid layout' using errcode='22023';end if;
  ids:='{}';
  for seat in select value from jsonb_array_elements(p_data->'seats') loop
   ident:=(seat->>'id')::uuid;
   if ident is null or ident=any(ids) or not exists(select 1 from public.ceremony_sectors where id=(seat->>'sectorId')::uuid and plan_id=p.id and numbered) or
    length(btrim(coalesce(seat->>'row',''))) not between 1 and 30 or length(btrim(coalesce(seat->>'number',''))) not between 1 and 30 or
    jsonb_typeof(seat->'x') is distinct from 'number' or jsonb_typeof(seat->'y') is distinct from 'number' or
    (seat->>'x')::numeric not between 0 and 10000 or (seat->>'y')::numeric not between 0 and 10000 or jsonb_typeof(seat->'blocked') is distinct from 'boolean' then raise exception 'Invalid seat' using errcode='22023';end if;
   ids:=array_append(ids,ident);
   if exists(select 1 from public.ceremony_seat_identities where id=ident and (plan_id<>p.id or sector_id<>(seat->>'sectorId')::uuid)) then raise exception 'Seat identity belongs elsewhere' using errcode='22023';end if;
   insert into public.ceremony_seat_identities(id,plan_id,sector_id) values(ident,p.id,(seat->>'sectorId')::uuid) on conflict(id) do nothing;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_data->'seats') s group by s->>'sectorId',lower(btrim(s->>'row')),lower(btrim(s->>'number')) having count(*)>1) then raise exception 'Duplicate label' using errcode='22023';end if;
  select * into v from public.ceremony_map_versions where plan_id=p.id and state='draft';
  if v.id is null then
   insert into public.ceremony_map_versions(id,plan_id,version,title,state,seats) values(pg_catalog.gen_random_uuid(),p.id,coalesce((select max(version) from public.ceremony_map_versions where plan_id=p.id),0)+1,btrim(p_data->>'title'),'draft',p_data->'seats');
  else update public.ceremony_map_versions set title=btrim(p_data->>'title'),seats=p_data->'seats' where id=v.id;end if;
 elsif p_operation='publish' then
  select * into v from public.ceremony_map_versions where id=(p_data->>'versionId')::uuid and plan_id=p.id and state='draft';
  if v.id is null then return jsonb_build_object('status','conflict');end if;
  if p.state<>'validated' then return jsonb_build_object('status','unconfigured');end if;
  -- Every sector retains its quantitative budget; numbering never spends it again.
  if exists(select 1 from public.ceremony_sectors s where s.plan_id=p.id and s.numbered and (s.capacity is null or
    (select count(*) from jsonb_array_elements(v.seats) x where (x->>'sectorId')::uuid=s.id and not (x->>'blocked')::boolean)>least(s.capacity,coalesce(s.assignable_limit,s.capacity)) or
    (select count(*) from jsonb_array_elements(v.seats) x where (x->>'sectorId')::uuid=s.id and not (x->>'blocked')::boolean)<coalesce((select sum(quantity) from public.ceremony_quotas where sector_id=s.id),0))) then return jsonb_build_object('status','capacity');end if;
  if exists(select 1 from public.ceremony_seat_claims c where c.plan_id=p.id and c.released_at is null and not exists(
   select 1 from jsonb_array_elements(v.seats) s join jsonb_array_elements(old_v.seats) old_s on old_s->>'id'=s->>'id'
   where (s->>'id')::uuid=c.seat_id and not (s->>'blocked')::boolean and (s->>'sectorId',s->>'row',s->>'number')=(old_s->>'sectorId',old_s->>'row',old_s->>'number'))) then return jsonb_build_object('status','seats_active');end if;
  update public.ceremony_map_versions set state='archived' where id=old_v.id;
  update public.ceremony_map_versions set state='published',published_at=now() where id=v.id;
 else
  if a.revoked_at is not null then return jsonb_build_object('status','conflict');end if;
  if old_v.id is null or p.state<>'validated' then return jsonb_build_object('status','unconfigured');end if;
  if jsonb_typeof(p_data->'seatIds') is distinct from 'array' then raise exception 'Seat selection required' using errcode='22023';end if;
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(p_data->'seatIds');
  if coalesce(cardinality(ids),0) not between 1 and 10000 or cardinality(ids)<>(select count(distinct x) from unnest(ids) x) then raise exception 'Invalid selection' using errcode='22023';end if;
  if p_operation='reserve' then
   if a.group_id is not null and not exists(select 1 from public.groups where id=a.group_id and is_active) then return jsonb_build_object('status','ineligible');end if;
   select count(*) into count_seats from jsonb_array_elements(old_v.seats) s where (s->>'id')::uuid=any(ids) and not (s->>'blocked')::boolean and (s->>'sectorId')::uuid=(select sector_id from public.ceremony_quotas where id=a.quota_id);
   if count_seats<>cardinality(ids) then raise exception 'Invalid seat scope' using errcode='22023';end if;
   if exists(select 1 from public.ceremony_seat_claims where seat_id=any(ids) and released_at is null) then return jsonb_build_object('status','occupied');end if;
   if cardinality(ids)+(select count(*) from public.ceremony_seat_claims where allocation_id=a.id and released_at is null)>a.quantity then return jsonb_build_object('status','capacity');end if;
   insert into public.ceremony_seat_claims(plan_id,seat_id,allocation_id) select p.id,x,a.id from unnest(ids) x;
  else
   if (select count(*) from public.ceremony_seat_claims where allocation_id=a.id and seat_id=any(ids) and released_at is null)<>cardinality(ids) then raise exception 'Invalid seat scope' using errcode='42501';end if;
   if p_operation='release' then
    if exists(select 1 from public.ceremony_seat_claims where seat_id=any(ids) and released_at is null and nominee_id is not null) then return jsonb_build_object('status','seats_active');end if;
    update public.ceremony_seat_claims set released_at=now() where seat_id=any(ids) and released_at is null;
   elsif p_operation='unname' then
    update public.ceremony_seat_claims set nominee_id=null where seat_id=any(ids) and released_at is null;
   else
    if cardinality(ids)<>1 then raise exception 'Choose one seat' using errcode='22023';end if;
    select * into n from public.ceremony_nominees where id=(p_data->>'nomineeId')::uuid and allocation_id=a.id and needs_seat and revoked_at is null;
    if n.id is null then raise exception 'Invalid nominee' using errcode='22023';end if;
    perform 1 from public.registrations where id=n.registration_id for update;
    if app.ceremony_nominee_needs_review(n.id) then return jsonb_build_object('status','ineligible');end if;
    if exists(select 1 from public.ceremony_seat_claims where released_at is null and (nominee_id=n.id or (seat_id=ids[1] and nominee_id is not null))) then return jsonb_build_object('status','occupied');end if;
    update public.ceremony_seat_claims set nominee_id=n.id where seat_id=ids[1] and released_at is null;
   end if;
  end if;
 end if;
 update public.ceremony_plans set revision=revision+1 where id=p.id;
 insert into public.ceremony_map_requests values(p_request,p_actor,p_event,fp);
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata) values(p_event,p_actor,'ceremony.map_'||p_operation,'ceremony_plans',p.id,jsonb_build_object('request_id',p_request,'allocation_id',a.id,'seat_count',cardinality(ids)));
 return jsonb_build_object('status','saved');
end $$;

create or replace function public.get_ceremony_map(p_event uuid,p_actor uuid,p_plan uuid,p_mode text default 'manager') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d jsonb;p public.ceremony_plans;admin boolean:=false;ids uuid[];
begin
 -- Reuse E2's complete authorized snapshot and lock; never accept client scope.
 d:=public.get_ceremony_distribution(p_event,p_actor,p_mode);
 select * into p from public.ceremony_plans where id=p_plan and event_id=p_event;
 select coalesce(array_agg((a->>'id')::uuid),'{}') into ids from jsonb_array_elements(d->'allocations') a where (a->>'planId')::uuid=p_plan;
 if p.id is null or (p_mode='leader' and cardinality(ids)=0) then raise exception 'forbidden' using errcode='42501';end if;
 if p_mode='manager' then select exists(select 1 from public.event_user_roles where user_id=p_actor and role='admin' and event_id is null) into admin;end if;
 return jsonb_build_object('planId',p.id,'layoutKey',p.layout_key,'revision',p.revision,'kind',p.kind,'state',p.state,
  'active',(select jsonb_build_object('id',id,'version',version,'title',title,'seats',seats) from public.ceremony_map_versions where plan_id=p.id and state='published'),
  'draft',case when admin then (select jsonb_build_object('id',id,'version',version,'title',title,'seats',seats) from public.ceremony_map_versions where plan_id=p.id and state='draft') end,
  'history',case when admin then coalesce((select jsonb_agg(jsonb_build_object('id',id,'version',version,'title',title,'seats',seats) order by version desc) from public.ceremony_map_versions where plan_id=p.id and state='archived'),'[]') else '[]'::jsonb end,
  'sectors',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'capacity',capacity,'numbered',numbered,'layoutCode',layout_code,'assignableLimit',assignable_limit) order by name,id) from public.ceremony_sectors where plan_id=p.id),'[]'),
  'allocations',coalesce((select jsonb_agg(a||jsonb_build_object('sectorId',q.sector_id)) from jsonb_array_elements(d->'allocations') a join public.ceremony_allocations ca on ca.id=(a->>'id')::uuid join public.ceremony_quotas q on q.id=ca.quota_id where ca.id=any(ids)),'[]'),
  'nominees',coalesce((select jsonb_agg(n) from jsonb_array_elements(d->'nominees') n where (n->>'allocationId')::uuid=any(ids)),'[]'),
  'claims',coalesce((select jsonb_agg(jsonb_build_object('seatId',seat_id,'allocationId',case when allocation_id=any(ids) then allocation_id end,'nomineeId',case when allocation_id=any(ids) then nominee_id end)) from public.ceremony_seat_claims where plan_id=p.id and released_at is null),'[]'));
end $$;

create or replace function public.get_my_ceremony_seats(p_event uuid,p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select coalesce(jsonb_agg(s||jsonb_build_object('seat',app.ceremony_numbered_seat((s->>'id')::uuid),'mapAvailable',exists(select 1 from public.ceremony_map_versions v join public.ceremony_nominees n on n.plan_id=v.plan_id join public.ceremony_allocations a on a.id=n.allocation_id join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors sec on sec.id=q.sector_id where n.id=(s->>'id')::uuid and v.state='published' and sec.numbered))),'[]') into result
 from jsonb_array_elements(public.ceremony_personal_seats_e2(p_event,p_actor)) s;
 return result;
end $$;

-- Explicit preparation command. It never overwrites an existing ceremony.
create function public.prepare_opening_ceremony_layout(p_event uuid,p_actor uuid,p_revision integer)
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
  ('D',600,true,600),('E',600,true,600),('F',400,false,400),
  ('H1',70,true,70),('H2',70,true,70)
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
  select 5 band,block,row_no,chair,case block when 1 then 'H1' else 'H2' end code,
   (case block when 1 then 'H1' else 'H2' end)||'-r'||lpad(row_no::text,2,'0') row_label,
   3430+(row_no-1)*54 x,120+(6-block)*650+(10-chair)*54 y,false blocked
  from (values(1),(6)) b(block) cross join generate_series(1,7) row_no cross join generate_series(1,10) chair
 ), all_seats as (select * from main union all select * from rear)
 select jsonb_agg(jsonb_build_object('id',md5(p.id::text||':seat:'||row_label||':'||chair)::uuid,
  'sectorId',md5(p.id::text||':sector:'||code)::uuid,'row',row_label,'number',chair::text,'x',x,'y',y,'blocked',blocked) order by band,block,row_no,chair) into seats from all_seats;
 result:=public.set_ceremony_map(p_event,p_actor,p.id,p.revision,gen_random_uuid(),'draft',jsonb_build_object('title','Inaugurazione · Padiglione 9','seats',seats));
 if result->>'status'<>'saved' then raise exception 'Layout preparation failed';end if;
 return jsonb_build_object('status','saved');
end $$;
revoke all on function public.prepare_opening_ceremony_layout(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.prepare_opening_ceremony_layout(uuid,uuid,integer) to service_role;
notify pgrst,'reload schema';
