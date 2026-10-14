-- P13-E3. Immutable published layouts, stable seat identities, shared E1/E2 locks.
begin;
create table public.ceremony_map_versions (
 id uuid primary key, plan_id uuid not null references public.ceremony_plans(id),
 version integer not null check(version>0), title text not null check(length(btrim(title)) between 1 and 100),
 state text not null check(state in ('draft','published','archived')),
 seats jsonb not null check(jsonb_typeof(seats)='array' and jsonb_array_length(seats)<=10000),
 created_at timestamptz not null default now(), published_at timestamptz,
 unique(plan_id,version)
);
create unique index ceremony_one_published_map on public.ceremony_map_versions(plan_id) where state='published';
create unique index ceremony_one_draft_map on public.ceremony_map_versions(plan_id) where state='draft';
create table public.ceremony_seat_identities (
 id uuid primary key, plan_id uuid not null references public.ceremony_plans(id),
 sector_id uuid not null,
 foreign key(plan_id,sector_id) references public.ceremony_sectors(plan_id,id),
 unique(plan_id,id)
);
create table public.ceremony_seat_claims (
 id uuid primary key default extensions.gen_random_uuid(),
 plan_id uuid not null references public.ceremony_plans(id), seat_id uuid not null,
 allocation_id uuid not null references public.ceremony_allocations(id),
 nominee_id uuid references public.ceremony_nominees(id),
 created_at timestamptz not null default now(), released_at timestamptz,
 foreign key(plan_id,seat_id) references public.ceremony_seat_identities(plan_id,id)
);
create unique index ceremony_seat_once on public.ceremony_seat_claims(seat_id) where released_at is null;
create unique index ceremony_named_seat_once on public.ceremony_seat_claims(nominee_id) where released_at is null and nominee_id is not null;
create table public.ceremony_map_requests (
 request_id uuid primary key, actor_id uuid not null references auth.users(id),
 event_id uuid not null references public.events(id), fingerprint text not null
);
alter table public.ceremony_map_versions enable row level security;
alter table public.ceremony_seat_identities enable row level security;
alter table public.ceremony_seat_claims enable row level security;
alter table public.ceremony_map_requests enable row level security;
revoke all on public.ceremony_map_versions,public.ceremony_seat_identities,public.ceremony_seat_claims,public.ceremony_map_requests from anon,authenticated;
grant all on public.ceremony_map_versions,public.ceremony_seat_identities,public.ceremony_seat_claims,public.ceremony_map_requests to service_role;

-- Existing commands cannot silently invalidate a map or throw away a seat.
create function app.guard_ceremony_seat_dependencies() returns trigger
language plpgsql security invoker set search_path='' as $$
declare pid uuid; e uuid; used bigint;
begin
 pid:=old.plan_id;
 select event_id into e from public.ceremony_plans where id=pid;
 perform pg_advisory_xact_lock(hashtextextended(e::text,1381));
 if tg_table_name='ceremony_allocations' then
   select count(*) into used from public.ceremony_seat_claims where allocation_id=old.id and released_at is null;
   if used>0 and (tg_op='DELETE' or new.revoked_at is not null or new.quantity<used or new.quota_id<>old.quota_id) then raise exception 'Release numbered seats first' using errcode='P1303';end if;
 elsif tg_table_name='ceremony_nominees' then
   if exists(select 1 from public.ceremony_seat_claims where nominee_id=old.id and released_at is null) and (tg_op='DELETE' or new.revoked_at is not null or not new.needs_seat) then raise exception 'Unassign numbered seat first' using errcode='P1303';end if;
 elsif tg_table_name='ceremony_sectors' then
   select count(*) into used from public.ceremony_map_versions v cross join lateral jsonb_array_elements(v.seats) s where v.plan_id=pid and v.state='published' and (s->>'sectorId')::uuid=old.id and not (s->>'blocked')::boolean;
   if used>0 and (tg_op='DELETE' or new.capacity is null or new.capacity<used) then raise exception 'Published map exceeds capacity' using errcode='P1304';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger ceremony_allocations_seats before update or delete on public.ceremony_allocations for each row execute function app.guard_ceremony_seat_dependencies();
