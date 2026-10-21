begin;
-- The visible role is the union of scoped duties; it grants no general event role.
create table public.ceremony_reception_assignments (
 event_id uuid not null references public.events(id), user_id uuid not null references public.profiles(id),
 kind text not null check(kind in ('opening','closing')), created_by uuid not null references public.profiles(id),
 primary key(event_id,user_id,kind)
);
alter table public.ceremony_reception_assignments enable row level security;
revoke all on public.ceremony_reception_assignments from public,anon,authenticated;
grant all on public.ceremony_reception_assignments to service_role;

create function app.reception_duty_catalog(p_event uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(item order by ordering,title),'[]') from (
 select 0 ordering,m.title,jsonb_build_object('key',m.id::text,'title',m.title,'room',l.name,'kind','panel') item
 from public.event_moments m left join public.event_locations l on l.id=m.location_id
 where m.event_id=p_event and m.moment_type='panel'
 union all select 1,'Inaugurazione',jsonb_build_object('key','opening','title','Cerimonia d’apertura','room',null,'kind','ceremony')
 union all select 2,'Cerimonia finale',jsonb_build_object('key','closing','title','Cerimonia finale','room',null,'kind','ceremony')
 ) choices;
$$;
create function app.reception_duty_keys(p_event uuid,p_user uuid) returns text[]
language sql stable security invoker set search_path='' as $$
 select coalesce(array_agg(key order by key),'{}') from (
 select panel_id::text key from public.panel_reception_assignments where event_id=p_event and user_id=p_user and duty='panel_entry'
 union select kind from public.ceremony_reception_assignments where event_id=p_event and user_id=p_user) duties;
$$;
create function public.reception_duty_catalog() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare e uuid; managed boolean; keys text[];
begin
 select id into e from public.events where is_current;
 if e is null or auth.uid() is null then raise insufficient_privilege; end if;
 managed:=app.has_event_role(e,array['manager']::public.app_role[]);
 keys:=app.reception_duty_keys(e,auth.uid());
 return jsonb_build_object('eventId',e,'canManage',managed,'choices',
 coalesce((select jsonb_agg(c) from jsonb_array_elements(app.reception_duty_catalog(e)) c where managed or c->>'key'=any(keys)),'[]'),
 'assigned',to_jsonb(keys));
end $$;
create or replace function public.has_panel_reception_duty() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.events e where e.is_current and (
 cardinality(app.reception_duty_keys(e.id,auth.uid()))>0 or exists(select 1 from public.panel_reception_assignments a where a.event_id=e.id and a.user_id=auth.uid())));
$$;

