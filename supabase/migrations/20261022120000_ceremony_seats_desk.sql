-- Assignments are independent of declared attendance. Declarations remain unchanged.
begin;
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
 'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'quotaId',a.quota_id,'groupId',a.group_id,'registrationId',a.registration_id,'childId',a.child_id,'quantity',a.quantity,'review',case when a.group_id is not null then not coalesce(g.is_active,false) else (a.child_id is not null and not exists(select 1 from public.registration_children ch where ch.id=a.child_id and ch.registration_id=r.id)) or r.deleted_at is not null or r.status not in ('submitted','confirmed') or a.group_snapshot is distinct from array(select ga.group_id from public.participant_group_assignments ga where ga.registration_id=r.id and ga.is_current order by ga.group_id) end,'name',coalesce(g.name,(select n.subject_name from public.ceremony_nominees n where n.allocation_id=a.id and n.revoked_at is null limit 1),p.first_name||' '||p.last_name)) order by a.created_at,a.id) from public.ceremony_allocations a left join public.groups g on g.id=a.group_id left join public.registrations r on r.id=a.registration_id left join public.participants p on p.id=r.participant_id where a.plan_id=plan.id and a.revoked_at is null),'[]'),
 'people',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',p.first_name||' '||p.last_name,'code',p.public_code,'children',coalesce((select jsonb_agg(jsonb_build_object('id',ch.id,'name',ch.first_name||' '||ch.last_name) order by ch.position,ch.id) from public.registration_children ch where ch.registration_id=r.id),'[]'),'eligibility',app.ceremony_eligibility(r.id,day,plan.attendance_part)) order by p.last_name,p.first_name,r.id) from public.registrations r join public.participants p on p.id=r.participant_id where r.event_id=p_event and r.deleted_at is null and r.status in ('submitted','confirmed')),'[]'),
 'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'eligible', (select count(*) from public.participant_group_assignments ga join public.registrations r on r.id=ga.registration_id where ga.group_id=g.id and ga.is_current and r.event_id=p_event and r.deleted_at is null and r.status in ('submitted','confirmed') and app.ceremony_eligibility(r.id,day,plan.attendance_part)='eligible')) order by g.name,g.id) from public.groups g where g.event_id=p_event and g.is_active),'[]')) into result;
 return result;
end $$;

