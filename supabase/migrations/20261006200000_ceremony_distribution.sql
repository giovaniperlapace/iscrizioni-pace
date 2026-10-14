-- P13-E2: a single nominal ledger for direct and group allocations.
-- Child seats are decided case by case, including explicit no-seat choices.
-- No inherited or automatic child seats.
begin;
create table public.ceremony_nominees (
 id uuid primary key default extensions.gen_random_uuid(),
 plan_id uuid not null references public.ceremony_plans(id),
 allocation_id uuid not null references public.ceremony_allocations(id),
 registration_id uuid not null references public.registrations(id),
 -- Retain the historical child identity if a family editor replaces/deletes it.
 -- A missing child is flagged for review, never converted to an adult seat.
 child_id uuid,
 needs_seat boolean not null default true check(needs_seat or child_id is not null),
 subject_id uuid generated always as (coalesce(child_id,registration_id)) stored,
 subject_name text not null,
 created_at timestamptz not null default now(),
 revoked_at timestamptz
);
create unique index ceremony_nominee_once on public.ceremony_nominees(plan_id,subject_id) where revoked_at is null;
create index ceremony_nominees_allocation on public.ceremony_nominees(allocation_id) where revoked_at is null;
create table public.ceremony_distribution_requests (
 request_id uuid primary key, actor_id uuid not null references auth.users(id),
 event_id uuid not null references public.events(id), fingerprint text not null
);
alter table public.ceremony_nominees enable row level security;
alter table public.ceremony_distribution_requests enable row level security;
revoke all on public.ceremony_nominees,public.ceremony_distribution_requests from anon,authenticated;
grant all on public.ceremony_nominees,public.ceremony_distribution_requests to service_role;

create function app.ceremony_leader_scope(p_event uuid,p_actor uuid) returns setof uuid
language sql stable security invoker set search_path='' as $$
 with recursive scope as (
 select g.id from public.groups g join public.group_memberships m on m.group_id=g.id
 where g.event_id=p_event and g.is_active and m.user_id=p_actor and m.role='capogruppo'
 union
 select g.id from public.groups g join scope s on s.id=g.parent_group_id
 where g.event_id=p_event and g.is_active
 ) select id from scope
$$;

-- The same lock as E1 protects both paths, including direct manager assignments.
create function app.synchronize_ceremony_direct() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.group_id is not null and (new.revoked_at is not null or new.quantity<old.quantity) and
   (select count(*) from public.ceremony_nominees where allocation_id=new.id and revoked_at is null and (new.revoked_at is not null or needs_seat))>(case when new.revoked_at is not null then 0 else new.quantity end) then
   raise exception 'Revoke or move nominations first' using errcode='P1302';
 end if;
 if new.registration_id is not null then
   if new.revoked_at is null then
     insert into public.ceremony_nominees(plan_id,allocation_id,registration_id,subject_name)
      select new.plan_id,new.id,new.registration_id,'' where not exists(select 1 from public.ceremony_nominees where allocation_id=new.id and revoked_at is null);
   else
     update public.ceremony_nominees set revoked_at=coalesce(revoked_at,new.revoked_at) where allocation_id=new.id and revoked_at is null;
   end if;
 end if;
 return new;
end $$;
-- Guard must allow revocation of a direct ledger row after its parent is revoked.
create function app.guard_ceremony_nominee() returns trigger
language plpgsql security invoker set search_path='' as $$
declare a public.ceremony_allocations; e uuid; subject_label text;
begin
 select event_id into e from public.ceremony_plans where id=new.plan_id;
 perform pg_advisory_xact_lock(hashtextextended(e::text,1381));
 select * into a from public.ceremony_allocations where id=new.allocation_id;
 if a.id is null or a.plan_id<>new.plan_id or (a.revoked_at is not null and new.revoked_at is null) then raise exception 'invalid allocation' using errcode='23514';end if;
 if tg_op='UPDATE' and (new.plan_id,new.allocation_id,new.registration_id,new.child_id) is distinct from (old.plan_id,old.allocation_id,old.registration_id,old.child_id) then raise exception 'immutable nomination' using errcode='23514';end if;
 if new.revoked_at is null then
   if a.registration_id is not null and (a.registration_id<>new.registration_id or new.child_id is not null) then raise exception 'invalid direct subject' using errcode='23514';end if;
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
create trigger ceremony_nominee_guard before insert or update on public.ceremony_nominees for each row execute function app.guard_ceremony_nominee();
create trigger ceremony_direct_ledger after insert or update on public.ceremony_allocations for each row execute function app.synchronize_ceremony_direct();
insert into public.ceremony_nominees(plan_id,allocation_id,registration_id,subject_name)
 select plan_id,id,registration_id,'' from public.ceremony_allocations where registration_id is not null and revoked_at is null;