create function public.set_reception_duties(p_event uuid,p_actor uuid,p_user uuid,p_keys text[],p_expected text[] default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare old_keys text[]; k text;
begin
 perform 1 from public.event_user_roles where user_id=p_actor and ((role='admin' and event_id is null) or (role='manager' and event_id=p_event)) for share;
 if not found then raise insufficient_privilege; end if;
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise insufficient_privilege; end if;
 perform 1 from public.profiles where id=p_user for update;
 if not found then raise invalid_parameter_value; end if;
 old_keys:=app.reception_duty_keys(p_event,p_user);
 if p_expected is not null and not (old_keys @> p_expected and old_keys <@ p_expected) then raise exception 'duties changed' using errcode='40001'; end if;
 if p_keys is null or array_position(p_keys,null) is not null or cardinality(p_keys)>1000 then raise invalid_parameter_value; end if;
 if p_user=p_actor and not(old_keys <@ p_keys) then raise insufficient_privilege using message='self removal forbidden'; end if;
 foreach k in array p_keys loop
  if not exists(select 1 from jsonb_array_elements(app.reception_duty_catalog(p_event)) c where c->>'key'=k) then raise invalid_parameter_value; end if;
 end loop;
 -- New grants are additive; editing sends the previously displayed set.
 if p_expected is null then p_keys:=array(select distinct unnest(p_keys||old_keys)); end if;
 delete from public.panel_reception_assignments where event_id=p_event and user_id=p_user and duty='panel_entry' and not(panel_id::text=any(p_keys));
 delete from public.ceremony_reception_assignments where event_id=p_event and user_id=p_user and not(kind=any(p_keys));
 foreach k in array p_keys loop
  if k in ('opening','closing') then
   insert into public.ceremony_reception_assignments values(p_event,p_user,k,p_actor) on conflict do nothing;
  else
   insert into public.panel_reception_assignments(event_id,user_id,panel_id,duty,created_by) values(p_event,p_user,k::uuid,'panel_entry',p_actor) on conflict do nothing;
  end if;
 end loop;
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(p_event,p_actor,'reception.duties_updated','profiles',p_user,jsonb_build_object('before',old_keys,'after',p_keys));
 return true;
end $$;

create function app.authorize_reception_target(p_event uuid,p_actor uuid,p_target text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.events where id=p_event and is_current for share;
 if not found then raise insufficient_privilege; end if;
 if p_target in ('opening','closing') then
  perform 1 from public.ceremony_reception_assignments where event_id=p_event and user_id=p_actor and kind=p_target for share;
 else
  perform 1 from public.panel_reception_assignments where event_id=p_event and user_id=p_actor and panel_id::text=p_target and duty='panel_entry' for share;
 end if;
 if not found then raise insufficient_privilege; end if;
end $$;

-- Canonical registration lookup. No account impersonation, no names returned for invalid tokens.
create function app.reception_registration(p_event uuid,p_kind text,p_value text) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if p_kind='code' and p_value ~ '^[A-Z0-9]{4}$' then
  select r.id into rid from public.registrations r join public.participants p on p.id=r.participant_id where r.event_id=p_event and p.public_code=p_value;
 elsif p_kind='qr' and p_value ~ '^[a-f0-9]{64}$' then
  select r.id into rid from public.registrations r join public.qr_tokens q on q.registration_id=r.id
  where r.event_id=p_event and q.token_hash=p_value and q.status='active' and q.revoked_at is null and (q.expires_at is null or q.expires_at>clock_timestamp())
  and q.id=(select id from public.qr_tokens where registration_id=r.id order by created_at desc,id desc limit 1);
 else raise invalid_parameter_value; end if;
 perform 1 from public.registrations where id=rid and event_id=p_event and deleted_at is null and cancelled_at is null and status in ('submitted','confirmed') for update;
 if not found then return null; end if;
 return rid;
end $$;

create function public.reception_target_statistics(p_event uuid,p_actor uuid,p_target text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare mid uuid; booked bigint; entered bigint;
begin
 perform app.authorize_reception_target(p_event,p_actor,p_target);
 if p_target in ('opening','closing') then
  select moment_id into mid from public.ceremony_plans where event_id=p_event and kind=p_target;
  select count(*) into booked from public.ceremony_nominees n join public.ceremony_plans p on p.id=n.plan_id
   join public.ceremony_allocations a on a.id=n.allocation_id where p.event_id=p_event and p.kind=p_target and n.revoked_at is null and a.revoked_at is null;
 else
  mid:=p_target::uuid;
  select coalesce(sum(app.registration_panel_party_size(c.registration_id,mid)),0) into booked from public.moment_attendance_choices c
   join public.registrations r on r.id=c.registration_id where c.moment_id=mid and c.choice='yes' and r.event_id=p_event and r.deleted_at is null and r.cancelled_at is null and r.status in ('submitted','confirmed');
  booked:=booked+coalesce((select sum(student_count+companion_count) from public.school_panel_reservations where panel_id=mid and event_id=p_event and status='reserved'),0);
 end if;
 select coalesce(sum(case when school_booking_id is null then 1 else student_count+companion_count end),0) into entered
 from public.check_ins where event_id=p_event and moment_id=mid and cancelled_at is null;
 return jsonb_build_object('booked',booked,'entered',entered);
end $$;

-- Enrich only a valid-but-unbooked lookup, and only with routing in the same slot.
create function public.reception_forum_routing(p_event uuid,p_actor uuid,p_panel uuid,p_kind text,p_value text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rid uuid; routes jsonb;
begin
 perform app.authorize_reception_target(p_event,p_actor,p_panel::text);
 rid:=app.reception_registration(p_event,p_kind,p_value);
 if rid is null then return jsonb_build_object('status','not_booked'); end if;
 select coalesce(jsonb_agg(jsonb_build_object('title',m.title,'room',l.name) order by m.starts_at,m.title),'[]') into routes
 from public.moment_attendance_choices c join public.event_moments m on m.id=c.moment_id
 join public.event_moments target on target.id=p_panel and target.event_id=p_event
 left join public.event_locations l on l.id=m.location_id
 where c.registration_id=rid and c.choice='yes' and m.event_id=p_event and m.id<>p_panel
 and m.publication_status='published' and app.panel_slots_conflict(m.starts_at,m.ends_at,target.starts_at,target.ends_at);
 return jsonb_build_object('status','not_booked','routes',routes);
end $$;

create function public.reception_desk(p_event uuid,p_actor uuid,p_target text,p_kind text,p_value text,
 p_operation text default 'preview',p_option uuid default null,p_children uuid[] default '{}',p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid; r public.registrations; panel public.event_moments; plan public.ceremony_plans; quota public.ceremony_quotas;
 opts jsonb; current_section uuid; capacity integer; fingerprint text; receipt public.check_in_requests; allocation uuid;
begin
 perform app.authorize_reception_target(p_event,p_actor,p_target);
 if p_operation is null or p_operation not in ('preview','book') then raise invalid_parameter_value; end if;
 -- Ceremony assignments share the canonical configuration/distribution lock.
 if p_target in ('opening','closing') then perform pg_advisory_xact_lock(hashtextextended(p_event::text,1381)); end if;
 rid:=app.reception_registration(p_event,p_kind,p_value);
 if rid is null then return jsonb_build_object('status','invalid'); end if;
 select * into r from public.registrations where id=rid;
 if p_target in ('opening','closing') then
  select * into plan from public.ceremony_plans where event_id=p_event and kind=p_target;
  if plan.id is null or plan.state<>'validated' then return jsonb_build_object('status','unconfigured'); end if;
  select * into panel from public.event_moments where id=plan.moment_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'label',s.name||' · '||q.category,'available',q.quantity-coalesce((select sum(quantity) from public.ceremony_allocations where quota_id=q.id and revoked_at is null),0)) order by s.name,q.category),'[]') into opts
  from public.ceremony_quotas q join public.ceremony_sectors s on s.id=q.sector_id where q.plan_id=plan.id;
 else
  select * into panel from public.event_moments where id=p_target::uuid and event_id=p_event and moment_type='panel' and publication_status='published' for update;
  if panel.id is null then return jsonb_build_object('status','panel_unavailable'); end if;
  perform 1 from public.panel_seat_sections where panel_id=panel.id order by id for update;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'label',a.name,'available',greatest(0,s.capacity-app.panel_section_occupancy(s.id))) order by a.name),'[]') into opts
  from public.panel_seat_sections s join public.panel_audience_types a on a.id=s.audience_type_id
  where s.panel_id=panel.id and a.is_active and a.booking_channel='individual';
 end if;
 if p_operation='preview' then
  return jsonb_build_object('status','ready','name',(select first_name||' '||last_name from public.participants where id=r.participant_id),'options',opts,
   'children',case when p_target in ('opening','closing') then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',first_name||' '||last_name) order by position,id) from public.registration_children where registration_id=rid),'[]') end);
 end if;
 if p_request is null or p_option is null or p_children is null or cardinality(p_children)>10 or array_position(p_children,null) is not null
 or cardinality(p_children)<>(select count(distinct x) from unnest(p_children) x)
 or exists(select 1 from unnest(p_children) x where not exists(select 1 from public.registration_children where id=x and registration_id=rid)) then raise invalid_parameter_value; end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array('reception.booking',p_actor,p_event,p_target,rid,p_option,p_children)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,11));
 select * into receipt from public.check_in_requests where request_id=p_request;
 if found then
  if receipt.fingerprint<>fingerprint then raise invalid_parameter_value; end if;
  return jsonb_build_object('status','saved');
 end if;
 if p_target in ('opening','closing') then
  if cardinality(p_children)>0 then raise invalid_parameter_value; end if;
  if app.ceremony_eligibility(rid,(panel.starts_at at time zone 'Europe/Rome')::date,plan.attendance_part)<>'eligible' then return jsonb_build_object('status','attendance_required'); end if;
  if exists(select 1 from public.ceremony_nominees where plan_id=plan.id and subject_id=rid and revoked_at is null) then return jsonb_build_object('status','already_booked'); end if;
  select * into quota from public.ceremony_quotas where id=p_option and plan_id=plan.id;
  if quota.id is null then raise invalid_parameter_value; end if;
  if 1+coalesce((select sum(quantity) from public.ceremony_allocations where quota_id=quota.id and revoked_at is null),0)>quota.quantity then return jsonb_build_object('status','capacity_exceeded'); end if;
  allocation:=extensions.gen_random_uuid();
  insert into public.ceremony_allocations(id,plan_id,quota_id,registration_id,quantity,group_snapshot)
  values(allocation,plan.id,quota.id,rid,1,array(select group_id from public.participant_group_assignments where registration_id=rid and is_current order by group_id));
  update public.ceremony_plans set revision=revision+1 where id=plan.id;
 else
  perform app.require_panel_bookings_open(p_event);
  perform app.require_forum_attendance(rid,panel.id);
  select seat_section_id into current_section from public.moment_attendance_choices where registration_id=rid and moment_id=panel.id and choice='yes';
  if current_section is not null then return jsonb_build_object('status','already_booked'); end if;
  if exists(select 1 from public.moment_attendance_choices c join public.event_moments m on m.id=c.moment_id
   where c.registration_id=rid and c.choice='yes' and m.id<>panel.id and app.panel_slots_conflict(m.starts_at,m.ends_at,panel.starts_at,panel.ends_at)) then return jsonb_build_object('status','booking_conflict'); end if;
  select s.capacity into capacity from public.panel_seat_sections s join public.panel_audience_types a on a.id=s.audience_type_id
   where s.id=p_option and s.panel_id=panel.id and s.event_id=p_event and a.is_active and a.booking_channel='individual';
  if capacity is null then raise invalid_parameter_value; end if;
  if exists(select 1 from public.panel_waitlist where (section_id=p_option or (registration_id=rid and panel_id=panel.id)) and status in ('waiting','offered')) then return jsonb_build_object('status','waitlist'); end if;
  if app.panel_section_occupancy(p_option)+1+cardinality(p_children)>capacity then return jsonb_build_object('status','capacity_exceeded'); end if;
  insert into public.panel_child_selections values(rid,panel.id,p_children) on conflict(registration_id,panel_id) do update set child_ids=excluded.child_ids;
  insert into public.moment_attendance_choices(registration_id,moment_id,choice,seat_section_id) values(rid,panel.id,'yes',p_option)
   on conflict(registration_id,moment_id) do update set choice='yes',seat_section_id=excluded.seat_section_id;
 end if;
 insert into public.check_in_requests(request_id,event_id,actor_user_id,fingerprint) values(p_request,p_event,p_actor,fingerprint);
 insert into public.audit_logs(event_id,actor_user_id,action,entity_table,entity_id,metadata)
 values(p_event,p_actor,'reception.booking','registrations',rid,jsonb_build_object('target',p_target,'option',p_option,'children',p_children,'request',p_request));
 return jsonb_build_object('status','saved');
