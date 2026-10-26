-- Closing ceremony badge workflow. Installation does not enable delivery or change sectors.
create function app.closing_badge_instructions_valid(value jsonb) returns boolean
language sql immutable set search_path='' as $$
 select jsonb_typeof(value)='object' and not exists(
  select 1 from unnest(array['CLOSING_ORANGE','CLOSING_PURPLE','CLOSING_GREEN']) code
  cross join unnest(array['it','en']) locale
  where jsonb_typeof(value->code->locale) is distinct from 'string'
   or length(btrim(value->code->>locale)) not between 1 and 12000)
$$;
create table public.closing_ceremony_badge_settings (
 plan_id uuid primary key references public.ceremony_plans(id),
 enabled boolean not null default false,
 instructions jsonb not null default '{}',
 updated_at timestamptz not null default now(),
 check(not enabled or app.closing_badge_instructions_valid(instructions))
);
alter table public.closing_ceremony_badge_settings enable row level security;
revoke all on public.closing_ceremony_badge_settings from public,anon,authenticated;
grant select,insert,update on public.closing_ceremony_badge_settings to service_role;

create function app.closing_badge_lines(p_plan uuid,p_nominees uuid[] default null) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('nomineeId',n.id,'registrationId',r.id,
  'name',case when n.child_id is null then pe.first_name||' '||pe.last_name else ch.first_name||' '||ch.last_name end,
  'sector',s.name,'badgeCode',s.layout_code,'groupId',a.group_id,'groupName',g.name) order by n.subject_name,n.id),'[]')
 from public.ceremony_nominees n join public.ceremony_allocations a on a.id=n.allocation_id
 join public.ceremony_plans p on p.id=n.plan_id join public.events ev on ev.id=p.event_id
 join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id
 join public.registrations r on r.id=n.registration_id join public.participants pe on pe.id=r.participant_id
 left join public.registration_children ch on ch.id=n.child_id and ch.registration_id=r.id
 left join public.groups g on g.id=a.group_id
 where p.id=p_plan and p.kind='closing' and p.layout_key='assisi-closing-badges-2026' and ev.is_current
 and p.state='validated' and n.revoked_at is null and a.revoked_at is null and n.needs_seat
 and r.deleted_at is null and r.status in ('submitted','confirmed') and (n.child_id is null or ch.id is not null)
 and (p_nominees is null or n.id=any(p_nominees))
 and s.layout_code in ('CLOSING_ORANGE','CLOSING_PURPLE','CLOSING_GREEN')
$$;
create function app.closing_personal_email(p_registration uuid) returns text
language sql stable security invoker set search_path='' as $$
 select btrim(c.email) from public.registrations r join public.participant_contacts c on c.participant_id=r.participant_id
 where r.id=p_registration and r.deleted_at is null and r.status in ('submitted','confirmed') and not c.is_delegate_contact and nullif(btrim(c.email),'') is not null
 order by c.is_primary desc,c.id limit 1
$$;
-- A ceremony-specific contact responsibility, always rechecked against current scope.
create function app.closing_contact_leader(p_plan uuid,p_registration uuid,p_preferred uuid default null) returns uuid
language sql stable security invoker set search_path='' as $$
 select gm.user_id from public.ceremony_plans p
 join public.participant_group_assignments ga on ga.registration_id=p_registration and ga.is_current and ga.status='confirmed'
 join public.groups g on g.id=ga.group_id and g.event_id=p.event_id and g.is_active
 join public.group_memberships gm on gm.role='capogruppo'
 join public.groups own_group on own_group.id=gm.group_id and own_group.event_id=p.event_id and own_group.is_active
 where p.id=p_plan and g.id in(select app.ceremony_leader_scope(p.event_id,gm.user_id))
 and exists(select 1 from public.ceremony_nominees n join public.ceremony_allocations a on a.id=n.allocation_id
  where n.plan_id=p.id and n.registration_id=p_registration and n.revoked_at is null and a.revoked_at is null
  and (a.group_id is null or a.group_id=g.id))
 order by (gm.user_id=p_preferred) desc nulls last,(gm.group_id=g.id) desc,gm.is_primary desc,gm.user_id limit 1