create trigger ceremony_nominees_seats before update or delete on public.ceremony_nominees for each row execute function app.guard_ceremony_seat_dependencies();
create trigger ceremony_sectors_seats before update or delete on public.ceremony_sectors for each row execute function app.guard_ceremony_seat_dependencies();
create function app.guard_ceremony_map_quota() returns trigger language plpgsql security invoker set search_path='' as $$
declare usable bigint;e uuid;
begin
 select event_id into e from public.ceremony_plans where id=new.plan_id;
 perform pg_advisory_xact_lock(hashtextextended(e::text,1381));
 if exists(select 1 from public.ceremony_map_versions where plan_id=new.plan_id and state='published') then
  select count(*) into usable from public.ceremony_map_versions v cross join lateral jsonb_array_elements(v.seats) s where v.plan_id=new.plan_id and v.state='published' and (s->>'sectorId')::uuid=new.sector_id and not (s->>'blocked')::boolean;
  if new.quantity+coalesce((select sum(quantity) from public.ceremony_quotas where sector_id=new.sector_id and id<>new.id),0)>usable then raise exception 'Quota exceeds mapped capacity' using errcode='P1304';end if;
 end if;return new;
end $$;
create trigger ceremony_quota_mapped_capacity before insert or update on public.ceremony_quotas for each row execute function app.guard_ceremony_map_quota();

create function app.guard_ceremony_map_version() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.state<>'draft' and (tg_op='DELETE' or new.seats is distinct from old.seats or new.title<>old.title or new.plan_id<>old.plan_id or new.version<>old.version or new.state<>'archived') then raise exception 'Published versions are immutable' using errcode='23514';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger ceremony_map_immutable before update or delete on public.ceremony_map_versions for each row execute function app.guard_ceremony_map_version();
create function app.guard_ceremony_seat_claim() returns trigger language plpgsql security invoker set search_path='' as $$
declare a public.ceremony_allocations;n public.ceremony_nominees;e uuid;s jsonb;
begin
 select event_id into e from public.ceremony_plans where id=new.plan_id;
 perform pg_advisory_xact_lock(hashtextextended(e::text,1381));
 if tg_op='UPDATE' and (new.plan_id,new.seat_id,new.allocation_id) is distinct from (old.plan_id,old.seat_id,old.allocation_id) then raise exception 'Immutable claim' using errcode='23514';end if;
 if new.released_at is not null then return new;end if;
 select * into a from public.ceremony_allocations where id=new.allocation_id and plan_id=new.plan_id and revoked_at is null;
 select x into s from public.ceremony_map_versions v cross join lateral jsonb_array_elements(v.seats) x where v.plan_id=new.plan_id and v.state='published' and (x->>'id')::uuid=new.seat_id;
 if a.id is null or s is null or (s->>'blocked')::boolean or (s->>'sectorId')::uuid<>(select sector_id from public.ceremony_quotas where id=a.quota_id) then raise exception 'Invalid seat allocation' using errcode='23514';end if;
 if (select count(*) from public.ceremony_seat_claims where allocation_id=a.id and released_at is null and id<>new.id)>=a.quantity then raise exception 'Seat budget exceeded' using errcode='23514';end if;
 if new.nominee_id is not null then
  select * into n from public.ceremony_nominees where id=new.nominee_id and allocation_id=a.id and revoked_at is null and needs_seat;
  if n.id is null then raise exception 'Invalid nominee' using errcode='23514';end if;
 end if;return new;
end $$;
create trigger ceremony_seat_claim_guard before insert or update on public.ceremony_seat_claims for each row execute function app.guard_ceremony_seat_claim();