create or replace function public.set_ceremony_nominee(p_event uuid,p_actor uuid,p_action text,p_allocation uuid,p_registration uuid,p_child uuid,p_nominee uuid,p_revision integer,p_request uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.ceremony_allocations; old_a public.ceremony_allocations; n public.ceremony_nominees; p public.ceremony_plans; m public.event_moments; manager boolean; need_seat boolean:=true; scope uuid[]; fp text; prev public.ceremony_distribution_requests;
begin
 if p_action is null or p_action not in ('assign','revoke','move','no_seat') or p_request is null or p_revision is null then raise exception 'invalid' using errcode='22023';end if;
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 perform 1 from public.event_user_roles where user_id=p_actor for share;
 select exists(select 1 from public.event_user_roles where user_id=p_actor and ((role='admin' and event_id is null) or (role='manager' and event_id=p_event))) into manager;
 -- Membership, hierarchy and composition cannot change between authorization and write.
 lock table public.groups,public.group_memberships,public.participant_group_assignments,public.registration_children in share mode;
 select coalesce(array_agg(id),'{}') into scope from app.ceremony_leader_scope(p_event,p_actor) id;
 if not manager and cardinality(scope)=0 then raise exception 'forbidden' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 if p_action in ('revoke','move') then
   select * into n from public.ceremony_nominees where id=p_nominee;
   select * into old_a from public.ceremony_allocations where id=n.allocation_id;
   if n.id is null or not exists(select 1 from public.ceremony_plans where id=n.plan_id and event_id=p_event) or (not manager and not coalesce(old_a.group_id=any(scope),false)) then raise exception 'forbidden' using errcode='42501';end if;
 end if;
 if p_action in ('assign','move','no_seat') then
   select * into a from public.ceremony_allocations where id=p_allocation;
   if a.id is null or a.group_id is null or not exists(select 1 from public.ceremony_plans where id=a.plan_id and event_id=p_event) or (not manager and not a.group_id=any(scope)) then raise exception 'forbidden' using errcode='42501';end if;
   if p_action='move' and a.plan_id<>n.plan_id then raise exception 'invalid' using errcode='22023';end if;
 else a:=old_a;end if;
 fp:=encode(sha256(convert_to(jsonb_build_array(p_event,p_actor,p_action,p_allocation,p_registration,p_child,p_nominee,p_revision)::text,'UTF8')),'hex');
 select * into prev from public.ceremony_distribution_requests where request_id=p_request;
 if found then
   if prev.actor_id<>p_actor or prev.fingerprint<>fp then raise exception 'invalid replay' using errcode='22023';end if;
   return jsonb_build_object('status','saved');
 end if;
 select * into p from public.ceremony_plans where id=a.plan_id for update;
 if p.revision<>p_revision then return jsonb_build_object('status','conflict');end if;
 if a.revoked_at is not null or (p_action in ('revoke','move') and n.revoked_at is not null) then return jsonb_build_object('status','conflict');end if;
 if p_action in ('assign','move','no_seat') then
   if p.state<>'validated' then return jsonb_build_object('status','unconfigured');end if;
   if p_action='move' then p_registration:=n.registration_id;p_child:=n.child_id;need_seat:=n.needs_seat;end if;
   if p_action='no_seat' then need_seat:=false;if p_child is null then raise exception 'child required' using errcode='22023';end if;end if;
   perform 1 from public.registrations r where r.id=p_registration and r.event_id=p_event and r.deleted_at is null and r.status in ('submitted','confirmed') for update;
   if not found or not exists(select 1 from public.participant_group_assignments where registration_id=p_registration and group_id=a.group_id and is_current and status='confirmed') or not exists(select 1 from public.groups where id=a.group_id and is_active) then return jsonb_build_object('status','ineligible');end if;
   select * into m from public.event_moments where id=p.moment_id;
   if (p_child is not null and not exists(select 1 from public.registration_children where id=p_child and registration_id=p_registration)) then return jsonb_build_object('status','ineligible');end if;
   if exists(select 1 from public.ceremony_nominees where plan_id=p.id and subject_id=coalesce(p_child,p_registration) and revoked_at is null and id is distinct from n.id) then return jsonb_build_object('status','duplicate');end if;
   if need_seat and (select count(*) from public.ceremony_nominees where allocation_id=a.id and revoked_at is null and needs_seat and id is distinct from n.id)>=a.quantity then return jsonb_build_object('status','capacity');end if;
 end if;
 if p_action in ('revoke','move') then
   if old_a.registration_id is not null then update public.ceremony_allocations set revoked_at=now() where id=old_a.id;
   else update public.ceremony_nominees set revoked_at=now() where id=n.id;end if;
 end if;
 if p_action in ('assign','move','no_seat') then
   insert into public.ceremony_nominees(plan_id,allocation_id,registration_id,child_id,subject_name,needs_seat) values(p.id,a.id,p_registration,p_child,'',need_seat);
 end if;
 update public.ceremony_plans set revision=revision+1 where id=p.id;
 insert into public.ceremony_distribution_requests values(p_request,p_actor,p_event,fp);
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(p_event,p_actor,'ceremony.nominee_'||p_action,'ceremony_allocations',a.id,jsonb_build_object('source_allocation_id',old_a.id,'request_id',p_request));
 return jsonb_build_object('status','saved');
end $$;

create or replace function app.ceremony_nominee_needs_review(p_nominee uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select r.deleted_at is not null or r.status not in ('submitted','confirmed') or
  (n.child_id is not null and not exists(select 1 from public.registration_children c where c.id=n.child_id and c.registration_id=r.id)) or
  (a.group_id is not null and (not exists(select 1 from public.groups g where g.id=a.group_id and g.is_active) or not exists(select 1 from public.participant_group_assignments ga where ga.registration_id=r.id and ga.group_id=a.group_id and ga.is_current and ga.status='confirmed'))) or
  (a.group_id is null and a.group_snapshot is distinct from array(select group_id from public.participant_group_assignments where registration_id=r.id and is_current order by group_id))
 from public.ceremony_nominees n join public.ceremony_allocations a on a.id=n.allocation_id join public.ceremony_plans p on p.id=n.plan_id join public.event_moments m on m.id=p.moment_id join public.registrations r on r.id=n.registration_id where n.id=p_nominee
$$;

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
    'eligiblePlanIds',array(select p.id from public.ceremony_plans p join public.event_moments m on m.id=p.moment_id where p.event_id=p_event),
    'assigned',coalesce((select jsonb_agg(jsonb_build_object('planId',n.plan_id,'childId',n.child_id,'needsSeat',n.needs_seat)) from public.ceremony_nominees n join public.ceremony_plans p on p.id=n.plan_id where n.registration_id=r.id and n.revoked_at is null and p.event_id=p_event),'[]')) order by pe.last_name,pe.first_name,r.id)
   from public.registrations r join public.participants pe on pe.id=r.participant_id where r.event_id=p_event and r.deleted_at is null and r.status in ('submitted','confirmed') and (manager or exists(select 1 from public.participant_group_assignments ga where ga.registration_id=r.id and ga.is_current and ga.status='confirmed' and ga.group_id=any(scope)))),'[]')) into result;
 return result;