$$;

create function app.queue_closing_nominee_email(p_plan uuid,p_registration uuid,p_nominee uuid,p_publication uuid,p_leader uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare p public.ceremony_plans; lines jsonb; body jsonb;
begin
 select * into p from public.ceremony_plans where id=p_plan and kind='closing' and layout_key='assisi-closing-badges-2026';
 if not found then return;end if;
 lines:=app.closing_badge_lines(p.id,array[p_nominee]);
 if jsonb_array_length(lines)=0 then return;end if;
 select jsonb_build_object('kind','closing','title','Cerimonia finale','startsAt',m.starts_at,'location',l.name,
  'sourceLeaderId',p_leader,'lines',lines) into body from public.event_moments m join public.event_locations l on l.id=m.location_id where m.id=p.moment_id;
 insert into public.ceremony_publication_emails(publication_id,event_id,plan_id,recipient_key,registration_id,payload)
 values(p_publication,p.event_id,p.id,'person:'||p_registration,p_registration,body)
 on conflict(publication_id,recipient_key) do update set payload=excluded.payload||jsonb_build_object('lines',
  (select jsonb_agg(x order by x->>'name',x->>'nomineeId') from
   (select distinct x from jsonb_array_elements((public.ceremony_publication_emails.payload->'lines')||(excluded.payload->'lines')) x) all_lines))
 where public.ceremony_publication_emails.state='queued';
end $$;

-- Wrap canonical pairing to queue in the same transaction, after all authorization/revision checks.
alter function public.pair_ceremony_group_ticket(uuid,uuid,uuid,integer,uuid,text,uuid,uuid,uuid,uuid) rename to pair_ceremony_group_ticket_before_badges;
alter function public.pair_ceremony_group_ticket_before_badges(uuid,uuid,uuid,integer,uuid,text,uuid,uuid,uuid,uuid) set schema app;
create function public.pair_ceremony_group_ticket(p_event uuid,p_actor uuid,p_allocation uuid,p_revision integer,p_request uuid,p_action text,p_seat uuid,p_registration uuid,p_child uuid,p_nominee uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; n public.ceremony_nominees; batch uuid; replay boolean;
begin
 select exists(select 1 from public.ceremony_map_requests where request_id=p_request) into replay;
 result:=app.pair_ceremony_group_ticket_before_badges(p_event,p_actor,p_allocation,p_revision,p_request,p_action,p_seat,p_registration,p_child,p_nominee);
 if result->>'status'='saved' and p_action='assign' and not replay then
  select * into n from public.ceremony_nominees where allocation_id=p_allocation and subject_id=coalesce(p_child,p_registration) and revoked_at is null;
  batch:=coalesce(nullif(current_setting('app.closing_badge_batch',true),'')::uuid,p_request);
  if n.id is not null then perform app.queue_closing_nominee_email(n.plan_id,n.registration_id,n.id,batch,p_actor);end if;
 end if;
 return result;
end $$;
alter function public.assign_ceremony_group_members(uuid,uuid,uuid,integer,uuid,jsonb) rename to assign_ceremony_group_members_before_badges;
alter function public.assign_ceremony_group_members_before_badges(uuid,uuid,uuid,integer,uuid,jsonb) set schema app;
create function public.assign_ceremony_group_members(p_event uuid,p_actor uuid,p_allocation uuid,p_revision integer,p_request uuid,p_subjects jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; previous text:=current_setting('app.closing_badge_batch',true);
begin
 perform set_config('app.closing_badge_batch',p_request::text,true);
 result:=app.assign_ceremony_group_members_before_badges(p_event,p_actor,p_allocation,p_revision,p_request,p_subjects);
 perform set_config('app.closing_badge_batch',coalesce(previous,''),true);
 return result;
end $$;

-- Existing personal/QR projections gain a canonical sector code, never an inferred color.
alter function public.get_my_ceremony_seats(uuid,uuid) rename to get_my_ceremony_seats_before_badges;
alter function public.get_my_ceremony_seats_before_badges(uuid,uuid) set schema app;
create function public.get_my_ceremony_seats(p_event uuid,p_actor uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(x||jsonb_build_object('badgeCode',case when p.layout_key='assisi-closing-badges-2026' then s.layout_code end)),'[]')
 from jsonb_array_elements(app.get_my_ceremony_seats_before_badges(p_event,p_actor)) x
 join public.ceremony_nominees n on n.id=(x->>'id')::uuid join public.ceremony_plans p on p.id=n.plan_id
 join public.ceremony_allocations a on a.id=n.allocation_id join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id
$$;
create or replace function app.ceremony_subject_seats(p_event uuid,p_subject uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('kind',p.kind,'sector',s.name,'needsSeat',n.needs_seat,'review',app.ceremony_nominee_needs_review(n.id),'seat',app.ceremony_numbered_seat(n.id),
 'badgeCode',case when p.layout_key='assisi-closing-badges-2026' then s.layout_code end) order by p.kind),'[]')
 from public.ceremony_nominees n join public.ceremony_allocations a on a.id=n.allocation_id join public.ceremony_plans p on p.id=n.plan_id join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id
 where p.event_id=p_event and n.subject_id=p_subject and n.revoked_at is null and a.revoked_at is null
$$;
alter function public.get_ceremony_leader_tickets(uuid,uuid) rename to get_ceremony_leader_tickets_before_badges;
alter function public.get_ceremony_leader_tickets_before_badges(uuid,uuid) set schema app;
create function public.get_ceremony_leader_tickets(p_event uuid,p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v jsonb;
begin
 v:=app.get_ceremony_leader_tickets_before_badges(p_event,p_actor);
 return v||jsonb_build_object('allocations',coalesce((select jsonb_agg(x||jsonb_build_object('badgeCode',case when p.layout_key='assisi-closing-badges-2026' then s.layout_code end))
 from jsonb_array_elements(v->'allocations') x join public.ceremony_allocations a on a.id=(x->>'id')::uuid
 join public.ceremony_plans p on p.id=a.plan_id join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id),'[]'));
end $$;

create function public.get_closing_ceremony_badge(p_actor uuid,p_nominee uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare n public.ceremony_nominees; e uuid; allowed boolean;
begin
 select * into n from public.ceremony_nominees where id=p_nominee;
 select event_id into e from public.ceremony_plans where id=n.plan_id;
 if n.id is null or p_actor is null then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(e::text,1381));
 select exists(select 1 from public.registrations r join public.participants pe on pe.id=r.participant_id where r.id=n.registration_id and pe.auth_user_id=p_actor)
 or exists(select 1 from public.participant_group_assignments ga where ga.registration_id=n.registration_id and ga.is_current and ga.status='confirmed' and ga.group_id in(select app.ceremony_leader_scope(e,p_actor))) into allowed;
 if not coalesce(allowed,false) then
  begin perform app.ceremony_authorize(e,p_actor,true);allowed:=true;exception when insufficient_privilege then allowed:=false;end;
 end if;
 if not coalesce(allowed,false) then raise insufficient_privilege;end if;
 return app.closing_badge_lines(n.plan_id,array[n.id])->0;
end $$;

-- Delivery is an explicit, audited Admin operation; incomplete instructions cannot enable it.
create function public.set_closing_badge_delivery(p_event uuid,p_actor uuid,p_revision integer,p_instructions jsonb,p_enabled boolean) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.ceremony_plans;
begin
 if not app.ceremony_authorize(p_event,p_actor,true) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381));
 select * into p from public.ceremony_plans where event_id=p_event and kind='closing' and layout_key='assisi-closing-badges-2026' for update;
 if p.id is null or p.revision is distinct from p_revision then return jsonb_build_object('status','conflict');end if;
 if p_enabled is null or p_instructions is null or (p_enabled and not app.closing_badge_instructions_valid(p_instructions)) then raise exception 'Complete approved instructions required' using errcode='22023';end if;
 insert into public.closing_ceremony_badge_settings(plan_id,enabled,instructions) values(p.id,p_enabled,p_instructions)
 on conflict(plan_id) do update set enabled=excluded.enabled,instructions=excluded.instructions,updated_at=clock_timestamp();
 update public.ceremony_plans set revision=revision+1 where id=p.id;
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata) values(p_event,p_actor,'ceremony.closing_badge_delivery','ceremony_plans',p.id,jsonb_build_object('enabled',p_enabled,'instructions',p_instructions));
 return jsonb_build_object('status','saved');
