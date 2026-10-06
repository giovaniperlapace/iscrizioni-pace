-- P13-E1: independent quantitative layouts for opening and closing ceremonies.
-- Local migration. No inferred categories, dates, capacities or admissions.
begin;
create table public.ceremony_plans (
 id uuid primary key default extensions.gen_random_uuid(),
 event_id uuid not null references public.events(id),
 kind text not null check(kind in ('opening','closing')),
 moment_id uuid not null unique references public.event_moments(id),
 state text not null default 'draft' check(state in ('draft','validated')),
 attendance_part text not null default 'day' check(attendance_part in ('day','morning','afternoon')),
 revision integer not null default 0 check(revision>=0),
 unique(event_id,kind)
);
create table public.ceremony_sectors (
 id uuid primary key, plan_id uuid not null references public.ceremony_plans(id),
 name text not null check(length(btrim(name)) between 1 and 100),
 capacity integer check(capacity between 0 and 1000000),
 unique(plan_id,id), unique(plan_id,name)
);
create table public.ceremony_quotas (
 id uuid primary key, plan_id uuid not null references public.ceremony_plans(id),
 sector_id uuid not null, category text not null check(length(btrim(category)) between 1 and 80),
 quantity integer not null check(quantity between 0 and 1000000),
 foreign key(plan_id,sector_id) references public.ceremony_sectors(plan_id,id),
 unique(plan_id,id), unique(sector_id,category)
);
create table public.ceremony_allocations (
 id uuid primary key, plan_id uuid not null references public.ceremony_plans(id),
 quota_id uuid not null, group_id uuid references public.groups(id),
 registration_id uuid references public.registrations(id),
 quantity integer not null check(quantity between 1 and 1000000),
 group_snapshot uuid[] not null default '{}',
 revoked_at timestamptz, created_at timestamptz not null default now(),
 foreign key(plan_id,quota_id) references public.ceremony_quotas(plan_id,id),
 check(num_nonnulls(group_id,registration_id)=1),
 check(registration_id is null or quantity=1)
);
create unique index ceremony_person_once on public.ceremony_allocations(plan_id,registration_id) where revoked_at is null;
create unique index ceremony_group_quota_once on public.ceremony_allocations(quota_id,group_id) where revoked_at is null;
create index ceremony_allocations_plan on public.ceremony_allocations(plan_id);
create index ceremony_quotas_plan on public.ceremony_quotas(plan_id);
-- No direct client reads/writes. Minimized snapshots and commands go through RPC.
alter table public.ceremony_plans enable row level security;
alter table public.ceremony_sectors enable row level security;
alter table public.ceremony_quotas enable row level security;
alter table public.ceremony_allocations enable row level security;
revoke all on public.ceremony_plans,public.ceremony_sectors,public.ceremony_quotas,public.ceremony_allocations from anon,authenticated;
grant all on public.ceremony_plans,public.ceremony_sectors,public.ceremony_quotas,public.ceremony_allocations to service_role;

create function app.ceremony_authorize(p_event uuid,p_actor uuid,p_write boolean default false)
returns boolean language plpgsql security invoker set search_path='' as $$
declare is_admin boolean;
begin
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise exception 'forbidden' using errcode='42501';end if;
 perform 1 from public.event_user_roles where user_id=p_actor and ((role='admin' and event_id is null) or (event_id=p_event and (role='manager' or (not p_write and role='manager_viewer')))) for share;
 select exists(select 1 from public.event_user_roles where user_id=p_actor and role='admin' and event_id is null) into is_admin;
 if not is_admin and not exists(select 1 from public.event_user_roles where user_id=p_actor and event_id=p_event and (role='manager' or (not p_write and role='manager_viewer'))) then raise exception 'forbidden' using errcode='42501';end if;
 return is_admin;
end $$;

-- Called for active registrations only. Missing/unknown dates never imply absence.
create function app.ceremony_eligibility(p_registration uuid,p_day date,p_part text)
returns text language sql stable security invoker set search_path='' as $$
 select case when p_day is null then 'unknown'
 when exists(select 1 from public.event_attendance_choices where registration_id=p_registration and choice='unknown') then 'unknown'
 when not exists(select 1 from public.event_attendance_choices where registration_id=p_registration) then 'unknown'
 when exists(select 1 from public.event_attendance_choices where registration_id=p_registration and day=p_day and choice='yes' and (p_part='day' or day_part=p_part or day_part is null)) then 'eligible'
 else 'absent' end
$$;

-- Prevent legacy location/moment editors (including service-backed ones) from
-- bypassing the ceremony's admin-only, revisioned configuration commands.
create function app.protect_ceremony_configuration() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('app.ceremony_write',true),'')<>'on' and
 ((tg_table_name='event_moments' and exists(select 1 from public.ceremony_plans where moment_id=old.id)) or
  (tg_table_name='event_locations' and exists(select 1 from public.ceremony_plans p join public.event_moments m on m.id=p.moment_id where m.location_id=old.id))) then
 raise exception 'Use ceremony configuration' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger ceremony_moment_protection before update or delete on public.event_moments for each row execute function app.protect_ceremony_configuration();
create trigger ceremony_location_protection before update or delete on public.event_locations for each row execute function app.protect_ceremony_configuration();