create function public.set_ceremony_map(p_event uuid,p_actor uuid,p_plan uuid,p_revision integer,p_request uuid,p_operation text,p_data jsonb)
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
   if ident is null or ident=any(ids) or not exists(select 1 from public.ceremony_sectors where id=(seat->>'sectorId')::uuid and plan_id=p.id) or
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
  if exists(select 1 from public.ceremony_sectors s where s.plan_id=p.id and (s.capacity is null or
    (select count(*) from jsonb_array_elements(v.seats) x where (x->>'sectorId')::uuid=s.id and not (x->>'blocked')::boolean)>s.capacity or
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

create function public.get_ceremony_map(p_event uuid,p_actor uuid,p_plan uuid,p_mode text default 'manager') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d jsonb;p public.ceremony_plans;admin boolean:=false;ids uuid[];
begin
 -- Reuse E2's complete authorized snapshot and lock; never accept client scope.
 d:=public.get_ceremony_distribution(p_event,p_actor,p_mode);
 select * into p from public.ceremony_plans where id=p_plan and event_id=p_event;
 select coalesce(array_agg((a->>'id')::uuid),'{}') into ids from jsonb_array_elements(d->'allocations') a where (a->>'planId')::uuid=p_plan;
 if p.id is null or (p_mode='leader' and cardinality(ids)=0) then raise exception 'forbidden' using errcode='42501';end if;
 if p_mode='manager' then select exists(select 1 from public.event_user_roles where user_id=p_actor and role='admin' and event_id is null) into admin;end if;
 return jsonb_build_object('planId',p.id,'revision',p.revision,'kind',p.kind,'state',p.state,
  'active',(select jsonb_build_object('id',id,'version',version,'title',title,'seats',seats) from public.ceremony_map_versions where plan_id=p.id and state='published'),
  'draft',case when admin then (select jsonb_build_object('id',id,'version',version,'title',title,'seats',seats) from public.ceremony_map_versions where plan_id=p.id and state='draft') end,
  'history',case when admin then coalesce((select jsonb_agg(jsonb_build_object('id',id,'version',version,'title',title,'seats',seats) order by version desc) from public.ceremony_map_versions where plan_id=p.id and state='archived'),'[]') else '[]'::jsonb end,
  'sectors',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'capacity',capacity) order by name,id) from public.ceremony_sectors where plan_id=p.id),'[]'),
  'allocations',coalesce((select jsonb_agg(a||jsonb_build_object('sectorId',q.sector_id)) from jsonb_array_elements(d->'allocations') a join public.ceremony_allocations ca on ca.id=(a->>'id')::uuid join public.ceremony_quotas q on q.id=ca.quota_id where ca.id=any(ids)),'[]'),
  'nominees',coalesce((select jsonb_agg(n) from jsonb_array_elements(d->'nominees') n where (n->>'allocationId')::uuid=any(ids)),'[]'),
  'claims',coalesce((select jsonb_agg(jsonb_build_object('seatId',seat_id,'allocationId',case when allocation_id=any(ids) then allocation_id end,'nomineeId',case when allocation_id=any(ids) then nominee_id end)) from public.ceremony_seat_claims where plan_id=p.id and released_at is null),'[]'));
end $$;