end $$;

-- Claim closing notices only after instructions are approved. Classify current contacts at claim time.
create or replace function public.claim_ceremony_publication_email() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.ceremony_publication_emails; p public.ceremony_plans; valid_lines jsonb; target uuid; direct_email text; settings public.closing_ceremony_badge_settings; ids uuid[]; leader uuid; body jsonb;
begin
 update public.ceremony_publication_emails set state='uncertain',error_code='interrupted',updated_at=clock_timestamp() where state='sending' and updated_at<clock_timestamp()-interval '10 minutes';
 -- Lock the event before queue rows, consistently with nomination/publication writers.
 select ev.id into target from public.events ev where ev.is_current;
 if target is null then return null;end if;
 perform pg_advisory_xact_lock(hashtextextended(target::text,1381));
 select em.* into e from public.ceremony_publication_emails em join public.ceremony_plans cp on cp.id=em.plan_id
 where em.state='queued' and em.event_id=target and
 (cp.layout_key is distinct from 'assisi-closing-badges-2026' or exists(select 1 from public.closing_ceremony_badge_settings cfg where cfg.plan_id=cp.id and cfg.enabled))
 order by em.created_at,em.id limit 1 for update of em skip locked;
 if not found then return null;end if;
 select * into p from public.ceremony_plans where id=e.plan_id;
 body:=e.payload;
 if p.layout_key='assisi-closing-badges-2026' then
  select * into settings from public.closing_ceremony_badge_settings where plan_id=p.id;
  body:=body||jsonb_build_object('badgeWorkflow',true,'instructions',settings.instructions);
  if e.registration_id is not null then
   select array_agg(n.id) into ids from jsonb_array_elements(e.payload->'lines') x
    join public.ceremony_nominees n on n.id=(x->>'nomineeId')::uuid and n.plan_id=p.id and n.registration_id=e.registration_id;
   valid_lines:=app.closing_badge_lines(p.id,coalesce(ids,'{}'));
   direct_email:=app.closing_personal_email(e.registration_id);
   if direct_email is null and jsonb_array_length(valid_lines)>0 then
    leader:=app.closing_contact_leader(p.id,e.registration_id,(e.payload->>'sourceLeaderId')::uuid);
    if leader is not null then
     -- One cumulative report for this leader, including all currently assigned people without email.
     select array_agg(n.id) into ids from public.ceremony_nominees n where n.plan_id=p.id and n.revoked_at is null
      and app.closing_personal_email(n.registration_id) is null
      and app.closing_contact_leader(p.id,n.registration_id,leader)=leader;
     valid_lines:=app.closing_badge_lines(p.id,coalesce(ids,'{}'));
     update public.ceremony_publication_emails other set state='skipped',error_code='included_in_leader_report',
      payload=other.payload||jsonb_build_object('leaderReportId',e.id),updated_at=clock_timestamp()
      where other.plan_id=p.id and other.id<>e.id and other.state='queued' and other.registration_id is not null
       and app.closing_personal_email(other.registration_id) is null
       and app.closing_contact_leader(p.id,other.registration_id,(other.payload->>'sourceLeaderId')::uuid)=leader;
     e.user_id:=leader;e.registration_id:=null;
     body:=body||jsonb_build_object('noticeType','leader_contacts','snapshotAt',clock_timestamp());
    end if;
   end if;
  else
   select coalesce(jsonb_agg(x||jsonb_build_object('badgeCode',s.layout_code)),'[]') into valid_lines
   from jsonb_array_elements(e.payload->'lines') x join public.ceremony_sectors s on s.plan_id=p.id and s.name=x->>'sector'
   where (x->>'groupId')::uuid in(select app.ceremony_leader_scope(e.event_id,e.user_id))
    and exists(select 1 from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id where a.plan_id=p.id and a.group_id=(x->>'groupId')::uuid and a.revoked_at is null and q.sector_id=s.id);
  end if;
 else
  select coalesce(jsonb_agg(x),'[]') into valid_lines from jsonb_array_elements(e.payload->'lines') x where
   (e.user_id is not null and (x->>'groupId')::uuid in(select app.ceremony_leader_scope(e.event_id,e.user_id))
    and exists(select 1 from public.ceremony_allocations a join public.ceremony_quotas q on q.id=a.quota_id join public.ceremony_sectors s on s.id=q.sector_id where a.plan_id=e.plan_id and a.group_id=(x->>'groupId')::uuid and a.revoked_at is null and s.name=x->>'sector'))
   or (e.registration_id is not null and exists(select 1 from public.ceremony_nominees n join public.registrations r on r.id=n.registration_id where n.id=(x->>'nomineeId')::uuid and n.plan_id=e.plan_id and n.registration_id=e.registration_id and n.revoked_at is null and r.deleted_at is null and r.status in ('submitted','confirmed')));
 end if;
 body:=body||jsonb_build_object('lines',valid_lines);
 update public.ceremony_publication_emails set state='sending',claim=gen_random_uuid(),user_id=e.user_id,registration_id=e.registration_id,payload=body,updated_at=clock_timestamp() where id=e.id returning * into e;
 return jsonb_build_object('id',e.id,'claim',e.claim,'eventId',e.event_id,'userId',e.user_id,'registrationId',e.registration_id,'destinationEmail',direct_email,'payload',body);