end $$;

create function public.reception_ceremony_check_in(p_event uuid,p_actor uuid,p_kind text,p_lookup_kind text,p_lookup text,
 p_action text default 'inspect',p_request uuid default null,p_subjects uuid[] default '{}',p_revision integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare rid uuid; plan public.ceremony_plans; r public.registrations; persons jsonb; subject uuid; rev integer; fp text; receipt public.check_in_requests; ci public.check_ins;
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
    select * into ci from public.check_ins where event_id=p_event and moment_id=plan.moment_id and registration_id=rid and child_id is not distinct from (case when subject=rid then null else subject end);
    if p_action='cancel' then update public.check_ins set cancelled_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor where id=ci.id and cancelled_at is null;
    elsif ci.id is null then insert into public.check_ins(event_id,moment_id,registration_id,child_id,checked_in_by,updated_by,source) values(p_event,plan.moment_id,rid,case when subject=rid then null else subject end,p_actor,p_actor,case when p_lookup_kind='qr' then 'qr_scan' else 'manual' end);
    elsif ci.cancelled_at is not null then update public.check_ins set cancelled_at=null,checked_in_at=clock_timestamp(),updated_at=clock_timestamp(),updated_by=p_actor,checked_in_by=p_actor where id=ci.id; end if;
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
 return jsonb_build_object('status','valid','kind','family','code',(select public_code from public.participants where id=r.participant_id),'persons',persons,'revision',rev,'registrationStatus',r.status,'outcome',case when p_action='inspect' then 'verified' when receipt.request_id is not null then 'replayed' else 'saved' end);
end $$;

revoke all on function app.reception_duty_catalog(uuid),app.reception_duty_keys(uuid,uuid),app.authorize_reception_target(uuid,uuid,text),app.reception_registration(uuid,text,text) from public,anon,authenticated;
grant execute on function app.reception_duty_catalog(uuid),app.reception_duty_keys(uuid,uuid),app.authorize_reception_target(uuid,uuid,text),app.reception_registration(uuid,text,text) to service_role;
revoke all on function public.reception_duty_catalog() from public,anon;
grant execute on function public.reception_duty_catalog() to authenticated;
revoke all on function public.set_reception_duties(uuid,uuid,uuid,text[],text[]), public.reception_target_statistics(uuid,uuid,text),public.reception_forum_routing(uuid,uuid,uuid,text,text),public.reception_desk(uuid,uuid,text,text,text,text,uuid,uuid[],uuid),public.reception_ceremony_check_in(uuid,uuid,text,text,text,text,uuid,uuid[],integer) from public,anon,authenticated;
grant execute on function public.set_reception_duties(uuid,uuid,uuid,text[],text[]), public.reception_target_statistics(uuid,uuid,text),public.reception_forum_routing(uuid,uuid,uuid,text,text),public.reception_desk(uuid,uuid,text,text,text,text,uuid,uuid[],uuid),public.reception_ceremony_check_in(uuid,uuid,text,text,text,text,uuid,uuid[],integer) to service_role;
commit;