create function app.ceremony_nominee_needs_review(p_nominee uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select r.deleted_at is not null or r.status not in ('submitted','confirmed') or
  app.ceremony_eligibility(r.id,(m.starts_at at time zone 'Europe/Rome')::date,p.attendance_part)<>'eligible' or
  (n.child_id is not null and not exists(select 1 from public.registration_children c where c.id=n.child_id and c.registration_id=r.id)) or
  (a.group_id is not null and (not exists(select 1 from public.groups g where g.id=a.group_id and g.is_active) or not exists(select 1 from public.participant_group_assignments ga where ga.registration_id=r.id and ga.group_id=a.group_id and ga.is_current and ga.status='confirmed'))) or
  (a.group_id is null and a.group_snapshot is distinct from array(select group_id from public.participant_group_assignments where registration_id=r.id and is_current order by group_id))
 from public.ceremony_nominees n join public.ceremony_allocations a on a.id=n.allocation_id join public.ceremony_plans p on p.id=n.plan_id join public.event_moments m on m.id=p.moment_id join public.registrations r on r.id=n.registration_id where n.id=p_nominee
$$;

create function public.set_ceremony_nominee(p_event uuid,p_actor uuid,p_action text,p_allocation uuid,p_registration uuid,p_child uuid,p_nominee uuid,p_revision integer,p_request uuid)
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
   if app.ceremony_eligibility(p_registration,(m.starts_at at time zone 'Europe/Rome')::date,p.attendance_part)<>'eligible' or (p_child is not null and not exists(select 1 from public.registration_children where id=p_child and registration_id=p_registration)) then return jsonb_build_object('status','ineligible');end if;
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

create function public.get_ceremony_distribution(p_event uuid,p_actor uuid,p_mode text default 'leader') returns jsonb
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
    'eligiblePlanIds',array(select p.id from public.ceremony_plans p join public.event_moments m on m.id=p.moment_id where p.event_id=p_event and app.ceremony_eligibility(r.id,(m.starts_at at time zone 'Europe/Rome')::date,p.attendance_part)='eligible'),
    'assigned',coalesce((select jsonb_agg(jsonb_build_object('planId',n.plan_id,'childId',n.child_id,'needsSeat',n.needs_seat)) from public.ceremony_nominees n join public.ceremony_plans p on p.id=n.plan_id where n.registration_id=r.id and n.revoked_at is null and p.event_id=p_event),'[]')) order by pe.last_name,pe.first_name,r.id)
   from public.registrations r join public.participants pe on pe.id=r.participant_id where r.event_id=p_event and r.deleted_at is null and r.status in ('submitted','confirmed') and (manager or exists(select 1 from public.participant_group_assignments ga where ga.registration_id=r.id and ga.is_current and ga.status='confirmed' and ga.group_id=any(scope)))),'[]')) into result;
 return result;
end $$;

create function public.get_my_ceremony_seats(p_event uuid,p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.events where id=p_event and is_current) or p_actor is null then raise exception 'forbidden' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'kind',p.kind,'name',n.subject_name,'child',n.child_id is not null,'needsSeat',n.needs_seat,'location',l.name,'startsAt',m.starts_at,'sector',s.name,'category',q.category,'review',app.ceremony_nominee_needs_review(n.id)) order by m.starts_at,n.child_id nulls first,n.subject_name)
 from public.ceremony_nominees n join public.ceremony_allocations a on a.id=n.allocation_id join public.ceremony_plans p on p.id=n.plan_id join public.event_moments m on m.id=p.moment_id join public.event_locations l on l.id=m.location_id join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id join public.registrations r on r.id=n.registration_id join public.participants pe on pe.id=r.participant_id
 where p.event_id=p_event and pe.auth_user_id=p_actor and r.deleted_at is null and n.revoked_at is null and a.revoked_at is null),'[]');
end $$;
revoke all on function app.ceremony_leader_scope(uuid,uuid),app.ceremony_nominee_needs_review(uuid) from public,anon,authenticated;
grant execute on function app.ceremony_leader_scope(uuid,uuid),app.ceremony_nominee_needs_review(uuid) to service_role;
revoke all on function public.set_ceremony_nominee(uuid,uuid,text,uuid,uuid,uuid,uuid,integer,uuid),public.get_ceremony_distribution(uuid,uuid,text),public.get_my_ceremony_seats(uuid,uuid) from public,anon,authenticated;
grant execute on function public.set_ceremony_nominee(uuid,uuid,text,uuid,uuid,uuid,uuid,integer,uuid),public.get_ceremony_distribution(uuid,uuid,text),public.get_my_ceremony_seats(uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