end $$;

revoke all on function app.closing_badge_instructions_valid(jsonb),app.closing_badge_lines(uuid,uuid[]),app.closing_personal_email(uuid),app.closing_contact_leader(uuid,uuid,uuid),app.queue_closing_nominee_email(uuid,uuid,uuid,uuid,uuid),
 public.pair_ceremony_group_ticket(uuid,uuid,uuid,integer,uuid,text,uuid,uuid,uuid,uuid),public.assign_ceremony_group_members(uuid,uuid,uuid,integer,uuid,jsonb),public.get_my_ceremony_seats(uuid,uuid),public.get_ceremony_leader_tickets(uuid,uuid),public.get_closing_ceremony_badge(uuid,uuid),public.set_closing_badge_delivery(uuid,uuid,integer,jsonb,boolean) from public,anon,authenticated;
grant execute on function app.closing_badge_instructions_valid(jsonb),app.closing_badge_lines(uuid,uuid[]),app.closing_personal_email(uuid),app.closing_contact_leader(uuid,uuid,uuid),app.queue_closing_nominee_email(uuid,uuid,uuid,uuid,uuid),
 public.pair_ceremony_group_ticket(uuid,uuid,uuid,integer,uuid,text,uuid,uuid,uuid,uuid),public.assign_ceremony_group_members(uuid,uuid,uuid,integer,uuid,jsonb),public.get_my_ceremony_seats(uuid,uuid),public.get_ceremony_leader_tickets(uuid,uuid),public.get_closing_ceremony_badge(uuid,uuid),public.set_closing_badge_delivery(uuid,uuid,integer,jsonb,boolean) to service_role;
notify pgrst,'reload schema';