-- Common seat projection for personal consultation, printable lists and future
-- badge/admission adapters. This never grants an admission or creates a check-in.
create function app.ceremony_numbered_seat(p_nominee uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',s->>'id','row',s->>'row','number',s->>'number','mapVersion',v.version)
 from public.ceremony_seat_claims c join public.ceremony_map_versions v on v.plan_id=c.plan_id and v.state='published'
 cross join lateral jsonb_array_elements(v.seats) s where c.nominee_id=p_nominee and c.released_at is null and (s->>'id')::uuid=c.seat_id
$$;
alter function public.get_my_ceremony_seats(uuid,uuid) rename to ceremony_personal_seats_e2;
create function public.get_my_ceremony_seats(p_event uuid,p_actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select coalesce(jsonb_agg(s||jsonb_build_object('seat',app.ceremony_numbered_seat((s->>'id')::uuid),'mapAvailable',exists(select 1 from public.ceremony_map_versions v join public.ceremony_nominees n on n.plan_id=v.plan_id where n.id=(s->>'id')::uuid and v.state='published'))),'[]') into result
 from jsonb_array_elements(public.ceremony_personal_seats_e2(p_event,p_actor)) s;
 return result;
end $$;
revoke all on function public.set_ceremony_map(uuid,uuid,uuid,integer,uuid,text,jsonb),public.get_ceremony_map(uuid,uuid,uuid,text),public.get_my_ceremony_seats(uuid,uuid),app.ceremony_numbered_seat(uuid) from public,anon,authenticated;
grant execute on function public.set_ceremony_map(uuid,uuid,uuid,integer,uuid,text,jsonb),public.get_ceremony_map(uuid,uuid,uuid,text),public.get_my_ceremony_seats(uuid,uuid),app.ceremony_numbered_seat(uuid) to service_role;
-- Read-only raccordo: canonical numbered seats accompany an already authorized
-- reception result/badge. They never substitute for a ceremony admission duty.
create function app.ceremony_subject_seats(p_event uuid,p_subject uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('kind',p.kind,'sector',s.name,'needsSeat',n.needs_seat,'review',app.ceremony_nominee_needs_review(n.id),'seat',app.ceremony_numbered_seat(n.id)) order by p.kind),'[]')
 from public.ceremony_nominees n join public.ceremony_allocations a on a.id=n.allocation_id join public.ceremony_plans p on p.id=n.plan_id join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id
 where p.event_id=p_event and n.subject_id=p_subject and n.revoked_at is null and a.revoked_at is null
$$;
create function app.ceremony_reception_projection(p_event uuid,p_result jsonb) returns jsonb language sql stable security invoker set search_path='' as $$
 select case when p_result->>'status'='valid' and p_result->>'kind' in ('family','group') then
 p_result||jsonb_build_object('persons',coalesce((select jsonb_agg(person||jsonb_build_object('ceremonies',app.ceremony_subject_seats(p_event,(person->>'id')::uuid)) order by ord) from jsonb_array_elements(p_result->'persons') with ordinality x(person,ord)),'[]')) else p_result end
$$;
alter function public.reception_event_check_in(text,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text) rename to reception_event_check_in_e3_base;
alter function public.reception_event_check_in_e3_base(text,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text) set schema app;
create function public.reception_event_check_in(p_duty text,p_event_id uuid,p_actor_user_id uuid,p_lookup_kind text,p_lookup text,p_action text default 'inspect',p_request_id uuid default null,p_subject_ids uuid[] default '{}',p_students integer default null,p_companions integer default null,p_expected_revision integer default null,p_reason text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select app.ceremony_reception_projection(p_event_id,app.reception_event_check_in_e3_base(p_duty,p_event_id,p_actor_user_id,p_lookup_kind,p_lookup,p_action,p_request_id,p_subject_ids,p_students,p_companions,p_expected_revision,p_reason))
$$;
alter function public.reception_group_check_in(uuid,uuid,text,text,uuid,uuid[],text) rename to reception_group_check_in_e3_base;
alter function public.reception_group_check_in_e3_base(uuid,uuid,text,text,uuid,uuid[],text) set schema app;
create function public.reception_group_check_in(p_event uuid,p_actor uuid,p_hash text,p_action text default 'inspect',p_request uuid default null,p_subjects uuid[] default '{}',p_snapshot text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select app.ceremony_reception_projection(p_event,app.reception_group_check_in_e3_base(p_event,p_actor,p_hash,p_action,p_request,p_subjects,p_snapshot))
$$;
alter function public.group_badge_queue(uuid,uuid,text,text,uuid,uuid[],text,uuid,integer) rename to group_badge_queue_e3_base;
alter function public.group_badge_queue_e3_base(uuid,uuid,text,text,uuid,uuid[],text,uuid,integer) set schema app;
create function public.group_badge_queue(p_event uuid,p_actor uuid,p_hash text,p_action text,p_batch uuid default null,p_registrations uuid[] default '{}',p_snapshot text default null,p_registration uuid default null,p_expected_attempts integer default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 result:=app.group_badge_queue_e3_base(p_event,p_actor,p_hash,p_action,p_batch,p_registrations,p_snapshot,p_registration,p_expected_attempts);
 if result->>'status'='ready' then
  result:=result||jsonb_build_object('ceremonies',app.ceremony_subject_seats(p_event,p_registration));
 end if;
 return result;
end $$;
revoke all on function app.ceremony_subject_seats(uuid,uuid),app.ceremony_reception_projection(uuid,jsonb),public.reception_event_check_in(text,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text),public.reception_group_check_in(uuid,uuid,text,text,uuid,uuid[],text),public.group_badge_queue(uuid,uuid,text,text,uuid,uuid[],text,uuid,integer) from public,anon,authenticated;
grant execute on function app.ceremony_subject_seats(uuid,uuid),app.ceremony_reception_projection(uuid,jsonb),public.reception_event_check_in(text,uuid,uuid,text,text,text,uuid,uuid[],integer,integer,integer,text),public.reception_group_check_in(uuid,uuid,text,text,uuid,uuid[],text),public.group_badge_queue(uuid,uuid,text,text,uuid,uuid[],text,uuid,integer) to service_role;

notify pgrst,'reload schema';
commit;
