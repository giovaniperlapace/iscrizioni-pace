-- Shared manager drafts are deliberately separate from all public allocations.
-- No existing assignment is changed and no notice is queued by this migration.
begin;
-- Explicit group-member selections allocate personal places without consuming reserves.
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


create table public.ceremony_assignment_drafts (
 id uuid primary key default gen_random_uuid(),
 plan_id uuid not null references public.ceremony_plans(id) on delete cascade,
 sector_id uuid not null references public.ceremony_sectors(id),
 data jsonb not null,
 state text not null default 'draft' check(state in ('draft','removed','published')),
 publication_id uuid,
 created_by uuid not null references auth.users(id),
 updated_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index ceremony_assignment_drafts_active on public.ceremony_assignment_drafts(plan_id,sector_id) where state='draft';
create table public.ceremony_draft_requests (
 request_id uuid primary key, actor_id uuid not null, fingerprint text not null,
 result jsonb not null, created_at timestamptz not null default now()
);
create table public.ceremony_publication_emails (
 id uuid primary key default gen_random_uuid(),
 publication_id uuid not null,
 event_id uuid not null references public.events(id),
 plan_id uuid not null references public.ceremony_plans(id),
 recipient_key text not null,
 user_id uuid references auth.users(id), registration_id uuid references public.registrations(id),
 payload jsonb not null,
 state text not null default 'queued' check(state in ('queued','sending','accepted','failed','uncertain','skipped')),
 claim uuid, recipient text, message_id text, error_code text,
 subject_snapshot text, text_snapshot text, accepted_at timestamptz,
 delivery_state text check(delivery_state in ('delivered','bounced')), delivery_at timestamptz, delivery_checked_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(publication_id,recipient_key), check(num_nonnulls(user_id,registration_id)=1)
);
create index ceremony_publication_emails_report on public.ceremony_publication_emails(plan_id,publication_id,created_at,id);
alter table public.ceremony_assignment_drafts enable row level security;
alter table public.ceremony_draft_requests enable row level security;
alter table public.ceremony_publication_emails enable row level security;
revoke all on public.ceremony_assignment_drafts,public.ceremony_draft_requests,public.ceremony_publication_emails from public,anon,authenticated;
grant select,insert,update on public.ceremony_assignment_drafts,public.ceremony_draft_requests,public.ceremony_publication_emails to service_role;

create function public.manage_ceremony_drafts(p_event uuid,p_actor uuid,p_plan uuid,p_revision integer,p_request uuid,p_operation text,p_draft uuid,p_data jsonb)
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
  select id,quantity into quota,capacity from public.ceremony_quotas where sector_id=s.id;
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

create function public.get_ceremony_draft_desk(p_event uuid,p_actor uuid,p_kind text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; pid uuid;
begin
 perform app.ceremony_authorize(p_event,p_actor,true);
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 result:=public.get_ceremony_seats_desk(p_event,p_actor,p_kind);
 if result is null then return null;end if;
 pid:=(result->>'planId')::uuid;
 result:=result||jsonb_build_object('drafts',coalesce((select jsonb_agg(jsonb_build_object(
  'action',d.data->>'action','id',d.id,'sectorId',d.sector_id,'sector',s.name,'quantity',(d.data->>'quantity')::integer,'groupId',d.data->>'groupId','groupName',g.name,
  'subjects',coalesce((select jsonb_agg(jsonb_build_object('registrationId',x->>'registrationId','childId',x->>'childId','name',case when x->>'childId' is null then pe.first_name||' '||pe.last_name else coalesce(ch.first_name||' '||ch.last_name,'Minore non più disponibile') end) order by ord)
    from jsonb_array_elements(d.data->'subjects') with ordinality sub(x,ord) join public.registrations r on r.id=(x->>'registrationId')::uuid join public.participants pe on pe.id=r.participant_id left join public.registration_children ch on ch.id=(x->>'childId')::uuid),'[]'::jsonb)) order by d.created_at,d.id)
  from public.ceremony_assignment_drafts d join public.ceremony_sectors s on s.id=d.sector_id left join public.groups g on g.id=(d.data->>'groupId')::uuid where d.plan_id=pid and d.state='draft'),'[]'::jsonb),
  'notifications',coalesce((select jsonb_object_agg(state,n) from (select state,count(*) n from public.ceremony_publication_emails where plan_id=pid group by state) totals),'{}'::jsonb));
 -- Available means after the shared drafts, without exposing them to public readers.
 result:=jsonb_set(result,'{sectors}',(select jsonb_agg(s||jsonb_build_object('remaining',greatest(0,(s->>'remaining')::integer-coalesce((select sum((d.data->>'quantity')::integer) from public.ceremony_assignment_drafts d where d.sector_id=(s->>'id')::uuid and d.state='draft'),0))) order by ord) from jsonb_array_elements(result->'sectors') with ordinality sec(s,ord)));
 return result;
end $$;

create function public.claim_ceremony_publication_email() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.ceremony_publication_emails; valid_lines jsonb;
begin
 update public.ceremony_publication_emails set state='uncertain',error_code='interrupted',updated_at=clock_timestamp()
  where state='sending' and updated_at<clock_timestamp()-interval '10 minutes';
 select em.* into e from public.ceremony_publication_emails em join public.events ev on ev.id=em.event_id where em.state='queued' and ev.is_current order by em.created_at,em.id limit 1 for update of em skip locked;
 if not found then return null;end if;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into valid_lines from jsonb_array_elements(e.payload->'lines') x where
  (e.user_id is not null and (x->>'groupId')::uuid in (select app.ceremony_leader_scope(e.event_id,e.user_id))
   and exists(select 1 from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id where a.plan_id=e.plan_id and a.group_id=(x->>'groupId')::uuid and a.revoked_at is null and s.name=x->>'sector'))
  or (e.registration_id is not null and exists(select 1 from public.ceremony_nominees n join public.registrations r on r.id=n.registration_id where n.id=(x->>'nomineeId')::uuid and n.plan_id=e.plan_id and n.registration_id=e.registration_id and n.revoked_at is null and r.deleted_at is null and r.status in ('submitted','confirmed')));
 update public.ceremony_publication_emails set state='sending',claim=gen_random_uuid(),updated_at=clock_timestamp() where id=e.id returning * into e;
 return jsonb_build_object('id',e.id,'claim',e.claim,'eventId',e.event_id,'userId',e.user_id,'registrationId',e.registration_id,'payload',e.payload||jsonb_build_object('lines',valid_lines));
end $$;
revoke all on function public.manage_ceremony_drafts(uuid,uuid,uuid,integer,uuid,text,uuid,jsonb),public.get_ceremony_draft_desk(uuid,uuid,text),public.claim_ceremony_publication_email() from public,anon,authenticated;
grant execute on function public.manage_ceremony_drafts(uuid,uuid,uuid,integer,uuid,text,uuid,jsonb),public.get_ceremony_draft_desk(uuid,uuid,text),public.claim_ceremony_publication_email() to service_role;
notify pgrst,'reload schema';
commit;