end $$;

-- Operational snapshot: no global participant directory or historical map payload.
create function public.get_ceremony_seats_desk(p_event uuid,p_actor uuid,p_kind text) returns jsonb
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
 'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'sectorId',q.sector_id,'groupId',a.group_id,'groupName',g.name,'quantity',a.quantity)) from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id left join public.groups g on g.id=a.group_id where a.plan_id=p.id and a.revoked_at is null),'[]'),
 'nominees',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'allocationId',n.allocation_id,'registrationId',n.registration_id,'childId',n.child_id,'needsSeat',n.needs_seat,'name',n.subject_name,'review',app.ceremony_nominee_needs_review(n.id))) from public.ceremony_nominees n where n.plan_id=p.id and n.revoked_at is null),'[]'),
 'claims',coalesce((select jsonb_agg(jsonb_build_object('seatId',seat_id,'allocationId',allocation_id,'nomineeId',nominee_id)) from public.ceremony_seat_claims where plan_id=p.id and released_at is null),'[]')) into result
 from public.event_moments m join public.event_locations l on l.id=m.location_id where m.id=p.moment_id;
 return result;
end $$;

-- One transaction covers every family member / delegation chair, including replay.
create function public.assign_ceremony_seats(p_event uuid,p_actor uuid,p_plan uuid,p_revision integer,p_request uuid,p_data jsonb)
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
  if jsonb_typeof(p_data->'subjects') is distinct from 'array' or jsonb_array_length(p_data->'subjects')<>qty then raise exception 'invalid' using errcode='22023';end if;
  if (select count(distinct coalesce(x->>'childId',x->>'registrationId')) from jsonb_array_elements(p_data->'subjects') x)<>qty then raise exception 'invalid' using errcode='22023';end if;
  -- Lock registrations in a deterministic order before inserting any family member.
  perform 1 from public.registrations where id in (select (x->>'registrationId')::uuid from jsonb_array_elements(p_data->'subjects') x) order by id for update;
  i:=0;
  for item in select value from jsonb_array_elements(p_data->'subjects') loop
   i:=i+1;rid:=(item->>'registrationId')::uuid;child:=(item->>'childId')::uuid;sid:=ids[i];aid:=null;nid:=null;
   if not exists(select 1 from public.registrations where id=rid and event_id=p_event and deleted_at is null and status in ('submitted','confirmed')) or (child is not null and not exists(select 1 from public.registration_children where id=child and registration_id=rid)) then raise exception 'ineligible' using errcode='P1390';end if;
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
     select ca.id into aid from public.ceremony_allocations ca where ca.quota_id=q.id and ca.revoked_at is null and ca.group_id is not null and exists(select 1 from public.participant_group_assignments ga where ga.registration_id=rid and ga.group_id=ca.group_id and ga.is_current and ga.status='confirmed') and ca.quantity>(select count(*) from public.ceremony_nominees cn where cn.allocation_id=ca.id and cn.revoked_at is null and cn.needs_seat) order by ca.created_at,ca.id limit 1;
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
revoke all on function public.get_ceremony_seats_desk(uuid,uuid,text),public.assign_ceremony_seats(uuid,uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.get_ceremony_seats_desk(uuid,uuid,text),public.assign_ceremony_seats(uuid,uuid,uuid,integer,uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