create function public.save_ceremony(p_event uuid,p_actor uuid,p_kind text,p_revision integer,p_operation text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 admin boolean; plan public.ceremony_plans%rowtype; moment public.event_moments%rowtype;
 sector public.ceremony_sectors%rowtype; quota public.ceremony_quotas%rowtype;
 allocation public.ceremony_allocations%rowtype; rid uuid; gid uuid; ident uuid;
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
   rid:=nullif(p_data->>'registrationId','')::uuid;gid:=nullif(p_data->>'groupId','')::uuid;
   if ident is null or qty is null or qty not between 1 and 1000000 or num_nonnulls(rid,gid)<>1 or (rid is not null and qty<>1) then raise exception 'invalid' using errcode='22023';end if;
   if plan.state<>'validated' then return jsonb_build_object('status','unconfigured');end if;
   select * into quota from public.ceremony_quotas where id=(p_data->>'quotaId')::uuid and plan_id=plan.id;
   if quota.id is null then raise exception 'invalid' using errcode='22023';end if;
   if rid is not null then
     -- Match the registration lock used by attendance editors/deletion.
     perform 1 from public.registrations where id=rid and event_id=p_event and deleted_at is null and status in ('submitted','confirmed') for update;
     if not found then return jsonb_build_object('status','ineligible');end if;
     if app.ceremony_eligibility(rid,(moment.starts_at at time zone 'Europe/Rome')::date,plan.attendance_part)<>'eligible' then return jsonb_build_object('status','ineligible');end if;
     if exists(select 1 from public.ceremony_allocations where plan_id=plan.id and registration_id=rid and revoked_at is null) then return jsonb_build_object('status','duplicate');end if;
   else
     perform 1 from public.groups where id=gid and event_id=p_event and is_active for share;
     if not found then return jsonb_build_object('status','ineligible');end if;
     if exists(select 1 from public.ceremony_allocations where quota_id=quota.id and group_id=gid and revoked_at is null) then return jsonb_build_object('status','duplicate');end if;
   end if;
   if qty+coalesce((select sum(quantity) from public.ceremony_allocations where quota_id=quota.id and revoked_at is null),0)>quota.quantity then return jsonb_build_object('status','capacity');end if;
   insert into public.ceremony_allocations(id,plan_id,quota_id,registration_id,group_id,quantity,group_snapshot) values(ident,plan.id,quota.id,rid,gid,qty,array(select group_id from public.participant_group_assignments where registration_id=rid and is_current order by group_id));
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

create function public.get_ceremony(p_event uuid,p_actor uuid,p_kind text)
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
 'plan',jsonb_build_object('id',plan.id,'revision',plan.revision,'state',plan.state,'attendancePart',plan.attendance_part,'location',(select name from public.event_locations where id=moment.location_id),'capacity',moment.capacity,'startsAt',to_char(moment.starts_at at time zone 'Europe/Rome','YYYY-MM-DD"T"HH24:MI'),'endsAt',to_char(moment.ends_at at time zone 'Europe/Rome','YYYY-MM-DD"T"HH24:MI')),
 'sectors',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'capacity',s.capacity) order by s.name,s.id) from public.ceremony_sectors s where s.plan_id=plan.id),'[]'),
 'quotas',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'sectorId',q.sector_id,'category',q.category,'quantity',q.quantity) order by q.category,q.id) from public.ceremony_quotas q where q.plan_id=plan.id),'[]'),
 'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'quotaId',a.quota_id,'groupId',a.group_id,'registrationId',a.registration_id,'quantity',a.quantity,'review',case when a.group_id is not null then not coalesce(g.is_active,false) else r.deleted_at is not null or r.status not in ('submitted','confirmed') or app.ceremony_eligibility(r.id,day,plan.attendance_part)<>'eligible' or a.group_snapshot is distinct from array(select ga.group_id from public.participant_group_assignments ga where ga.registration_id=r.id and ga.is_current order by ga.group_id) end,'name',coalesce(g.name,p.first_name||' '||p.last_name)) order by a.created_at,a.id) from public.ceremony_allocations a left join public.groups g on g.id=a.group_id left join public.registrations r on r.id=a.registration_id left join public.participants p on p.id=r.participant_id where a.plan_id=plan.id and a.revoked_at is null),'[]'),
 'people',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',p.first_name||' '||p.last_name,'code',p.public_code,'children',coalesce((select jsonb_agg(jsonb_build_object('id',ch.id,'name',ch.first_name||' '||ch.last_name) order by ch.position,ch.id) from public.registration_children ch where ch.registration_id=r.id),'[]'),'eligibility',app.ceremony_eligibility(r.id,day,plan.attendance_part)) order by p.last_name,p.first_name,r.id) from public.registrations r join public.participants p on p.id=r.participant_id where r.event_id=p_event and r.deleted_at is null and r.status in ('submitted','confirmed')),'[]'),
 'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'eligible', (select count(*) from public.participant_group_assignments ga join public.registrations r on r.id=ga.registration_id where ga.group_id=g.id and ga.is_current and r.event_id=p_event and r.deleted_at is null and r.status in ('submitted','confirmed') and app.ceremony_eligibility(r.id,day,plan.attendance_part)='eligible')) order by g.name,g.id) from public.groups g where g.event_id=p_event and g.is_active),'[]')) into result;
 return result;
end $$;
revoke all on function app.ceremony_authorize(uuid,uuid,boolean),app.ceremony_eligibility(uuid,date,text) from public,anon,authenticated;
grant execute on function app.ceremony_authorize(uuid,uuid,boolean),app.ceremony_eligibility(uuid,date,text) to service_role;
revoke all on function public.get_ceremony(uuid,uuid,text), public.save_ceremony(uuid,uuid,text,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.get_ceremony(uuid,uuid,text), public.save_ceremony(uuid,uuid,text,integer,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
